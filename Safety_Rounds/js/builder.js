/* ==========================================================================
   Safety Rounds — Constructor de cuestionarios
   Módulos arrastrables · lienzo reordenable · panel de propiedades · lógica IF
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el, esc = UI.esc;

  /* ======================================================================
     Registro de tipos de campo
     ====================================================================== */

  var FIELD_TYPES = {
    /* --- Estructura --- */
    title: {
      label: 'Título', icon: 'heading', group: 'Estructura', structural: true,
      defaults: function () { return { label: 'Título de sección' }; },
      preview: function (f) { return '<div class="fld__title-preview">' + esc(f.label) + '</div>'; }
    },
    subtitle: {
      label: 'Subtítulo', icon: 'type', group: 'Estructura', structural: true,
      defaults: function () { return { label: 'Subtítulo' }; },
      preview: function (f) { return '<div class="fld__title-preview">' + esc(f.label) + '</div>'; }
    },
    paragraph: {
      label: 'Texto informativo', icon: 'text', group: 'Estructura', structural: true,
      defaults: function () { return { label: 'Instrucciones para el inspector', hint: '' }; },
      preview: function (f) { return '<div style="font-size:13px;color:var(--ink-2);line-height:1.55">' + esc(f.label) + '</div>'; }
    },
    divider: {
      label: 'Separador', icon: 'minus', group: 'Estructura', structural: true, noLabel: true,
      defaults: function () { return { label: 'Separador' }; },
      preview: function () { return '<hr style="border:none;border-top:2px dashed var(--line);margin:6px 0">'; }
    },

    /* --- Datos --- */
    fullname: {
      label: 'Nombre y apellidos', icon: 'user', group: 'Datos',
      defaults: function () { return { label: 'Nombre y apellidos', required: true }; },
      preview: function () { return ghost('Nombre Apellido1 Apellido2'); }
    },
    date: {
      label: 'Fecha', icon: 'calendar', group: 'Datos',
      defaults: function () { return { label: 'Fecha', required: true, defaultToday: true }; },
      preview: function () { return ghost('dd/mm/aaaa'); }
    },
    text: {
      label: 'Descripción corta', icon: 'minus', group: 'Datos',
      defaults: function () { return { label: 'Descripción corta' }; },
      preview: function (f) { return ghost(f.placeholder || 'Respuesta breve en una línea'); }
    },
    textarea: {
      label: 'Descripción larga', icon: 'text', group: 'Datos',
      defaults: function () { return { label: 'Descripción larga' }; },
      preview: function (f) { return ghost(f.placeholder || 'Texto extenso, varias líneas…', true); }
    },
    number: {
      label: 'Valor numérico', icon: 'hash', group: 'Datos',
      defaults: function () { return { label: 'Valor numérico', unit: '' }; },
      preview: function (f) { return ghost('0' + (f.unit ? ' ' + f.unit : '')); }
    },

    /* --- Respuestas --- */
    checkitem: {
      label: 'Punto de inspección', icon: 'shield', group: 'Respuestas', star: true,
      hasDeviation: true,
      defaults: function () {
        return {
          label: '¿El punto inspeccionado es correcto?',
          required: true,
          deviation: { enabled: true, requirePhoto: false, requireAction: true },
          allowNA: true
        };
      },
      preview: function () {
        return '<div class="checkitem__btns" style="pointer-events:none">' +
          '<div class="ck-btn" data-v="ok">' + ico('check', 17) + 'Correcto</div>' +
          '<div class="ck-btn" data-v="ko">' + ico('x', 17) + 'No correcto</div>' +
          '<div class="ck-btn" data-v="na">' + ico('slash', 17) + 'N/A</div>' +
          '</div>';
      }
    },
    radio: {
      label: 'Selector único', icon: 'radio', group: 'Respuestas', hasOptions: true,
      defaults: function () {
        return { label: 'Selecciona una opción', required: true, options: mkOpts(['Opción 1', 'Opción 2', 'Opción 3']) };
      },
      preview: function (f) { return optsPreview(f, 'r'); }
    },
    checkbox: {
      label: 'Multi selección', icon: 'checkSquare', group: 'Respuestas', hasOptions: true, multiValue: true,
      defaults: function () {
        return { label: 'Marca todas las que apliquen', options: mkOpts(['Opción 1', 'Opción 2', 'Opción 3']) };
      },
      preview: function (f) { return optsPreview(f, 'c'); }
    },
    select: {
      label: 'Lista desplegable', icon: 'dropdown', group: 'Respuestas', hasOptions: true,
      defaults: function () {
        return { label: 'Elige de la lista', options: mkOpts(['Opción 1', 'Opción 2']) };
      },
      preview: function (f) {
        return '<div class="fld__ghost">' + esc((f.options && f.options[0] && f.options[0].label) || 'Opción 1') +
          '<span style="margin-left:auto;color:#C4C9DE">' + ico('chevronDown', 15) + '</span></div>';
      }
    },
    listpick: {
      label: 'Selección de tipología', icon: 'database', group: 'Respuestas', star: true,
      usesList: true,
      defaults: function () {
        var first = Store.lists()[0];
        return {
          label: first ? first.name : 'Selección de tipología',
          required: false,
          listId: first ? first.id : null,
          multiple: false,
          cascade: true,
          childLabel: '',
          allowCreate: true,
          useEmailForReport: false
        };
      },
      preview: function (f) {
        var l = f.listId ? Store.list(f.listId) : null;
        if (!l) {
          return '<div class="fld__ghost" style="color:var(--coral-dark);border-color:#F8D4D4">' +
            'Sin tipología asignada — elígela en el panel de la derecha</div>';
        }
        var child = (f.cascade !== false && l.childListId) ? Store.list(l.childListId) : null;
        var n = Store.listItems(l.id).length;
        var rows = '<div class="fld__ghost">' + esc(l.name) +
          '<span style="margin-left:auto;color:#A7AEC8;font-size:12px">' +
          UI.num(n) + ' ' + (n === 1 ? 'elemento' : 'elementos') + '</span></div>';
        if (child) {
          rows += '<div class="fld__ghost" style="margin-top:5px;margin-left:16px;border-style:dashed">' +
            esc(f.childLabel || child.name) +
            '<span style="margin-left:auto;color:#A7AEC8;font-size:12px">en cascada</span></div>';
        }
        return rows;
      }
    },

    /* --- Evidencias --- */
    photo: {
      label: 'Realizar foto', icon: 'camera', group: 'Evidencias',
      defaults: function () { return { label: 'Fotografía', multiple: true, maxFiles: 6 }; },
      preview: function () { return mediaPreview('camera', 'Tomar foto'); }
    },
    file: {
      label: 'Adjuntar archivo', icon: 'paperclip', group: 'Evidencias',
      defaults: function () { return { label: 'Archivo adjunto', multiple: true, maxFiles: 5 }; },
      preview: function () { return mediaPreview('paperclip', 'Adjuntar'); }
    },
    signature: {
      label: 'Firmar con el dedo', icon: 'signature', group: 'Evidencias',
      defaults: function () { return { label: 'Firma del responsable', required: true }; },
      preview: function () {
        return '<div class="fld__ghost fld__ghost--tall" style="align-items:center;justify-content:center;height:66px">' +
          ico('signature', 20) + '<span style="margin-left:8px">Área de firma táctil</span></div>';
      }
    }
  };

  function ghost(txt, tall) {
    return '<div class="fld__ghost' + (tall ? ' fld__ghost--tall' : '') + '">' + esc(txt) + '</div>';
  }

  function mediaPreview(icon, txt) {
    return '<div style="display:flex;gap:8px"><div class="media-add" style="width:74px;aspect-ratio:1">' +
      ico(icon, 19) + '<span>' + esc(txt) + '</span></div></div>';
  }

  function optsPreview(f, shape) {
    var opts = (f.options || []).slice(0, 4);
    var html = opts.map(function (o) {
      return '<div class="fld__opt"><i class="' + shape + '"></i>' + esc(o.label) + '</div>';
    }).join('');
    if ((f.options || []).length > 4) {
      html += '<div class="fld__opt" style="color:var(--ink-3);font-size:12.5px;padding-left:23px">' +
        '+' + ((f.options || []).length - 4) + ' más</div>';
    }
    return '<div class="fld__opts">' + html + '</div>';
  }

  function mkOpts(labels) {
    return labels.map(function (l) { return { id: Store.uid('o'), label: l, color: '' }; });
  }

  var GROUPS = ['Respuestas', 'Datos', 'Evidencias', 'Estructura'];

  /* ======================================================================
     Evaluación de condiciones (lógica IF)
     ====================================================================== */

  var OPERATORS = [
    { value: 'eq', label: 'es igual a', needsValue: true },
    { value: 'neq', label: 'es distinto de', needsValue: true },
    { value: 'contains', label: 'incluye', needsValue: true },
    { value: 'filled', label: 'está contestado', needsValue: false },
    { value: 'blank', label: 'está sin contestar', needsValue: false },
    { value: 'gt', label: 'es mayor que', needsValue: true },
    { value: 'lt', label: 'es menor que', needsValue: true }
  ];

  function valueOf(answers, fieldId) {
    var a = answers[fieldId];
    if (a === undefined || a === null) return null;
    if (typeof a === 'object' && !Array.isArray(a)) {
      // checkitem guarda { value:'ok'|'ko'|'na', deviation:{...} }
      if ('value' in a) return a.value;
      // listpick guarda { ids:[...], childId:'' }: las condiciones se
      // escriben contra los nombres, que es lo que el usuario ve y elige
      if ('ids' in a) {
        var names = (a.ids || []).map(function (id) { return Store.catalogName(id, ''); });
        if (a.childId) names.push(Store.catalogName(a.childId, ''));
        names = names.filter(Boolean);
        if (!names.length) return null;
        return names.length === 1 ? names[0] : names;
      }
      return null;
    }
    return a;
  }

  function testRule(rule, answers) {
    var v = valueOf(answers, rule.fieldId);
    var target = rule.value;

    switch (rule.op) {
      case 'filled':
        return v !== null && v !== '' && !(Array.isArray(v) && !v.length);
      case 'blank':
        return v === null || v === '' || (Array.isArray(v) && !v.length);
      case 'eq':
        if (Array.isArray(v)) return v.indexOf(target) !== -1 && v.length === 1;
        return String(v) === String(target);
      case 'neq':
        if (Array.isArray(v)) return v.indexOf(target) === -1;
        return String(v) !== String(target);
      case 'contains':
        if (Array.isArray(v)) return v.indexOf(target) !== -1;
        return String(v == null ? '' : v).toLowerCase().indexOf(String(target).toLowerCase()) !== -1;
      case 'gt':
        return parseFloat(v) > parseFloat(target);
      case 'lt':
        return parseFloat(v) < parseFloat(target);
      default:
        return true;
    }
  }

  /**
   * ¿Debe mostrarse el campo con los valores actuales?
   * Sin condiciones configuradas, siempre visible.
   */
  function isVisible(field, answers) {
    var c = field.conditions;
    if (!c || !c.rules || !c.rules.length) return true;
    var results = c.rules.map(function (r) { return testRule(r, answers); });
    var pass = c.logic === 'any'
      ? results.some(Boolean)
      : results.every(Boolean);
    return c.action === 'hide' ? !pass : pass;
  }

  /* ======================================================================
     Estado del constructor
     ====================================================================== */

  var state = null; // { form, selectedId, dragging }

  function newForm() {
    return {
      id: null,
      name: 'Cuestionario sin título',
      description: '',
      folderId: null,
      color: '#1E2B6F',
      icon: 'clipboard',
      emails: [],
      autoSend: false,
      fields: [],
      archived: false
    };
  }

  function open(formId) {
    var form = formId ? Store.clone(Store.get('forms', formId)) : newForm();
    if (!form) { UI.toast('El cuestionario ya no existe.', 'err'); App.go('configuracion'); return; }
    if (!form.fields) form.fields = [];
    state = { form: form, selectedId: null, isNew: !formId };
    render();
  }

  function selected() {
    if (!state.selectedId) return null;
    return state.form.fields.filter(function (f) { return f.id === state.selectedId; })[0] || null;
  }

  /* ======================================================================
     Render principal
     ====================================================================== */

  function render() {
    var view = UI.$('#view');
    view.className = 'view view--flush';
    UI.clear(view);

    App.setHeader(
      state.isNew ? 'Nuevo cuestionario' : 'Editar cuestionario',
      state.form.fields.length + ' ' + UI.plural(state.form.fields.length, 'módulo') +
      (state.form.fields.filter(isQuestion).length ? ' · ' + state.form.fields.filter(isQuestion).length + ' preguntas' : ''),
      [
        el('button', {
          class: 'btn btn--ghost btn--sm', html: ico('eye', 16) + '<span>Vista previa</span>',
          onclick: preview
        }),
        el('button', {
          class: 'btn btn--quiet btn--sm', title: 'Cancelar',
          html: ico('x', 16) + '<span>Cancelar</span>',
          onclick: function () { App.go('configuracion'); }
        }),
        el('button', {
          class: 'btn btn--primary btn--sm', html: ico('save', 16) + '<span>Guardar</span>',
          onclick: save
        })
      ]
    );

    var wrap = el('div', { class: 'builder' });
    wrap.appendChild(renderPalette());
    wrap.appendChild(renderCanvas());
    wrap.appendChild(renderProps());
    view.appendChild(wrap);

    // En móvil la paleta y el panel de propiedades son cajones laterales:
    // sin estos botones no habría forma de abrirlos.
    view.appendChild(el('div', { class: 'builder__fab show-sm' }, [
      el('button', {
        class: 'btn btn--navy', html: ico('sliders', 17) + '<span>Propiedades</span>',
        onclick: function () { toggleDrawer('.builder__props'); }
      }),
      el('button', {
        class: 'btn btn--primary', html: ico('plus', 17) + '<span>Módulos</span>',
        onclick: function () { toggleDrawer('.builder__palette'); }
      })
    ]));
  }

  var drawerScrim = null;

  function toggleDrawer(sel) {
    var node = UI.$(sel);
    if (!node) return;
    if (node.classList.contains('is-open')) { closeDrawers(); return; }
    openDrawer(sel);
  }

  function openDrawer(sel) {
    var node = UI.$(sel);
    if (!node) return;
    closeDrawers();
    node.classList.add('is-open');
    drawerScrim = el('div', { class: 'scrim', onclick: closeDrawers });
    document.body.appendChild(drawerScrim);
  }

  function closeDrawers() {
    UI.$$('.builder__palette, .builder__props').forEach(function (n) { n.classList.remove('is-open'); });
    if (drawerScrim && drawerScrim.parentNode) drawerScrim.parentNode.removeChild(drawerScrim);
    drawerScrim = null;
  }

  function isQuestion(f) {
    var t = FIELD_TYPES[f.type];
    return t && !t.structural;
  }

  function refresh() {
    var canvas = UI.$('.builder__canvas');
    var props = UI.$('.builder__props');
    if (!canvas || !props) { render(); return; }
    var wasOpen = props.classList.contains('is-open');
    canvas.parentNode.replaceChild(renderCanvas(), canvas);
    var np = renderProps();
    if (wasOpen) np.classList.add('is-open');
    props.parentNode.replaceChild(np, props);
    App.setSubtitle(state.form.fields.length + ' ' + UI.plural(state.form.fields.length, 'módulo') +
      (state.form.fields.filter(isQuestion).length ? ' · ' + state.form.fields.filter(isQuestion).length + ' preguntas' : ''));
  }

  /* ---------- Paleta de módulos ---------- */

  function renderPalette() {
    var col = el('aside', { class: 'builder__col builder__palette' });

    col.appendChild(el('button', {
      class: 'btn btn--quiet btn--sm show-sm',
      style: { marginBottom: '10px' },
      html: ico('x', 15) + '<span>Cerrar</span>',
      onclick: closeDrawers
    }));

    col.appendChild(el('div', {
      style: { fontSize: '12.5px', color: 'var(--ink-3)', lineHeight: '1.5', marginBottom: '14px' },
      html: 'Arrastra un módulo al formulario, o pulsa sobre él para añadirlo al final.'
    }));

    GROUPS.forEach(function (g) {
      var keys = Object.keys(FIELD_TYPES).filter(function (k) { return FIELD_TYPES[k].group === g; });
      if (!keys.length) return;
      var grp = el('div', { class: 'palette-group' }, [el('div', { class: 'palette-group__title', text: g })]);
      keys.forEach(function (k) {
        var t = FIELD_TYPES[k];
        var mod = el('div', {
          class: 'mod' + (t.star ? ' mod--star' : ''),
          draggable: 'true',
          title: t.star ? 'Correcto / No correcto / N/A con apertura automática de desviación' : t.label,
          html: '<span class="mod__icon">' + ico(t.icon, 15) + '</span><span>' + esc(t.label) + '</span>'
        });
        mod.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/plain', 'new:' + k);
          e.dataTransfer.effectAllowed = 'copy';
          mod.classList.add('is-dragging');
        });
        mod.addEventListener('dragend', function () { mod.classList.remove('is-dragging'); });
        mod.addEventListener('click', function () { addField(k); });
        grp.appendChild(mod);
      });
      col.appendChild(grp);
    });

    return col;
  }

  /* ---------- Lienzo ---------- */

  function renderCanvas() {
    var col = el('section', { class: 'builder__col builder__canvas' });
    var sheet = el('div', { class: 'canvas-sheet' });

    // Cabecera editable del cuestionario
    var nameInput = el('input', {
      class: 'canvas-head__name', value: state.form.name, placeholder: 'Nombre del cuestionario',
      maxlength: 90,
      oninput: function () { state.form.name = nameInput.value; }
    });
    var descInput = el('input', {
      class: 'canvas-head__desc', value: state.form.description || '',
      placeholder: 'Descripción o alcance del cuestionario (opcional)', maxlength: 180,
      oninput: function () { state.form.description = descInput.value; }
    });
    sheet.appendChild(el('div', { class: 'canvas-head' }, [nameInput, descInput]));

    var zone = el('div', { class: 'drop-zone' });

    if (!state.form.fields.length) {
      zone.appendChild(el('div', {
        class: 'drop-hint',
        html: '<div style="margin-bottom:8px;display:flex;justify-content:center;color:var(--navy-soft)">' + ico('move', 26) + '</div>' +
          '<strong>Arrastra módulos aquí</strong><br>Empieza por un <em>Punto de inspección</em>: es el módulo que genera desviaciones y alimenta el dashboard.'
      }));
    } else {
      state.form.fields.forEach(function (f, i) {
        zone.appendChild(renderFieldCard(f, i));
      });
    }

    // Drop
    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = e.dataTransfer.types.indexOf('text/plain') !== -1 ? 'move' : 'copy';
      zone.classList.add('is-over');
      showDropLine(zone, e.clientY);
    });
    zone.addEventListener('dragleave', function (e) {
      if (!zone.contains(e.relatedTarget)) { zone.classList.remove('is-over'); hideDropLine(); }
    });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('is-over');
      var idx = dropIndex(zone, e.clientY);
      hideDropLine();
      var data = e.dataTransfer.getData('text/plain') || '';
      if (data.indexOf('new:') === 0) addField(data.slice(4), idx);
      else if (data.indexOf('move:') === 0) moveField(data.slice(5), idx);
    });

    sheet.appendChild(zone);
    col.appendChild(sheet);
    return col;
  }

  var dropLine = null;

  function showDropLine(zone, y) {
    var idx = dropIndex(zone, y);
    if (!dropLine) dropLine = el('div', { class: 'drop-line' });
    var cards = UI.$$('.fld', zone);
    if (idx >= cards.length) zone.appendChild(dropLine);
    else zone.insertBefore(dropLine, cards[idx]);
  }

  function hideDropLine() {
    if (dropLine && dropLine.parentNode) dropLine.parentNode.removeChild(dropLine);
  }

  function dropIndex(zone, y) {
    var cards = UI.$$('.fld', zone);
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return cards.length;
  }

  function renderFieldCard(f, index) {
    var t = FIELD_TYPES[f.type] || FIELD_TYPES.text;
    var card = el('div', {
      class: 'fld fld--' + f.type + (state.selectedId === f.id ? ' is-selected' : ''),
      'data-id': f.id,
      draggable: 'true',
      onclick: function (e) {
        if (e.target.closest('.fld__tool')) return;
        select(f.id);
      }
    });

    card.appendChild(el('span', { class: 'fld__grip', html: ico('grip', 15) }));

    var tools = el('div', { class: 'fld__tools' });
    if (index > 0) {
      tools.appendChild(el('button', {
        class: 'fld__tool', title: 'Subir', html: ico('arrowUp', 14),
        onclick: function (e) { e.stopPropagation(); moveField(f.id, index - 1); }
      }));
    }
    if (index < state.form.fields.length - 1) {
      tools.appendChild(el('button', {
        class: 'fld__tool', title: 'Bajar', html: ico('arrowDown', 14),
        onclick: function (e) { e.stopPropagation(); moveField(f.id, index + 2); }
      }));
    }
    tools.appendChild(el('button', {
      class: 'fld__tool', title: 'Duplicar', html: ico('copy', 14),
      onclick: function (e) { e.stopPropagation(); duplicateField(f.id); }
    }));
    tools.appendChild(el('button', {
      class: 'fld__tool fld__tool--del', title: 'Eliminar', html: ico('trash', 14),
      onclick: function (e) { e.stopPropagation(); deleteField(f.id); }
    }));
    card.appendChild(tools);

    if (!t.noLabel && f.type !== 'title' && f.type !== 'subtitle' && f.type !== 'paragraph') {
      var lbl = el('div', { class: 'fld__label' }, [
        el('span', { html: esc(f.label) + (f.required ? '<span style="color:var(--coral-dark)"> *</span>' : '') })
      ]);
      if (f.conditions && f.conditions.rules && f.conditions.rules.length) {
        lbl.appendChild(el('span', {
          class: 'fld__if', title: 'Este módulo solo aparece si se cumplen ciertas condiciones',
          html: ico('zap', 11) + 'IF'
        }));
      }
      if (f.type === 'checkitem' && f.deviation && f.deviation.enabled) {
        lbl.appendChild(el('span', {
          class: 'fld__if', style: { background: 'var(--navy-wash)', color: 'var(--navy)' },
          title: 'Al marcar «No correcto» se abre el bloque de desviación',
          html: ico('alert', 11) + 'DESVIACIÓN'
        }));
      }
      card.appendChild(lbl);
    }

    card.appendChild(el('div', { class: 'fld__preview', html: t.preview(f) }));
    if (f.hint) card.appendChild(el('div', { class: 'hint', text: f.hint }));

    card.addEventListener('dragstart', function (e) {
      e.dataTransfer.setData('text/plain', 'move:' + f.id);
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(function () { card.classList.add('is-dragging'); }, 0);
    });
    card.addEventListener('dragend', function () { card.classList.remove('is-dragging'); hideDropLine(); });

    return card;
  }

  /* ---------- Operaciones sobre campos ---------- */

  function addField(type, index) {
    var t = FIELD_TYPES[type];
    if (!t) return;
    var f = Object.assign({
      id: Store.uid('f'),
      type: type,
      label: t.label,
      hint: '',
      required: false,
      conditions: null
    }, t.defaults());
    if (index === undefined || index === null || index > state.form.fields.length) index = state.form.fields.length;
    state.form.fields.splice(index, 0, f);
    state.selectedId = f.id;
    refresh();
    setTimeout(function () {
      var node = UI.$('.fld[data-id="' + f.id + '"]');
      if (node) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (window.innerWidth <= 1080) openDrawer('.builder__props');
    }, 40);
  }

  function moveField(id, toIndex) {
    var from = -1;
    state.form.fields.forEach(function (f, i) { if (f.id === id) from = i; });
    if (from === -1) return;
    var f = state.form.fields.splice(from, 1)[0];
    if (toIndex > from) toIndex--;
    if (toIndex < 0) toIndex = 0;
    if (toIndex > state.form.fields.length) toIndex = state.form.fields.length;
    state.form.fields.splice(toIndex, 0, f);
    refresh();
  }

  function duplicateField(id) {
    var idx = -1, src = null;
    state.form.fields.forEach(function (f, i) { if (f.id === id) { idx = i; src = f; } });
    if (!src) return;
    var copy = Store.clone(src);
    copy.id = Store.uid('f');
    copy.label = src.label + ' (copia)';
    if (copy.options) copy.options = copy.options.map(function (o) { return { id: Store.uid('o'), label: o.label, color: o.color }; });
    copy.conditions = null; // una copia con las mismas condiciones casi nunca es lo que se quiere
    state.form.fields.splice(idx + 1, 0, copy);
    state.selectedId = copy.id;
    refresh();
  }

  function deleteField(id) {
    var f = state.form.fields.filter(function (x) { return x.id === id; })[0];
    if (!f) return;
    // Aviso si otros campos dependen de éste
    var deps = state.form.fields.filter(function (x) {
      return x.conditions && (x.conditions.rules || []).some(function (r) { return r.fieldId === id; });
    });
    var doDelete = function () {
      state.form.fields = state.form.fields.filter(function (x) { return x.id !== id; });
      state.form.fields.forEach(function (x) {
        if (x.conditions) {
          x.conditions.rules = (x.conditions.rules || []).filter(function (r) { return r.fieldId !== id; });
          if (!x.conditions.rules.length) x.conditions = null;
        }
      });
      if (state.selectedId === id) state.selectedId = null;
      refresh();
    };
    if (deps.length) {
      UI.confirm({
        title: 'Eliminar «' + f.label + '»',
        text: 'Hay ' + deps.length + ' ' + UI.plural(deps.length, 'módulo') + ' con condiciones IF que dependen de éste. Se eliminarán también esas condiciones.',
        confirmLabel: 'Eliminar igualmente'
      }).then(function (ok) { if (ok) doDelete(); });
    } else {
      doDelete();
    }
  }

  function select(id) {
    state.selectedId = id;
    refresh();
    if (window.innerWidth <= 1080) openDrawer('.builder__props');
  }

  /* ======================================================================
     Panel de propiedades
     ====================================================================== */

  function renderProps() {
    var col = el('aside', { class: 'builder__col builder__props' });
    var f = selected();

    if (window.innerWidth <= 1080) {
      col.appendChild(el('button', {
        class: 'btn btn--quiet btn--sm', style: { marginBottom: '10px' },
        html: ico('x', 15) + '<span>Cerrar panel</span>',
        onclick: closeDrawers
      }));
    }

    if (!f) {
      col.appendChild(formProps());
      return col;
    }

    var t = FIELD_TYPES[f.type];

    col.appendChild(el('div', {
      style: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '16px' }
    }, [
      el('span', { class: 'mod__icon', html: ico(t.icon, 15) }),
      el('div', {}, [
        el('div', { style: { fontSize: '14px', fontWeight: '700' }, text: t.label }),
        el('div', { style: { fontSize: '11.5px', color: 'var(--ink-3)' }, text: 'Propiedades del módulo' })
      ])
    ]));

    // Etiqueta / texto
    var labelInput = el(f.type === 'paragraph' ? 'textarea' : 'input', {
      class: f.type === 'paragraph' ? 'textarea' : 'input',
      value: f.label,
      oninput: function () { f.label = labelInput.value; refreshCanvasOnly(); }
    });
    if (f.type === 'paragraph') labelInput.value = f.label;
    col.appendChild(UI.field(
      f.type === 'title' || f.type === 'subtitle' ? 'Texto' :
      f.type === 'paragraph' ? 'Contenido' : 'Pregunta o etiqueta',
      labelInput
    ));

    if (!t.structural) {
      var hintInput = el('input', {
        class: 'input', value: f.hint || '', placeholder: 'Aclaración bajo la pregunta',
        oninput: function () { f.hint = hintInput.value; refreshCanvasOnly(); }
      });
      col.appendChild(UI.field('Texto de ayuda', hintInput));

      var reqSwitch = mkSwitch('Respuesta obligatoria', !!f.required, function (v) {
        f.required = v; refreshCanvasOnly();
      });
      col.appendChild(el('div', { class: 'field' }, reqSwitch));
    }

    if (f.type === 'text' || f.type === 'textarea') {
      var ph = el('input', {
        class: 'input', value: f.placeholder || '', placeholder: 'Texto de ejemplo dentro del campo',
        oninput: function () { f.placeholder = ph.value; refreshCanvasOnly(); }
      });
      col.appendChild(UI.field('Marcador de posición', ph));
    }

    if (f.type === 'number') {
      var unit = el('input', {
        class: 'input', value: f.unit || '', placeholder: 'lux, dB, ºC, m…',
        oninput: function () { f.unit = unit.value; refreshCanvasOnly(); }
      });
      col.appendChild(UI.field('Unidad', unit));
    }

    if (f.type === 'date') {
      col.appendChild(el('div', { class: 'field' }, mkSwitch('Rellenar con la fecha de hoy', f.defaultToday !== false, function (v) {
        f.defaultToday = v;
      })));
    }

    if (f.type === 'photo' || f.type === 'file') {
      col.appendChild(el('div', { class: 'field' }, mkSwitch('Permitir varios archivos', f.multiple !== false, function (v) {
        f.multiple = v;
      })));
      var maxF = el('input', {
        class: 'input', type: 'number', min: '1', max: '20', value: f.maxFiles || 5,
        oninput: function () { f.maxFiles = Math.max(1, Math.min(20, parseInt(maxF.value, 10) || 5)); }
      });
      col.appendChild(UI.field('Máximo de archivos', maxF));
    }

    /* --- Opciones --- */
    if (t.hasOptions) {
      var sec = el('div', { class: 'props-section' }, [
        el('div', { class: 'props-section__title', text: 'Opciones de respuesta' })
      ]);
      var list = el('div');
      (f.options || []).forEach(function (o, i) {
        var row = el('div', { class: 'opt-row' });
        var inp = el('input', {
          class: 'input', value: o.label,
          oninput: function () { o.label = inp.value; refreshCanvasOnly(); }
        });
        row.appendChild(inp);
        row.appendChild(el('button', {
          class: 'opt-row__del', title: 'Quitar opción', html: ico('trash', 15),
          onclick: function () {
            f.options.splice(i, 1);
            refresh();
          }
        }));
        list.appendChild(row);
      });
      sec.appendChild(list);
      sec.appendChild(el('button', {
        class: 'btn btn--ghost btn--sm btn--block', style: { marginTop: '8px' },
        html: ico('plus', 15) + '<span>Añadir opción</span>',
        onclick: function () {
          f.options = f.options || [];
          f.options.push({ id: Store.uid('o'), label: 'Opción ' + (f.options.length + 1), color: '' });
          refresh();
        }
      }));
      col.appendChild(sec);
    }

    /* --- Selección de tipología --- */
    if (t.usesList) {
      col.appendChild(listProps(f));
    }

    /* --- Punto de inspección: bloque de desviación --- */
    if (t.hasDeviation) {
      f.deviation = f.deviation || { enabled: true, requirePhoto: false, requireAction: true };
      var dsec = el('div', { class: 'props-section' }, [
        el('div', { class: 'props-section__title', text: 'Al responder «No correcto»' })
      ]);
      dsec.appendChild(el('div', {
        class: 'hint', style: { marginBottom: '12px', marginTop: '-4px' },
        text: 'Esta es la lógica IF principal: se despliega automáticamente un bloque para describir la desviación, clasificarla y adjuntar evidencias.'
      }));
      dsec.appendChild(el('div', { class: 'field' }, mkSwitch('Abrir bloque de desviación', f.deviation.enabled !== false, function (v) {
        f.deviation.enabled = v; refreshCanvasOnly();
      })));
      dsec.appendChild(el('div', { class: 'field' }, mkSwitch('Exigir al menos una foto', !!f.deviation.requirePhoto, function (v) {
        f.deviation.requirePhoto = v;
      })));
      dsec.appendChild(el('div', { class: 'field' }, mkSwitch('Exigir acción correctora', f.deviation.requireAction !== false, function (v) {
        f.deviation.requireAction = v;
      })));
      dsec.appendChild(el('div', { class: 'field' }, mkSwitch('Permitir «No aplica»', f.allowNA !== false, function (v) {
        f.allowNA = v; refreshCanvasOnly();
      })));
      col.appendChild(dsec);
    }

    /* --- Condiciones IF --- */
    col.appendChild(renderConditions(f));

    return col;
  }

  /* ---------- Propiedades del módulo de tipología ---------- */

  function listProps(f) {
    var sec = el('div', { class: 'props-section' }, [
      el('div', { class: 'props-section__title', html: ico('database', 12) + '<span>Tipología</span>' })
    ]);

    var all = Store.lists();
    // Una lista hija no se ofrece suelta: se alcanza en cascada desde su madre
    var selectable = all.filter(function (l) { return !Store.parentListOf(l.id); });

    if (!selectable.length) {
      sec.appendChild(el('div', { class: 'hint', style: { marginBottom: '10px' }, text: 'Todavía no has creado ninguna tipología.' }));
      sec.appendChild(el('button', {
        class: 'btn btn--ghost btn--sm btn--block',
        html: ico('plus', 15) + '<span>Crear una en Ajustes</span>',
        onclick: function () { App.go('ajustes'); }
      }));
      return sec;
    }

    var sel = UI.selectFrom(
      [{ value: '', label: 'Selecciona una tipología…' }].concat(
        selectable.map(function (l) {
          var kids = l.childListId ? Store.list(l.childListId) : null;
          return { value: l.id, label: l.name + (kids ? ' → ' + kids.name : '') };
        })),
      f.listId || '', { class: 'select' });
    sel.addEventListener('change', function () {
      f.listId = sel.value || null;
      var l = f.listId ? Store.list(f.listId) : null;
      // Al cambiar de tipología, la etiqueta por defecto acompaña al cambio
      if (l && (!f.label || selectable.some(function (x) { return x.name === f.label; }))) f.label = l.name;
      refresh();
    });
    sec.appendChild(UI.field('Lista de origen', sel));

    var l = f.listId ? Store.list(f.listId) : null;
    if (!l) return sec;

    var items = Store.listItems(l.id);
    sec.appendChild(el('div', {
      class: 'hint', style: { marginTop: '-8px', marginBottom: '13px' },
      text: UI.num(items.length) + ' ' + UI.plural(items.length, 'elemento') + ' disponibles. Se gestionan en Ajustes y datos.'
    }));

    var child = l.childListId ? Store.list(l.childListId) : null;
    if (child) {
      sec.appendChild(el('div', { class: 'field' }, mkSwitch('Mostrar «' + child.name + '» en cascada', f.cascade !== false, function (v) {
        f.cascade = v; refresh();
      })));
      if (f.cascade !== false) {
        var cl = el('input', {
          class: 'input', value: f.childLabel || '', placeholder: child.name,
          oninput: function () { f.childLabel = cl.value; refreshCanvasOnly(); }
        });
        sec.appendChild(UI.field('Etiqueta del segundo desplegable', cl));
      }
    }

    // La selección múltiple y la cascada no se combinan: con varias madres
    // elegidas, el segundo desplegable no sabría de cuál colgar.
    var canMultiple = !child || f.cascade === false;
    if (canMultiple) {
      sec.appendChild(el('div', { class: 'field' }, mkSwitch('Permitir seleccionar varios', !!f.multiple, function (v) {
        f.multiple = v; refreshCanvasOnly();
      })));
    } else if (f.multiple) {
      f.multiple = false;
    }

    sec.appendChild(el('div', { class: 'field' }, mkSwitch('Permitir crear elementos desde la visita', f.allowCreate !== false, function (v) {
      f.allowCreate = v;
    })));

    var withEmail = items.filter(function (c) { return c.email; }).length;
    var emailSwitch = el('div', { class: 'field' });
    emailSwitch.appendChild(mkSwitch('Añadir su correo a los destinatarios del informe', !!f.useEmailForReport, function (v) {
      f.useEmailForReport = v;
    }));
    emailSwitch.appendChild(el('div', {
      class: 'hint', style: { marginTop: '7px' },
      text: withEmail
        ? UI.num(withEmail) + ' de ' + UI.num(items.length) + ' elementos tienen correo registrado.'
        : 'Ningún elemento de esta lista tiene correo todavía: añádelos en Ajustes y datos.'
    }));
    sec.appendChild(emailSwitch);

    if (l.analysable) {
      sec.appendChild(el('div', {
        class: 'hint',
        style: { background: 'var(--navy-wash)', color: 'var(--navy)', borderRadius: '9px', padding: '10px 12px' },
        html: ico('barChart', 12) + ' <span style="vertical-align:1px">Esta tipología es dimensión de análisis: lo que se responda aquí se podrá filtrar en el Dashboard.</span>'
      }));
    }

    return sec;
  }

  function refreshCanvasOnly() {
    var canvas = UI.$('.builder__canvas');
    if (!canvas) return;
    var scroll = canvas.scrollTop;
    canvas.parentNode.replaceChild(renderCanvas(), canvas);
    UI.$('.builder__canvas').scrollTop = scroll;
  }

  function mkSwitch(text, checked, onChange) {
    var input = el('input', { type: 'checkbox', checked: checked || false });
    input.addEventListener('change', function () { onChange(input.checked); });
    return el('label', { class: 'switch' }, [
      input,
      el('span', { class: 'switch__track' }),
      el('span', { class: 'switch__text', text: text })
    ]);
  }

  /* ---------- Editor de condiciones ---------- */

  function renderConditions(f) {
    var sec = el('div', { class: 'props-section' });
    sec.appendChild(el('div', { class: 'props-section__title', html: ico('zap', 12) + ' Lógica condicional (IF)' }));

    // Campos anteriores que pueden usarse como origen de la condición
    var myIndex = state.form.fields.indexOf(f);
    var sources = state.form.fields.slice(0, myIndex).filter(function (x) {
      var t = FIELD_TYPES[x.type];
      return t && !t.structural;
    });

    if (!sources.length) {
      sec.appendChild(el('div', {
        class: 'hint',
        text: 'Coloca este módulo debajo de otra pregunta para poder condicionarlo a la respuesta de ésta.'
      }));
      return sec;
    }

    if (!f.conditions || !f.conditions.rules || !f.conditions.rules.length) {
      sec.appendChild(el('div', {
        class: 'hint', style: { marginBottom: '10px' },
        text: 'Este módulo se muestra siempre. Añade una condición para que solo aparezca en determinados casos.'
      }));
      sec.appendChild(el('button', {
        class: 'btn btn--ghost btn--sm btn--block',
        html: ico('plus', 15) + '<span>Añadir condición</span>',
        onclick: function () {
          var src = sources[sources.length - 1];
          f.conditions = {
            action: 'show', logic: 'all',
            rules: [{ fieldId: src.id, op: defaultOp(src), value: defaultValue(src) }]
          };
          refresh();
        }
      }));
      return sec;
    }

    var actionSel = UI.selectFrom([
      { value: 'show', label: 'Mostrar este módulo' },
      { value: 'hide', label: 'Ocultar este módulo' }
    ], f.conditions.action || 'show', { class: 'select select--sm' });
    actionSel.addEventListener('change', function () { f.conditions.action = actionSel.value; refreshCanvasOnly(); });
    sec.appendChild(UI.field('Acción', actionSel));

    if (f.conditions.rules.length > 1) {
      var logicSel = UI.selectFrom([
        { value: 'all', label: 'Si se cumplen TODAS las condiciones' },
        { value: 'any', label: 'Si se cumple ALGUNA condición' }
      ], f.conditions.logic || 'all', { class: 'select select--sm' });
      logicSel.addEventListener('change', function () { f.conditions.logic = logicSel.value; });
      sec.appendChild(UI.field('Combinación', logicSel));
    }

    f.conditions.rules.forEach(function (rule, i) {
      sec.appendChild(renderRule(f, rule, i, sources));
    });

    sec.appendChild(el('button', {
      class: 'btn btn--ghost btn--sm btn--block', style: { marginTop: '4px' },
      html: ico('plus', 15) + '<span>Otra condición</span>',
      onclick: function () {
        var src = sources[sources.length - 1];
        f.conditions.rules.push({ fieldId: src.id, op: defaultOp(src), value: defaultValue(src) });
        refresh();
      }
    }));

    return sec;
  }

  function renderRule(f, rule, i, sources) {
    var box = el('div', { class: 'rule' });
    box.appendChild(el('div', { class: 'rule__head' }, [
      el('span', { class: 'rule__num', text: 'CONDICIÓN ' + (i + 1) }),
      el('button', {
        class: 'rule__del', title: 'Quitar', html: ico('x', 14),
        onclick: function () {
          f.conditions.rules.splice(i, 1);
          if (!f.conditions.rules.length) f.conditions = null;
          refresh();
        }
      })
    ]));

    var fieldSel = UI.selectFrom(sources.map(function (s) {
      return { value: s.id, label: truncate(s.label, 42) };
    }), rule.fieldId, { class: 'select select--sm' });
    fieldSel.addEventListener('change', function () {
      rule.fieldId = fieldSel.value;
      var src = byId(rule.fieldId);
      rule.op = defaultOp(src);
      rule.value = defaultValue(src);
      refresh();
    });
    box.appendChild(fieldSel);

    var src = byId(rule.fieldId);
    var ops = availableOps(src);
    var opSel = UI.selectFrom(ops.map(function (o) { return { value: o.value, label: o.label }; }),
      rule.op, { class: 'select select--sm' });
    opSel.addEventListener('change', function () {
      rule.op = opSel.value;
      refresh();
    });
    box.appendChild(opSel);

    var opDef = OPERATORS.filter(function (o) { return o.value === rule.op; })[0];
    if (opDef && opDef.needsValue) {
      box.appendChild(valueControl(src, rule));
    }

    return box;
  }

  function valueControl(src, rule) {
    if (!src) return el('input', { class: 'input input--sm', value: rule.value || '' });

    if (src.type === 'checkitem') {
      var opts = [
        { value: 'ok', label: 'Correcto' },
        { value: 'ko', label: 'No correcto' }
      ];
      if (src.allowNA !== false) opts.push({ value: 'na', label: 'No aplica' });
      var s = UI.selectFrom(opts, rule.value, { class: 'select select--sm' });
      s.addEventListener('change', function () { rule.value = s.value; });
      return s;
    }

    if (src.type === 'listpick' && src.listId) {
      var l = Store.list(src.listId);
      var opts = l ? Store.listItems(l.id).map(function (c) { return { value: c.name, label: c.name }; }) : [];
      if (l && l.childListId && src.cascade !== false) {
        Store.listItems(l.childListId).forEach(function (c) {
          opts.push({ value: c.name, label: '   ↳ ' + c.name });
        });
      }
      var s3 = UI.selectFrom(opts.length ? opts : [{ value: '', label: 'La lista está vacía' }],
        rule.value, { class: 'select select--sm' });
      s3.addEventListener('change', function () { rule.value = s3.value; });
      return s3;
    }

    if (FIELD_TYPES[src.type] && FIELD_TYPES[src.type].hasOptions) {
      var s2 = UI.selectFrom((src.options || []).map(function (o) {
        return { value: o.label, label: o.label };
      }), rule.value, { class: 'select select--sm' });
      s2.addEventListener('change', function () { rule.value = s2.value; });
      return s2;
    }

    var inp = el('input', {
      class: 'input input--sm',
      type: src.type === 'number' ? 'number' : src.type === 'date' ? 'date' : 'text',
      value: rule.value || '', placeholder: 'Valor'
    });
    inp.addEventListener('input', function () { rule.value = inp.value; });
    return inp;
  }

  function availableOps(src) {
    if (!src) return OPERATORS;
    var t = FIELD_TYPES[src.type] || {};
    if (src.type === 'checkitem') return pick(['eq', 'neq']);
    if (src.type === 'listpick') {
      return src.multiple ? pick(['contains', 'filled', 'blank'])
                          : pick(['eq', 'neq', 'contains', 'filled', 'blank']);
    }
    if (t.multiValue) return pick(['contains', 'filled', 'blank']);
    if (t.hasOptions) return pick(['eq', 'neq', 'filled', 'blank']);
    if (src.type === 'number') return pick(['eq', 'neq', 'gt', 'lt', 'filled', 'blank']);
    if (src.type === 'date') return pick(['eq', 'gt', 'lt', 'filled', 'blank']);
    return pick(['contains', 'eq', 'neq', 'filled', 'blank']);
  }

  function pick(keys) {
    return OPERATORS.filter(function (o) { return keys.indexOf(o.value) !== -1; });
  }

  function defaultOp(src) {
    return availableOps(src)[0].value;
  }

  function defaultValue(src) {
    if (!src) return '';
    if (src.type === 'checkitem') return 'ko';
    if (src.type === 'listpick') {
      var first = src.listId ? Store.listItems(src.listId)[0] : null;
      return first ? first.name : '';
    }
    if (FIELD_TYPES[src.type] && FIELD_TYPES[src.type].hasOptions && src.options && src.options[0]) {
      return src.options[0].label;
    }
    return '';
  }

  function byId(id) {
    return state.form.fields.filter(function (f) { return f.id === id; })[0] || null;
  }

  function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /* ---------- Propiedades del cuestionario ---------- */

  function formProps() {
    var box = el('div');
    box.appendChild(el('div', {
      style: { fontSize: '14px', fontWeight: '700', marginBottom: '3px' }, text: 'Ajustes del cuestionario'
    }));
    box.appendChild(el('div', {
      class: 'hint', style: { marginBottom: '16px' },
      text: 'Selecciona un módulo del formulario para editar sus propiedades.'
    }));

    // Carpeta
    var folders = Store.all('folders').sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    var folderSel = UI.selectFrom(
      [{ value: '', label: 'Sin carpeta' }].concat(folders.map(function (f) { return { value: f.id, label: f.name }; })),
      state.form.folderId || '', { class: 'select' }
    );
    folderSel.addEventListener('change', function () { state.form.folderId = folderSel.value || null; });
    box.appendChild(UI.field('Carpeta', folderSel));

    // Color
    var colorRow = el('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap' } });
    ['#1E2B6F', '#2E3D8A', '#4356AE', '#F16B6B', '#E05C5C', '#178A6B', '#C77A10', '#6B4EA8'].forEach(function (c) {
      var b = el('button', {
        style: {
          width: '30px', height: '30px', borderRadius: '9px', background: c,
          border: state.form.color === c ? '2.5px solid var(--ink)' : '2.5px solid transparent',
          boxShadow: '0 0 0 1px var(--line)'
        },
        title: c,
        onclick: function () { state.form.color = c; refresh(); }
      });
      colorRow.appendChild(b);
    });
    box.appendChild(UI.field('Color identificativo', colorRow));

    // Emails destino
    var sec = el('div', { class: 'props-section' }, [
      el('div', { class: 'props-section__title', html: ico('mail', 12) + ' Envío del PDF' })
    ]);
    var emailsInput = el('textarea', {
      class: 'textarea', style: { minHeight: '72px' },
      placeholder: 'prevencion@empresa.com, direccion@empresa.com',
      value: (state.form.emails || []).join(', ')
    });
    emailsInput.addEventListener('input', function () {
      state.form.emails = emailsInput.value.split(/[,;\n]/)
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length > 3 && s.indexOf('@') > 0; });
    });
    sec.appendChild(UI.field('Correos destinatarios', emailsInput,
      'Separa varias direcciones con comas. Al cerrar una visita se ofrecerá enviarles el PDF.'));
    sec.appendChild(el('div', { class: 'field' }, mkSwitch('Proponer el envío al cerrar la visita',
      !!state.form.autoSend, function (v) { state.form.autoSend = v; })));
    box.appendChild(sec);

    // Resumen
    var qCount = state.form.fields.filter(isQuestion).length;
    var ciCount = state.form.fields.filter(function (f) { return f.type === 'checkitem'; }).length;
    var ifCount = state.form.fields.filter(function (f) { return f.conditions && f.conditions.rules && f.conditions.rules.length; }).length;
    var sum = el('div', { class: 'props-section' }, [
      el('div', { class: 'props-section__title', text: 'Resumen' })
    ]);
    [
      ['Módulos totales', state.form.fields.length],
      ['Preguntas', qCount],
      ['Puntos de inspección', ciCount],
      ['Módulos condicionados', ifCount]
    ].forEach(function (r) {
      sum.appendChild(el('div', {
        style: { display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', padding: '5px 0', borderBottom: '1px solid var(--line-soft)' }
      }, [
        el('span', { style: { color: 'var(--ink-2)' }, text: r[0] }),
        el('strong', { text: String(r[1]) })
      ]));
    });
    box.appendChild(sum);

    return box;
  }

  /* ======================================================================
     Guardar y vista previa
     ====================================================================== */

  function save() {
    var f = state.form;
    if (!f.name || !f.name.trim()) {
      UI.toast('Ponle un nombre al cuestionario.', 'err');
      var i = UI.$('.canvas-head__name'); if (i) i.focus();
      return;
    }
    if (!f.fields.length) {
      UI.toast('Añade al menos un módulo antes de guardar.', 'err');
      return;
    }
    f.name = f.name.trim();
    if (!f.id) f.id = Store.uid('form');
    Store.put('forms', f);
    UI.toast('Cuestionario «' + f.name + '» guardado.');
    App.go('configuracion');
  }

  function preview() {
    if (!state.form.fields.length) { UI.toast('Añade módulos para poder previsualizar.', 'info'); return; }
    Runner.preview(state.form);
  }

  /* ---------- Exposición ---------- */

  global.Builder = {
    open: open,
    FIELD_TYPES: FIELD_TYPES,
    OPERATORS: OPERATORS,
    isVisible: isVisible,
    isQuestion: isQuestion,
    valueOf: valueOf
  };
})(window);
