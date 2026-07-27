/* ==========================================================================
   Safety Rounds — Ejecución de visitas / inspecciones
   Evaluación de condiciones en vivo, captura de evidencias y firma táctil.
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el, esc = UI.esc;
  var FT = null; // Builder.FIELD_TYPES (se resuelve en tiempo de ejecución)

  var state = null;
  /* state = {
       form, visit, answers, mode:'run'|'preview', dirty, saveTimer
     } */

  /* ======================================================================
     Arranque
     ====================================================================== */

  function start(formId, visitId) {
    FT = Builder.FIELD_TYPES;
    var form, visit;

    if (visitId) {
      visit = Store.clone(Store.get('visits', visitId));
      if (!visit) { UI.toast('La visita ya no existe.', 'err'); App.go('historico'); return; }
      // Se conserva la definición del cuestionario tal y como estaba al realizarla:
      // así una visita antigua no se rompe si después se edita la plantilla.
      form = visit.formSnapshot || Store.get('forms', visit.formId);
      if (!form) { UI.toast('No se encuentra el cuestionario de esta visita.', 'err'); App.go('historico'); return; }
    } else {
      form = Store.get('forms', formId);
      if (!form) { UI.toast('El cuestionario ya no existe.', 'err'); App.go('cuestionarios'); return; }
      visit = {
        id: Store.uid('vis'),
        formId: form.id,
        formName: form.name,
        folderId: form.folderId,
        formSnapshot: Store.clone(form),
        code: nextCode(),
        centerId: '',
        areaId: '',
        inspector: Store.settings().defaultInspector || '',
        date: UI.fmtDateInput(new Date()),
        status: 'draft',
        answers: {},
        score: null
      };
    }

    state = { form: form, visit: visit, answers: visit.answers || {}, mode: 'run', dirty: false };
    prefillDefaults();
    render();
  }

  function preview(form) {
    FT = Builder.FIELD_TYPES;
    state = {
      form: form,
      visit: { id: 'preview', formName: form.name, code: 'PREVIEW', date: UI.fmtDateInput(new Date()), inspector: '', answers: {} },
      answers: {},
      mode: 'preview'
    };
    prefillDefaults();

    var body = el('div', { style: { paddingBottom: '10px' } });
    body.appendChild(renderFields());
    UI.modal({
      title: 'Vista previa · ' + form.name,
      subtitle: 'Así verá el cuestionario el inspector. Las respuestas de esta vista no se guardan.',
      size: 'wide',
      icon: 'eye',
      body: body,
      buttons: [{ label: 'Cerrar', kind: 'navy' }]
    });
    // Redibuja dentro del modal cuando cambian las condiciones
    state.container = body;
  }

  function prefillDefaults() {
    (state.form.fields || []).forEach(function (f) {
      if (f.type === 'date' && f.defaultToday !== false && !state.answers[f.id]) {
        state.answers[f.id] = UI.fmtDateInput(new Date());
      }
    });
  }

  function nextCode() {
    var y = new Date().getFullYear();
    var n = Store.all('visits').filter(function (v) {
      return (v.code || '').indexOf('V' + y) === 0;
    }).length + 1;
    return 'V' + y + '-' + String(n).padStart(4, '0');
  }

  /* ======================================================================
     Render
     ====================================================================== */

  function render() {
    var view = UI.$('#view');
    view.className = 'view';
    UI.clear(view);

    var isEdit = state.visit.status === 'completed';

    App.setHeader(
      isEdit ? 'Editar visita ' + state.visit.code : 'Nueva visita',
      state.form.name,
      [
        el('button', {
          class: 'btn btn--quiet btn--sm hide-sm', html: '<span>Salir</span>',
          onclick: exit
        }),
        el('button', {
          class: 'btn btn--ghost btn--sm hide-sm', html: ico('save', 16) + '<span>Guardar borrador</span>',
          onclick: function () { saveDraft(true); }
        }),
        el('button', {
          class: 'btn btn--primary btn--sm btn--icon show-sm',
          title: isEdit ? 'Guardar cambios' : 'Finalizar visita',
          'aria-label': isEdit ? 'Guardar cambios' : 'Finalizar visita',
          html: ico('checkCircle', 17),
          onclick: finish
        }),
        el('button', {
          class: 'btn btn--primary btn--sm hide-sm',
          html: ico('checkCircle', 16) + '<span>' + (isEdit ? 'Guardar cambios' : 'Finalizar visita') + '</span>',
          onclick: finish
        })
      ]
    );

    var wrap = el('div', { class: 'runner' });
    wrap.appendChild(renderProgress());
    wrap.appendChild(renderHeaderCard());
    var fieldsBox = el('div', { id: 'runnerFields' });
    fieldsBox.appendChild(renderFields());
    wrap.appendChild(fieldsBox);
    state.container = fieldsBox;

    wrap.appendChild(el('div', { style: { height: '20px' } }));
    wrap.appendChild(el('button', {
      class: 'btn btn--primary btn--block', style: { height: '48px' },
      html: ico('checkCircle', 18) + '<span>' + (isEdit ? 'Guardar cambios' : 'Finalizar visita') + '</span>',
      onclick: finish
    }));
    wrap.appendChild(el('div', { class: 'runner__foot-actions show-sm' }, [
      el('button', {
        class: 'btn btn--ghost', html: ico('save', 16) + '<span>Guardar borrador</span>',
        onclick: function () { saveDraft(true); }
      }),
      el('button', { class: 'btn btn--quiet', html: '<span>Salir</span>', onclick: exit })
    ]));
    wrap.appendChild(el('div', { style: { height: '30px' } }));

    view.appendChild(wrap);
    updateProgress();
  }

  function renderProgress() {
    return el('div', { class: 'runner__progress' }, [
      el('div', { class: 'progress-bar' }, el('div', { class: 'progress-bar__fill', id: 'progFill', style: { width: '0%' } })),
      el('div', { class: 'progress-meta' }, [
        el('span', { id: 'progText', text: '—' }),
        el('span', { id: 'progScore', text: '' })
      ])
    ]);
  }

  function updateProgress() {
    var fill = UI.$('#progFill');
    if (!fill) return;
    var visibleQs = (state.form.fields || []).filter(function (f) {
      return Builder.isQuestion(f) && Builder.isVisible(f, state.answers);
    });
    var answered = visibleQs.filter(function (f) { return hasAnswer(f); }).length;
    var pct = visibleQs.length ? Math.round(answered / visibleQs.length * 100) : 0;
    fill.style.width = pct + '%';
    UI.$('#progText').textContent = UI.num(answered) + ' de ' + UI.num(visibleQs.length) + ' contestadas';

    var s = computeScore();
    var scoreEl = UI.$('#progScore');
    if (s.total) {
      scoreEl.innerHTML = '<strong style="color:' + (s.pct >= 90 ? 'var(--ok)' : s.pct >= 70 ? 'var(--warn)' : 'var(--coral-dark)') + '">' +
        UI.pct(s.pct) + ' conforme</strong> · ' + UI.num(s.ko) + ' ' + UI.plural(s.ko, 'desviación', 'desviaciones');
    } else {
      scoreEl.textContent = '';
    }
  }

  function hasAnswer(f) {
    var v = state.answers[f.id];
    if (v === undefined || v === null || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') {
      if ('ids' in v) return (v.ids || []).length > 0;      // selección de tipología
      return v.value !== undefined && v.value !== null && v.value !== '';
    }
    return true;
  }

  function renderHeaderCard() {
    var card = el('div', { class: 'card', style: { marginBottom: '14px' } });
    card.appendChild(el('div', { class: 'card__head' }, [
      el('div', {}, [
        el('div', { class: 'card__title', text: 'Datos de la visita' }),
        el('div', { class: 'card__sub', text: 'Referencia ' + state.visit.code })
      ])
    ]));

    var body = el('div', { class: 'card__body' });

    var row1 = el('div', { class: 'grid-2' });
    var insp = el('input', {
      class: 'input', value: state.visit.inspector || '', placeholder: 'Quién realiza la inspección',
      oninput: function () { state.visit.inspector = insp.value; touch(); }
    });
    row1.appendChild(UI.field('Inspector', insp, null, true));
    var dt = el('input', {
      class: 'input', type: 'date', value: state.visit.date,
      oninput: function () { state.visit.date = dt.value; touch(); }
    });
    row1.appendChild(UI.field('Fecha de la visita', dt, null, true));
    body.appendChild(row1);

    // Centro y área en cascada: al elegir un centro, solo se ofrecen sus áreas
    var row2 = el('div', { class: 'grid-2', id: 'visitPlace' });
    body.appendChild(row2);
    paintPlace(row2);

    card.appendChild(body);
    return card;
  }

  function paintPlace(row) {
    UI.clear(row);

    var centerList = Store.listBySystem('center');
    var areaList = Store.listBySystem('area');

    row.appendChild(UI.field('Centro / Instalación',
      catalogSelect('center', state.visit.centerId, function (v) {
        state.visit.centerId = v;
        // El área elegida deja de ser válida si pertenece a otro centro
        var a = state.visit.areaId ? Store.get('catalogs', state.visit.areaId) : null;
        if (a && a.parentId && a.parentId !== v) state.visit.areaId = '';
        touch();
        paintPlace(row);
      })));

    var cascade = centerList && areaList && centerList.childListId === areaList.id;
    var areaHint = null;
    var areas;

    if (cascade && state.visit.centerId) {
      areas = Store.listItems(areaList.id, state.visit.centerId);
      if (!areas.length) areaHint = 'Este centro todavía no tiene áreas: crea la primera con el botón +.';
    } else if (cascade && !state.visit.centerId) {
      areas = [];
      areaHint = 'Elige antes un centro.';
    } else {
      areas = areaList ? Store.listItems(areaList.id) : [];
    }

    row.appendChild(UI.field('Área / Zona',
      catalogSelect('area', state.visit.areaId, function (v) { state.visit.areaId = v; touch(); }, true, areas,
        cascade ? state.visit.centerId : null),
      areaHint));
  }

  /**
   * Selector de catálogo con creación en línea.
   * Los catálogos arrancan vacíos por decisión de diseño, así que el usuario
   * debe poder darlos de alta sin salir de la visita.
   */
  function catalogSelect(type, value, onChange, allowEmpty, itemsOverride, parentItemId) {
    var wrap = el('div', { style: { display: 'flex', gap: '7px' } });
    var items = itemsOverride || Store.catalog(type);
    var opts = [{ value: '', label: allowEmpty === false ? 'Selecciona…' : '— Sin especificar —' }]
      .concat(items.map(function (c) { return { value: c.id, label: c.name }; }));
    var sel = UI.selectFrom(opts, value || '', { class: 'select' });
    sel.addEventListener('change', function () { onChange(sel.value); });
    wrap.appendChild(sel);

    var names = { center: 'centro', area: 'área', severity: 'nivel de gravedad', category: 'categoría de riesgo' };
    var needsParent = type === 'area' && parentItemId === null &&
      (Store.listBySystem('center') || {}).childListId === (Store.listBySystem('area') || {}).id;

    wrap.appendChild(el('button', {
      class: 'btn btn--ghost btn--icon', type: 'button',
      title: needsParent ? 'Elige antes un centro' : 'Crear nuevo',
      disabled: needsParent || undefined,
      html: ico('plus', 17),
      onclick: function () {
        UI.prompt({
          title: 'Nuevo ' + names[type],
          text: parentItemId ? 'Se creará dentro de «' + Store.catalogName(parentItemId) + '».' : '',
          label: 'Nombre',
          placeholder: type === 'center' ? 'Ej.: Planta de Vigo' : type === 'area' ? 'Ej.: Zona de carga' : 'Nombre'
        }).then(function (name) {
          if (!name) return;
          var c = Store.addCatalog(type, name, defaultColor(type, Store.catalog(type).length), parentItemId || null);
          onChange(c.id);
          // Si quien nos usa no ha redibujado, se refresca el desplegable aquí
          if (sel.parentNode === wrap) {
            var fresh = Store.catalog(type, parentItemId === undefined ? undefined : parentItemId);
            var newSel = UI.selectFrom(
              [{ value: '', label: '— Sin especificar —' }].concat(fresh.map(function (x) {
                return { value: x.id, label: x.name };
              })), c.id, { class: 'select' });
            newSel.addEventListener('change', function () { onChange(newSel.value); });
            wrap.replaceChild(newSel, sel);
            sel = newSel;
          }
          UI.toast(name + ' añadido.');
        });
      }
    }));
    return wrap;
  }

  function defaultColor(type, i) {
    var palettes = {
      severity: ['#E05C5C', '#F16B6B', '#C77A10', '#4356AE'],
      category: ['#1E2B6F', '#2E3D8A', '#4356AE', '#178A6B', '#C77A10', '#6B4EA8', '#E05C5C', '#0E7490'],
      center: ['#1E2B6F', '#4356AE', '#178A6B', '#C77A10', '#6B4EA8'],
      area: ['#4356AE', '#178A6B', '#C77A10', '#6B4EA8', '#E05C5C']
    };
    var p = palettes[type] || palettes.category;
    return p[i % p.length];
  }

  /* ---------- Campos ---------- */

  function renderFields() {
    var box = el('div');
    (state.form.fields || []).forEach(function (f) {
      if (!Builder.isVisible(f, state.answers)) return;
      box.appendChild(renderField(f));
    });
    return box;
  }

  function rerenderFields() {
    if (!state.container) return;
    var scrollY = window.scrollY;
    UI.clear(state.container);
    state.container.appendChild(renderFields());
    window.scrollTo(0, scrollY);
    updateProgress();
  }

  function touch() {
    state.dirty = true;
    if (state.mode === 'preview') return;
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(function () { saveDraft(false); }, 1400);
  }

  function setAnswer(f, value, opts) {
    state.answers[f.id] = value;
    touch();
    updateProgress();
    // Si algún módulo depende de este campo, hay que redibujar para aplicar el IF
    var affects = (state.form.fields || []).some(function (x) {
      return x.conditions && (x.conditions.rules || []).some(function (r) { return r.fieldId === f.id; });
    });
    if (affects && !(opts && opts.noRerender)) rerenderFields();
  }

  function renderField(f) {
    var t = FT[f.type] || FT.text;
    var conditioned = !!(f.conditions && f.conditions.rules && f.conditions.rules.length);

    if (t.structural) {
      var node = el('div', { class: 'r-field r-field--plain' + (conditioned ? ' r-field--cond' : '') });
      if (f.type === 'title') node.appendChild(el('div', { class: 'r-title', text: f.label }));
      else if (f.type === 'subtitle') node.appendChild(el('div', { class: 'r-subtitle', text: f.label }));
      else if (f.type === 'paragraph') node.appendChild(el('div', { class: 'r-para', text: f.label }));
      else if (f.type === 'divider') node.appendChild(el('hr', { style: { border: 'none', borderTop: '2px solid var(--line)', margin: '10px 0' } }));
      return node;
    }

    var card = el('div', { class: 'r-field' + (conditioned ? ' r-field--cond' : '') });
    card.appendChild(el('div', {
      class: 'r-field__label',
      html: esc(f.label) + (f.required ? '<span style="color:var(--coral-dark)"> *</span>' : '')
    }));
    if (f.hint) card.appendChild(el('div', { class: 'r-field__hint', text: f.hint }));

    var body = el('div', { class: 'r-field__body' });
    body.appendChild(control(f));
    card.appendChild(body);
    return card;
  }

  function control(f) {
    switch (f.type) {
      case 'listpick': return ctlListPick(f);
      case 'checkitem': return ctlCheckitem(f);
      case 'radio': return ctlOptions(f, false);
      case 'checkbox': return ctlOptions(f, true);
      case 'select': return ctlSelect(f);
      case 'date': return ctlInput(f, 'date');
      case 'number': return ctlNumber(f);
      case 'fullname': return ctlInput(f, 'text', 'Nombre y apellidos');
      case 'text': return ctlInput(f, 'text', f.placeholder);
      case 'textarea': return ctlTextarea(f);
      case 'photo': return ctlMedia(f, true);
      case 'file': return ctlMedia(f, false);
      case 'signature': return ctlSignature(f);
      default: return ctlInput(f, 'text');
    }
  }

  /* ---------- Controles simples ---------- */

  function ctlInput(f, type, placeholder) {
    var i = el('input', {
      class: 'input', type: type || 'text',
      value: state.answers[f.id] || '',
      placeholder: placeholder || ''
    });
    i.addEventListener('input', function () { setAnswer(f, i.value); });
    return i;
  }

  function ctlNumber(f) {
    var wrap = el('div', { style: { display: 'flex', gap: '9px', alignItems: 'center' } });
    var i = el('input', { class: 'input', type: 'number', value: state.answers[f.id] != null ? state.answers[f.id] : '', step: 'any' });
    i.addEventListener('input', function () { setAnswer(f, i.value); });
    wrap.appendChild(i);
    if (f.unit) wrap.appendChild(el('span', { style: { color: 'var(--ink-3)', fontWeight: '600', flex: 'none' }, text: f.unit }));
    return wrap;
  }

  function ctlTextarea(f) {
    var i = el('textarea', { class: 'textarea', placeholder: f.placeholder || '' });
    i.value = state.answers[f.id] || '';
    i.addEventListener('input', function () { setAnswer(f, i.value); });
    return i;
  }

  function ctlSelect(f) {
    var s = UI.selectFrom(
      [{ value: '', label: 'Selecciona…' }].concat((f.options || []).map(function (o) {
        return { value: o.label, label: o.label };
      })), state.answers[f.id] || '', { class: 'select' });
    s.addEventListener('change', function () { setAnswer(f, s.value); });
    return s;
  }

  function ctlOptions(f, multi) {
    var list = el('div', { class: 'opt-list' });
    var current = state.answers[f.id];
    if (multi && !Array.isArray(current)) current = current ? [current] : [];

    (f.options || []).forEach(function (o) {
      var on = multi ? current.indexOf(o.label) !== -1 : current === o.label;
      var btn = el('button', {
        type: 'button', class: 'opt-btn' + (on ? ' is-on' : ''),
        onclick: function () {
          if (multi) {
            var arr = Array.isArray(state.answers[f.id]) ? state.answers[f.id].slice() : [];
            var i = arr.indexOf(o.label);
            if (i === -1) arr.push(o.label); else arr.splice(i, 1);
            setAnswer(f, arr);
          } else {
            setAnswer(f, state.answers[f.id] === o.label ? '' : o.label);
          }
          rerenderFields();
        }
      }, [
        el('span', { class: 'opt-btn__mark' + (multi ? ' opt-btn__mark--sq' : ''), html: ico('check', 13) }),
        el('span', { text: o.label })
      ]);
      list.appendChild(btn);
    });
    return list;
  }

  /* ======================================================================
     Selección de tipología
     ----------------------------------------------------------------------
     Un solo módulo resuelve el caso completo: elegir de una lista y, si esa
     lista tiene subtipología, ofrecer en el segundo desplegable únicamente
     los elementos que cuelgan de lo elegido en el primero.
     ====================================================================== */

  function ctlListPick(f) {
    var wrap = el('div');
    var l = f.listId ? Store.list(f.listId) : null;

    if (!l) {
      wrap.appendChild(el('div', {
        class: 'hint', style: { color: 'var(--coral-dark)' },
        text: 'Este módulo no tiene ninguna tipología asignada. Configúralo desde el constructor de cuestionarios.'
      }));
      return wrap;
    }

    var ans = state.answers[f.id];
    if (!ans || typeof ans !== 'object' || !('ids' in ans)) ans = { ids: [], childId: '' };

    var child = (f.cascade !== false && l.childListId) ? Store.list(l.childListId) : null;
    var multiple = !!f.multiple && !child;
    var mailHint = el('div');

    function save(next) {
      setAnswer(f, next, { noRerender: true });
      ans = next;
    }

    /* --- Selector principal --- */
    wrap.appendChild(picker({
      list: l,
      parentItemId: null,
      multiple: multiple,
      allowCreate: f.allowCreate !== false,
      selected: ans.ids,
      onChange: function (ids) {
        var next = { ids: ids, childId: ans.childId };
        // Si cambia la madre, la hija elegida deja de tener sentido
        if (child && next.childId) {
          var kid = Store.get('catalogs', next.childId);
          if (!kid || ids.indexOf(kid.parentId) === -1) next.childId = '';
        }
        save(next);

        // En selección múltiple no se redibuja el formulario salvo que otro
        // módulo dependa de éste: si no, el panel se cerraría a cada marca.
        if (multiple && !affectsConditions(f)) {
          paintMailHint();
          updateProgress();
        } else {
          rerenderFields();
        }
      }
    }));

    /* --- Selector en cascada --- */
    if (child) {
      var parentId = ans.ids[0] || '';
      var box = el('div', { style: { marginTop: '12px' } });
      box.appendChild(el('div', {
        style: { fontSize: '13px', fontWeight: '600', marginBottom: '6px' },
        text: f.childLabel || child.name
      }));

      if (!parentId) {
        box.appendChild(el('div', { class: 'combo combo--locked' },
          el('div', { class: 'combo__btn', 'aria-disabled': 'true' }, [
            el('span', { class: 'combo__value' },
              el('div', { class: 'combo__label combo__label--empty', text: 'Elige antes ' + (l.name || '').toLowerCase() })),
            el('span', { class: 'combo__chev', html: ico('chevronDown', 17) })
          ])));
      } else {
        var kids = Store.listItems(child.id, parentId);
        if (!kids.length && f.allowCreate === false) {
          box.appendChild(el('div', { class: 'hint', text: 'No hay elementos registrados para esta selección.' }));
        } else {
          box.appendChild(picker({
            list: child,
            parentItemId: parentId,
            multiple: false,
            allowCreate: f.allowCreate !== false,
            selected: ans.childId ? [ans.childId] : [],
            onChange: function (ids) {
              save({ ids: ans.ids, childId: ids[0] || '' });
              rerenderFields();
            }
          }));
        }
      }
      wrap.appendChild(box);
    }

    /* --- Aviso del correo que se propondrá para el informe --- */
    function paintMailHint() {
      UI.clear(mailHint);
      if (!f.useEmailForReport) return;
      var mails = collectEmails(f, ans);
      if (!mails.length) return;
      mailHint.appendChild(el('div', {
        class: 'hint',
        style: { marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--navy)' }
      }, [
        el('span', { style: { display: 'flex' }, html: ico('mail', 13) }),
        el('span', { text: 'Se propondrá enviar el informe a ' + mails.join(', ') })
      ]));
    }
    paintMailHint();
    wrap.appendChild(mailHint);

    return wrap;
  }

  /** ¿Hay algún módulo cuya visibilidad dependa de las respuestas de éste? */
  function affectsConditions(f) {
    return (state.form.fields || []).some(function (x) {
      return x.conditions && (x.conditions.rules || []).some(function (r) { return r.fieldId === f.id; });
    });
  }

  /**
   * Selector plegable de elementos de una lista.
   * Cerrado ocupa una línea y enseña lo elegido; al pulsarlo se despliega la
   * lista, con buscador si hay muchos elementos. En selección múltiple el
   * panel se queda abierto para poder marcar varios seguidos.
   */
  function picker(opts) {
    var items = Store.listItems(opts.list.id, opts.parentItemId);
    var selected = (opts.selected || []).slice();
    var open = false;
    var query = '';

    var combo = el('div', { class: 'combo' });
    var btn = el('button', { type: 'button', class: 'combo__btn' });
    var panel = null;

    combo.appendChild(btn);

    function selectedItems() {
      return selected.map(function (id) { return Store.get('catalogs', id); }).filter(Boolean);
    }

    function paintButton() {
      UI.clear(btn);
      var chosen = selectedItems();

      if (!chosen.length) {
        btn.appendChild(el('span', { class: 'combo__value' },
          el('div', {
            class: 'combo__label combo__label--empty',
            text: items.length ? 'Selecciona ' + opts.list.name.toLowerCase() + '…' : 'La lista está vacía'
          })));
      } else if (chosen.length === 1) {
        var c = chosen[0];
        var sub = [c.role, c.email].filter(Boolean).join(' · ');
        btn.appendChild(el('span', {
          class: 'combo__dot', style: { background: c.color || '#4356AE' }
        }));
        btn.appendChild(el('span', { class: 'combo__value' }, [
          el('div', { class: 'combo__label', text: c.name }),
          sub ? el('div', { class: 'combo__sub', text: sub }) : null
        ]));
      } else {
        btn.appendChild(el('span', { class: 'combo__value' }, [
          el('div', { class: 'combo__label', text: UI.num(chosen.length) + ' seleccionados' }),
          el('div', { class: 'combo__sub', text: chosen.map(function (c) { return c.name; }).join(', ') })
        ]));
      }

      btn.appendChild(el('span', { class: 'combo__chev', html: ico('chevronDown', 17) }));
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function paintPanel() {
      if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
      if (!open) { combo.classList.remove('is-open'); panel = null; return; }

      combo.classList.add('is-open');
      panel = el('div', { class: 'combo__panel' });

      // El buscador solo aparece cuando de verdad hace falta
      if (items.length > 8) {
        var search = el('input', {
          class: 'input input--sm combo__search',
          placeholder: 'Buscar…', value: query
        });
        search.addEventListener('input', function () {
          query = search.value;
          var pos = search.selectionStart;
          paintPanel();
          var again = panel.querySelector('.combo__search');
          if (again) { again.focus(); again.setSelectionRange(pos, pos); }
        });
        panel.appendChild(search);
      }

      var q = query.trim().toLowerCase();
      var shown = items.filter(function (c) {
        return !q || (c.name + ' ' + (c.role || '')).toLowerCase().indexOf(q) !== -1;
      });

      var opts_ = el('div', { class: 'combo__opts' });
      if (!shown.length) {
        opts_.appendChild(el('div', {
          class: 'combo__empty',
          text: items.length ? 'Sin coincidencias.' : 'Esta lista todavía no tiene elementos.'
        }));
      }
      shown.forEach(function (c) { opts_.appendChild(optionRow(c)); });
      panel.appendChild(opts_);

      if (opts.allowCreate) {
        panel.appendChild(el('div', { class: 'combo__foot' }, el('button', {
          type: 'button', class: 'btn btn--ghost btn--sm btn--block',
          html: ico('plus', 15) + '<span>Añadir a ' + esc(opts.list.name.toLowerCase()) + '</span>',
          onclick: function () { createItem(opts, selected); }
        })));
      }

      // Los clics de dentro no deben llegar al cierre por clic exterior: al
      // marcar una opción el panel se repinta, el botón pulsado queda fuera
      // del documento y `combo.contains(target)` dejaría de reconocerlo.
      panel.addEventListener('click', function (e) { e.stopPropagation(); });

      combo.appendChild(panel);
    }

    function optionRow(c) {
      var on = selected.indexOf(c.id) !== -1;
      var sub = [c.role, c.email].filter(Boolean).join(' · ');
      return el('button', {
        type: 'button', class: 'combo__opt' + (on ? ' is-on' : ''),
        onclick: function () {
          if (opts.multiple) {
            var i = selected.indexOf(c.id);
            if (i === -1) selected.push(c.id); else selected.splice(i, 1);
            opts.onChange(selected.slice());
            paintButton();
            paintPanel();          // sigue abierto para marcar varios
          } else {
            selected = on ? [] : [c.id];
            open = false;
            opts.onChange(selected.slice());
          }
        }
      }, [
        el('span', { class: 'combo__mark' + (opts.multiple ? ' combo__mark--sq' : ''), html: ico('check', 12) }),
        el('span', { style: { flex: '1', minWidth: '0' } }, [
          el('div', { class: 'combo__opt-name', text: c.name }),
          sub ? el('div', { class: 'combo__sub', text: sub }) : null
        ]),
        el('span', { class: 'combo__dot', style: { background: c.color || '#4356AE' } })
      ]);
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      open = !open;
      query = '';
      paintButton();
      paintPanel();
      if (open && items.length > 8) {
        var s = panel.querySelector('.combo__search');
        if (s && !('ontouchstart' in window)) s.focus();
      }
    });

    // Cerrar al pulsar fuera o con Escape. Los escuchadores se dan de baja
    // solos cuando el selector deja de estar en el documento, porque la vista
    // se redibuja entera cada vez que cambia una respuesta.
    function stillAlive() {
      if (combo.isConnected) return true;
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
      return false;
    }
    function onDocClick(e) {
      if (!stillAlive()) return;
      if (!open || combo.contains(e.target)) return;
      open = false;
      paintButton();
      paintPanel();
    }
    function onKey(e) {
      if (!stillAlive()) return;
      if (e.key === 'Escape' && open) { open = false; paintButton(); paintPanel(); }
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);

    paintButton();
    return combo;
  }

  function createItem(opts, selected) {
    UI.prompt({
      title: 'Añadir a ' + opts.list.name,
      text: opts.parentItemId
        ? 'Se creará dentro de «' + Store.catalogName(opts.parentItemId) + '».'
        : 'Quedará disponible en todos los cuestionarios que usen esta tipología.',
      label: 'Nombre',
      placeholder: 'Nombre del elemento'
    }).then(function (name) {
      if (!name) return;
      var c = Store.addItem(opts.list.id, {
        name: name,
        parentId: opts.parentItemId || null,
        color: '#4356AE'
      });
      if (opts.multiple) selected.push(c.id);
      else selected = [c.id];
      opts.onChange(selected.slice());
      // El selector tiene cacheados los elementos de la lista: se redibuja
      // para que el recién creado aparezca entre las opciones.
      rerenderFields();
      UI.toast('«' + name + '» añadido a ' + opts.list.name + '.');
    });
  }

  /** Correos que este módulo aporta a los destinatarios del informe. */
  function collectEmails(f, ans) {
    if (!f.useEmailForReport || !ans) return [];
    var ids = (ans.ids || []).slice();
    if (ans.childId) ids.push(ans.childId);
    return ids.map(function (id) {
      var c = Store.get('catalogs', id);
      return c && c.email ? c.email : null;
    }).filter(Boolean);
  }

  /* ---------- Punto de inspección ---------- */

  function ctlCheckitem(f) {
    var wrap = el('div');
    var ans = state.answers[f.id] || {};
    var val = ans.value || '';

    var btns = el('div', { class: 'checkitem__btns' });
    var defs = [
      { v: 'ok', label: 'Correcto', icon: 'check' },
      { v: 'ko', label: 'No correcto', icon: 'x' }
    ];
    if (f.allowNA !== false) defs.push({ v: 'na', label: 'No aplica', icon: 'slash' });

    defs.forEach(function (d) {
      btns.appendChild(el('button', {
        type: 'button',
        class: 'ck-btn' + (val === d.v ? ' is-on' : ''),
        'data-v': d.v,
        html: ico(d.icon, 18) + '<span>' + d.label + '</span>',
        onclick: function () {
          var cur = state.answers[f.id] || {};
          var next = cur.value === d.v ? '' : d.v;
          var record = { value: next, deviation: cur.deviation || null };
          if (next !== 'ko') record.deviation = null;
          else if (!record.deviation) record.deviation = emptyDeviation();
          setAnswer(f, record, { noRerender: true });
          rerenderFields();
        }
      }));
    });
    wrap.appendChild(btns);

    if (val === 'ko' && f.deviation && f.deviation.enabled !== false) {
      wrap.appendChild(deviationBox(f));
    }
    return wrap;
  }

  function emptyDeviation() {
    return {
      description: '', severityId: '', categoryId: '',
      photos: [], files: [],
      action: { title: '', responsible: '', dueDate: '' }
    };
  }

  function deviationBox(f) {
    var ans = state.answers[f.id];
    var d = ans.deviation = ans.deviation || emptyDeviation();

    var box = el('div', { class: 'deviation-box' });
    box.appendChild(el('div', { class: 'deviation-box__title', html: ico('alert', 15) + '<span>Desviación detectada</span>' }));

    var desc = el('textarea', { class: 'textarea', placeholder: 'Describe qué se ha observado, dónde y por qué no es conforme…' });
    desc.value = d.description || '';
    desc.addEventListener('input', function () { d.description = desc.value; touch(); });
    box.appendChild(UI.field('Descripción de la desviación', desc, null, true));

    var row = el('div', { class: 'grid-2' });
    row.appendChild(UI.field('Gravedad', catalogSelect('severity', d.severityId, function (v) { d.severityId = v; touch(); })));
    row.appendChild(UI.field('Categoría de riesgo', catalogSelect('category', d.categoryId, function (v) { d.categoryId = v; touch(); })));
    box.appendChild(row);

    // Evidencias
    box.appendChild(UI.field(
      'Evidencias' + (f.deviation.requirePhoto ? ' *' : ''),
      mediaControl(d, 'photos', true, 6),
      'Fotografía del punto o adjunta un documento.'
    ));

    // Acción correctora
    if (f.deviation.requireAction !== false) {
      d.action = d.action || { title: '', responsible: '', dueDate: '' };
      var accBox = el('div', { class: 'action-box' });
      accBox.appendChild(el('div', { class: 'action-box__title' }, [
        el('span', { html: ico('target', 14) }),
        el('span', { text: 'Acción correctora' })
      ]));
      var at = el('input', { class: 'input', value: d.action.title || '', placeholder: 'Qué hay que hacer para corregirlo' });
      at.addEventListener('input', function () { d.action.title = at.value; touch(); });
      accBox.appendChild(UI.field('Acción', at));

      var r2 = el('div', { class: 'grid-2' });
      var ar = el('input', { class: 'input', value: d.action.responsible || '', placeholder: 'Persona o departamento' });
      ar.addEventListener('input', function () { d.action.responsible = ar.value; touch(); });
      r2.appendChild(UI.field('Responsable', ar));
      var ad = el('input', { class: 'input', type: 'date', value: d.action.dueDate || '' });
      ad.addEventListener('input', function () { d.action.dueDate = ad.value; touch(); });
      r2.appendChild(UI.field('Fecha límite', ad));
      accBox.appendChild(r2);
      box.appendChild(accBox);
    }

    return box;
  }

  /* ---------- Evidencias (fotos y archivos) ---------- */

  function ctlMedia(f, isPhoto) {
    var key = isPhoto ? 'photos' : 'files';
    var holder = { };
    Object.defineProperty(holder, key, {
      get: function () { return state.answers[f.id] || []; },
      set: function (v) { setAnswer(f, v, { noRerender: true }); }
    });
    return mediaControl(holder, key, isPhoto, f.maxFiles || 5, f.multiple !== false);
  }

  function mediaControl(owner, key, isPhoto, max, multiple) {
    var grid = el('div', { class: 'media-grid' });

    function draw() {
      UI.clear(grid);
      var items = owner[key] || [];
      items.forEach(function (item, i) {
        var cell = el('div', { class: 'media-item' });
        if (item.kind === 'image' || (typeof item === 'string' && item.indexOf('data:image') === 0)) {
          var src = typeof item === 'string' ? item : item.data;
          cell.appendChild(el('img', { src: src, alt: 'Evidencia ' + (i + 1), loading: 'lazy' }));
          cell.addEventListener('click', function (e) {
            if (e.target.closest('.media-item__del')) return;
            lightbox(src);
          });
        } else {
          cell.appendChild(el('div', { class: 'media-item__file' }, [
            el('span', { html: ico('fileText', 22) }),
            el('span', { class: 'media-item__name', text: item.name || 'archivo' })
          ]));
          cell.addEventListener('click', function (e) {
            if (e.target.closest('.media-item__del')) return;
            if (item.data) UI.download(item.name || 'adjunto', dataURLtoBlob(item.data));
          });
        }
        cell.appendChild(el('button', {
          class: 'media-item__del', type: 'button', title: 'Quitar', html: ico('x', 13),
          onclick: function (e) {
            e.stopPropagation();
            var arr = (owner[key] || []).slice();
            arr.splice(i, 1);
            owner[key] = arr;
            touch();
            draw();
          }
        }));
        grid.appendChild(cell);
      });

      if (items.length < max) {
        var input = el('input', {
          type: 'file',
          accept: isPhoto ? 'image/*' : '*/*',
          multiple: multiple !== false,
          style: { display: 'none' }
        });
        if (isPhoto) input.setAttribute('capture', 'environment');
        input.addEventListener('change', function () {
          handleFiles(Array.prototype.slice.call(input.files));
          input.value = '';
        });
        var add = el('button', {
          class: 'media-add', type: 'button',
          html: ico(isPhoto ? 'camera' : 'paperclip', 21) + '<span>' + (isPhoto ? 'Foto' : 'Archivo') + '</span>',
          onclick: function () { input.click(); }
        });
        grid.appendChild(add);
        grid.appendChild(input);
      }
    }

    function handleFiles(files) {
      var arr = (owner[key] || []).slice();
      var room = max - arr.length;
      if (files.length > room) {
        UI.toast('Solo caben ' + room + ' ' + UI.plural(room, 'archivo') + ' más.', 'info');
        files = files.slice(0, room);
      }
      var jobs = files.map(function (file) {
        if (file.type.indexOf('image/') === 0) {
          return Store.compressImage(file).then(function (data) {
            return { kind: 'image', name: file.name, data: data };
          });
        }
        if (file.size > 3 * 1024 * 1024) {
          UI.toast('«' + file.name + '» supera 3 MB y no se ha adjuntado.', 'err');
          return Promise.resolve(null);
        }
        return Store.readFileAsDataURL(file).then(function (data) {
          return { kind: 'file', name: file.name, type: file.type, data: data };
        });
      });
      Promise.all(jobs).then(function (results) {
        results.forEach(function (r) { if (r) arr.push(r); });
        owner[key] = arr;
        touch();
        draw();
      });
    }

    draw();
    return grid;
  }

  function lightbox(src) {
    UI.modal({
      title: 'Evidencia fotográfica',
      size: 'wide',
      body: el('div', { style: { textAlign: 'center', paddingBottom: '10px' } },
        el('img', { src: src, style: { maxWidth: '100%', maxHeight: '68vh', borderRadius: '12px' } })),
      buttons: [
        { label: 'Descargar', kind: 'ghost', icon: 'download', onClick: function () {
          UI.download('evidencia.jpg', dataURLtoBlob(src));
        } },
        { label: 'Cerrar', kind: 'navy' }
      ]
    });
  }

  function dataURLtoBlob(dataURL) {
    var parts = String(dataURL).split(',');
    var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'application/octet-stream';
    var bin = atob(parts[1] || '');
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  /* ---------- Firma táctil ---------- */

  function ctlSignature(f) {
    var wrap = el('div');
    var pad = el('div', { class: 'sign-pad' });
    var canvas = el('canvas');
    var ph = el('div', { class: 'sign-pad__ph' }, el('div', {}, [
      el('div', { html: ico('signature', 24), style: { display: 'flex', justifyContent: 'center' } }),
      el('div', { text: 'Firma aquí con el dedo o el ratón' })
    ]));
    pad.appendChild(canvas);
    pad.appendChild(ph);
    wrap.appendChild(pad);

    var actions = el('div', { class: 'sign-actions' }, [
      el('button', {
        class: 'btn btn--ghost btn--sm', type: 'button',
        html: ico('refresh', 15) + '<span>Borrar firma</span>',
        onclick: function () { clearPad(); setAnswer(f, '', { noRerender: true }); }
      })
    ]);
    wrap.appendChild(actions);

    var ctx, drawing = false, last = null, dpr = window.devicePixelRatio || 1;

    function setup() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width) { setTimeout(setup, 60); return; }
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(168 * dpr);
      ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#141B3D';
      var saved = state.answers[f.id];
      if (saved) {
        var img = new Image();
        img.onload = function () { ctx.drawImage(img, 0, 0, rect.width, 168); };
        img.src = saved;
        pad.classList.add('has-ink');
      }
    }

    function pos(e) {
      var r = canvas.getBoundingClientRect();
      var p = e.touches ? e.touches[0] : e;
      return { x: p.clientX - r.left, y: p.clientY - r.top };
    }

    function down(e) {
      e.preventDefault();
      drawing = true;
      last = pos(e);
      pad.classList.add('has-ink');
    }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      var p = pos(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
    }
    function up() {
      if (!drawing) return;
      drawing = false;
      try { setAnswer(f, canvas.toDataURL('image/png'), { noRerender: true }); } catch (e) {}
    }

    function clearPad() {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pad.classList.remove('has-ink');
    }

    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('touchstart', down, { passive: false });
    window.addEventListener('mousemove', move);
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    canvas.addEventListener('touchend', up);

    setTimeout(setup, 30);
    return wrap;
  }

  /* ======================================================================
     Puntuación, guardado y cierre
     ====================================================================== */

  function computeScore() {
    var ok = 0, ko = 0, na = 0;
    (state.form.fields || []).forEach(function (f) {
      if (f.type !== 'checkitem') return;
      if (!Builder.isVisible(f, state.answers)) return;
      var v = (state.answers[f.id] || {}).value;
      if (v === 'ok') ok++;
      else if (v === 'ko') ko++;
      else if (v === 'na') na++;
    });
    var base = ok + ko;
    return { ok: ok, ko: ko, na: na, total: base, pct: base ? Math.round(ok / base * 100) : 0 };
  }

  /**
   * Resume en la propia visita qué elementos de cada tipología se han
   * seleccionado. Sin este índice, el dashboard tendría que abrir cada
   * formulario y recorrer sus campos para poder filtrar.
   */
  function computeDimensions() {
    var dims = {};
    var mails = [];

    // Se acumula sin sustituir: si un cuestionario usa la misma tipología en
    // la cabecera y en un módulo, ambas selecciones son ciertas y las dos
    // deben poder encontrarse al filtrar.
    function addDim(listId, ids) {
      if (!listId || !ids || !ids.length) return;
      var bucket = dims[listId] || (dims[listId] = []);
      ids.forEach(function (id) {
        if (id && bucket.indexOf(id) === -1) bucket.push(id);
      });
    }

    (state.form.fields || []).forEach(function (f) {
      if (f.type !== 'listpick' || !f.listId) return;
      if (!Builder.isVisible(f, state.answers)) return;
      var a = state.answers[f.id];
      if (!a || !a.ids) return;

      var l = Store.list(f.listId);
      if (l) addDim(l.id, a.ids);
      if (a.childId && l && l.childListId) addDim(l.childListId, [a.childId]);

      collectEmails(f, a).forEach(function (m) {
        if (mails.indexOf(m) === -1) mails.push(m);
      });
    });

    // La ubicación de la cabecera también es dimensión de análisis
    var centerList = Store.listBySystem('center');
    var areaList = Store.listBySystem('area');
    if (centerList) addDim(centerList.id, [state.visit.centerId]);
    if (areaList) addDim(areaList.id, [state.visit.areaId]);

    return { dimensions: dims, emails: mails };
  }

  function applyDerived() {
    var d = computeDimensions();
    state.visit.dimensions = d.dimensions;
    state.visit.extraEmails = d.emails;
  }

  function saveDraft(notify) {
    if (state.mode === 'preview') return;
    state.visit.answers = state.answers;
    state.visit.score = computeScore();
    applyDerived();
    if (!state.visit.status) state.visit.status = 'draft';
    Store.put('visits', state.visit);
    state.dirty = false;
    if (notify) UI.toast('Borrador guardado. Puedes continuar más tarde.');
    App.refreshBadges();
  }

  function validate() {
    var missing = [];
    (state.form.fields || []).forEach(function (f) {
      if (!Builder.isQuestion(f) || !Builder.isVisible(f, state.answers)) return;
      if (f.required && !hasAnswer(f)) { missing.push(f.label); return; }
      if (f.required && f.type === 'listpick' && f.cascade !== false && f.listId) {
        var l = Store.list(f.listId);
        var a = state.answers[f.id] || {};
        // Solo se exige la subtipología si el elemento elegido tiene alguna
        if (l && l.childListId && a.ids && a.ids[0] && !a.childId) {
          if (Store.listItems(l.childListId, a.ids[0]).length) {
            missing.push(f.label + ' → ' + (f.childLabel || Store.list(l.childListId).name));
          }
        }
      }
      if (f.type === 'checkitem') {
        var a = state.answers[f.id] || {};
        if (a.value === 'ko' && f.deviation && f.deviation.enabled !== false) {
          var d = a.deviation || {};
          if (!d.description || !d.description.trim()) missing.push(f.label + ' → descripción de la desviación');
          if (f.deviation.requirePhoto && !(d.photos || []).length) missing.push(f.label + ' → fotografía obligatoria');
        }
      }
    });
    if (!state.visit.inspector || !state.visit.inspector.trim()) missing.unshift('Inspector');
    return missing;
  }

  function finish() {
    if (state.mode === 'preview') return;
    var missing = validate();
    if (missing.length) {
      UI.modal({
        title: 'Faltan datos obligatorios',
        subtitle: 'Completa estos puntos antes de cerrar la visita:',
        icon: 'alert', iconKind: 'danger',
        body: el('ul', { style: { margin: '0 0 6px', paddingLeft: '20px', lineHeight: '1.85', fontSize: '14px' } },
          missing.slice(0, 12).map(function (m) { return el('li', { text: m }); })
            .concat(missing.length > 12 ? [el('li', { text: 'y ' + (missing.length - 12) + ' más…', style: { color: 'var(--ink-3)' } })] : [])),
        buttons: [{ label: 'Entendido', kind: 'navy' }]
      });
      return;
    }

    var wasCompleted = state.visit.status === 'completed';
    state.visit.answers = state.answers;
    state.visit.score = computeScore();
    applyDerived();
    state.visit.status = 'completed';
    state.visit.completedAt = state.visit.completedAt || Store.nowISO();
    Store.put('visits', state.visit);

    syncDeviations(state.visit);
    App.refreshBadges();

    var s = state.visit.score;
    UI.modal({
      title: wasCompleted ? 'Cambios guardados' : 'Visita finalizada',
      subtitle: state.visit.code + ' · ' + state.form.name,
      icon: 'checkCircle', iconKind: s.ko ? 'danger' : 'navy',
      body: resultBody(s),
      buttons: [
        { label: 'Ver visitas', kind: 'quiet', onClick: function () { App.go('historico'); } },
        { label: 'Descargar PDF', kind: 'ghost', icon: 'filePdf', onClick: function () {
          PDF.generate(state.visit.id, { download: true }); return false;
        } },
        (state.form.emails && state.form.emails.length)
          ? { label: 'Enviar por correo', kind: 'primary', icon: 'send', onClick: function () {
              PDF.sendByEmail(state.visit.id); App.go('historico');
            } }
          : { label: 'Terminar', kind: 'primary', onClick: function () { App.go('historico'); } }
      ]
    });
  }

  function resultBody(s) {
    var box = el('div', { style: { paddingBottom: '8px' } });
    box.appendChild(el('div', { class: 'kpis', style: { marginBottom: '0', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' } }, [
      kpiMini('Conformes', UI.num(s.ok), 'var(--ok)'),
      kpiMini('Desviaciones', UI.num(s.ko), 'var(--coral-dark)'),
      kpiMini('% conforme', UI.pct(s.pct), s.pct >= 90 ? 'var(--ok)' : s.pct >= 70 ? 'var(--warn)' : 'var(--coral-dark)')
    ]));
    if (s.ko) {
      box.appendChild(el('div', {
        class: 'hint', style: { marginTop: '14px' },
        text: 'Se han registrado ' + UI.num(s.ko) + ' ' + UI.plural(s.ko, 'desviación', 'desviaciones') +
          ' y sus acciones correctoras. Las encontrarás en Desviaciones y en el Plan de acción.'
      }));
    }
    return box;
  }

  function kpiMini(label, value, color) {
    return el('div', { style: { background: 'var(--surface)', borderRadius: '12px', padding: '13px', textAlign: 'center' } }, [
      el('div', { style: { fontSize: '25px', fontWeight: '700', color: color, letterSpacing: '-.03em' }, text: String(value) }),
      el('div', { style: { fontSize: '11.5px', color: 'var(--ink-3)', fontWeight: '600', marginTop: '3px' }, text: label })
    ]);
  }

  /**
   * Reconstruye las desviaciones y acciones derivadas de una visita.
   * Se ejecuta también al reeditar: las que desaparecen se borran, y las
   * acciones ya cerradas conservan su estado y notas.
   */
  function syncDeviations(visit) {
    var form = visit.formSnapshot || Store.get('forms', visit.formId) || { fields: [] };
    var existing = Store.query('deviations', function (d) { return d.visitId === visit.id; });
    var byField = {};
    existing.forEach(function (d) { byField[d.fieldId] = d; });
    var keep = {};

    (form.fields || []).forEach(function (f) {
      if (f.type !== 'checkitem') return;
      var a = visit.answers[f.id];
      if (!a || a.value !== 'ko') return;
      if (!Builder.isVisible(f, visit.answers)) return;
      var d = a.deviation || {};

      var rec = byField[f.id] || { id: Store.uid('dev') };
      rec.visitId = visit.id;
      rec.visitCode = visit.code;
      rec.formId = visit.formId;
      rec.formName = visit.formName;
      rec.fieldId = f.id;
      rec.question = f.label;
      rec.description = d.description || '';
      rec.severityId = d.severityId || '';
      rec.categoryId = d.categoryId || '';
      rec.centerId = visit.centerId || '';
      rec.areaId = visit.areaId || '';
      rec.dimensions = visit.dimensions || {};
      rec.inspector = visit.inspector || '';
      rec.date = visit.date;
      rec.photos = (d.photos || []).filter(function (p) { return p && p.kind === 'image'; }).map(function (p) { return p.data; });
      if (!rec.status) rec.status = 'open';
      Store.put('deviations', rec);
      keep[rec.id] = true;

      // Acción correctora asociada
      var act = Store.query('actions', function (x) { return x.deviationId === rec.id; })[0];
      var ad = d.action || {};
      if (ad.title || ad.responsible || ad.dueDate) {
        act = act || { id: Store.uid('act'), status: 'open', notes: '' };
        act.deviationId = rec.id;
        act.visitId = visit.id;
        act.visitCode = visit.code;
        act.title = ad.title || rec.question;
        act.responsible = ad.responsible || '';
        act.dueDate = ad.dueDate || '';
        act.severityId = rec.severityId;
        act.categoryId = rec.categoryId;
        act.centerId = rec.centerId;
        act.areaId = rec.areaId;
        act.description = rec.description;
        Store.put('actions', act);
      } else if (act) {
        Store.remove('actions', act.id);
      }
    });

    // Elimina las desviaciones que ya no existen tras la reedición
    existing.forEach(function (d) {
      if (keep[d.id]) return;
      Store.query('actions', function (a) { return a.deviationId === d.id; })
        .forEach(function (a) { Store.remove('actions', a.id); });
      Store.remove('deviations', d.id);
    });
  }

  function exit() {
    if (state.dirty) {
      UI.confirm({
        title: 'Salir sin guardar',
        text: 'Hay cambios sin guardar en esta visita. ¿Quieres guardarlos como borrador antes de salir?',
        confirmLabel: 'Guardar y salir',
        cancelLabel: 'Salir sin guardar',
        danger: false,
        icon: 'save'
      }).then(function (saveIt) {
        if (saveIt) saveDraft(true);
        App.go(state.visit.status === 'completed' ? 'historico' : 'cuestionarios');
      });
    } else {
      App.go(state.visit.status === 'completed' ? 'historico' : 'cuestionarios');
    }
  }

  /* ---------- Exposición ---------- */

  global.Runner = {
    start: start,
    preview: preview,
    syncDeviations: syncDeviations,
    dataURLtoBlob: dataURLtoBlob
  };
})(window);
