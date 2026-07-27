/* ==========================================================================
   Safety Rounds — Ajustes y datos
   Identidad del departamento · tipologías · centros y áreas · copias de seguridad
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el, esc = UI.esc;

  // Descripción de las listas de sistema: su papel en la aplicación no es
  // evidente por el nombre, así que se explica en la propia tarjeta.
  var SYSTEM_HINTS = {
    severity: 'Cómo de grave es una desviación. Ej.: Crítica, Alta, Media, Baja.',
    category: 'Tipo de riesgo al que corresponde. Ej.: EPIs, Orden y limpieza, Riesgo eléctrico.',
    center: 'Emplazamientos donde se realizan las inspecciones.',
    area: 'Subdivisiones dentro de cada centro. Ej.: Almacén, Taller, Muelle de carga.'
  };

  // Tipología abierta en la vista de detalle; null = listado general
  var detailId = null;

  function render() {
    var view = UI.$('#view');
    view.className = 'view';
    UI.clear(view);

    if (detailId && !Store.list(detailId)) detailId = null;
    if (detailId) { renderDetail(view); return; }

    App.setHeader('Ajustes y datos', 'Identidad, tipologías y copias de seguridad', [
      el('button', {
        class: 'btn btn--ghost btn--sm', html: ico('plus', 16) + '<span>Nueva tipología</span>',
        onclick: function () { editList(null); }
      }),
      el('button', {
        class: 'btn btn--ghost btn--sm', html: ico('download', 16) + '<span>Copia de seguridad</span>',
        onclick: backup
      })
    ]);

    view.appendChild(brandCard());
    view.appendChild(listsSection());
    view.appendChild(el('div', { style: { height: '15px' } }));
    view.appendChild(dataCard());
  }

  function openDetail(id) {
    detailId = id;
    window.scrollTo(0, 0);
    render();
  }

  function backToList() {
    detailId = null;
    window.scrollTo(0, 0);
    render();
  }

  /* ======================================================================
     Tipologías · listado
     ====================================================================== */

  function listsSection() {
    var wrap = el('div', { style: { marginTop: '18px' } });

    wrap.appendChild(el('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '13px', flexWrap: 'wrap' } }, [
      el('div', { style: { flex: '1', minWidth: '260px' } }, [
        el('div', { style: { fontSize: '16px', fontWeight: '700', letterSpacing: '-.02em' }, text: 'Tipologías' }),
        el('div', { class: 'card__sub', text: 'Listas reutilizables que puedes insertar en cualquier cuestionario con el módulo «Selección de tipología».' })
      ]),
      el('button', {
        class: 'btn btn--primary btn--sm', html: ico('plus', 16) + '<span>Nueva tipología</span>',
        onclick: function () { editList(null); }
      })
    ]));

    // Las subtipologías no aparecen sueltas: se gestionan dentro de su madre
    var all = Store.lists();
    var childIds = {};
    all.forEach(function (l) { if (l.childListId) childIds[l.childListId] = true; });
    var top = all.filter(function (l) { return !childIds[l.id]; });

    var card = el('div', { class: 'card' });
    var body = el('div', { class: 'card__body', style: { padding: '10px' } });
    top.forEach(function (l) { body.appendChild(listRow(l)); });
    card.appendChild(body);
    wrap.appendChild(card);
    return wrap;
  }

  function listRow(l) {
    var child = l.childListId ? Store.list(l.childListId) : null;
    var n = Store.listItems(l.id).length;
    var childN = child ? Store.listItems(child.id).length : 0;

    var meta = [UI.num(n) + ' ' + UI.plural(n, 'elemento')];
    if (child) meta.push(child.name + ': ' + UI.num(childN));

    var row = el('button', {
      type: 'button', class: 'list-row',
      onclick: function () { openDetail(l.id); }
    });

    row.appendChild(el('span', {
      class: 'list-row__icon',
      style: { background: UI.withAlpha(l.color, .13), color: l.color },
      html: ico(l.icon || 'list', 17)
    }));

    row.appendChild(el('span', { class: 'list-row__main' }, [
      el('span', { class: 'list-row__name' }, [
        el('span', { text: l.name }),
        l.system ? el('span', { class: 'tag', title: 'La aplicación depende de esta tipología: puedes ampliarla y renombrarla, pero no eliminarla.', text: 'De sistema' }) : null,
        l.analysable ? el('span', { class: 'tag tag--navy', title: 'Aparece como filtro en el Dashboard', html: ico('barChart', 12) + 'Análisis' }) : null,
        child ? el('span', { class: 'tag', title: 'Tiene subtipología', html: ico('layers', 12) + esc(child.name) }) : null
      ]),
      el('span', { class: 'list-row__meta', text: meta.join(' · ') })
    ]));

    row.appendChild(el('span', { class: 'list-row__chev', html: ico('chevronRight', 17) }));
    return row;
  }

  /* ======================================================================
     Tipologías · detalle
     ====================================================================== */

  function renderDetail(view) {
    var l = Store.list(detailId);
    var child = l.childListId ? Store.list(l.childListId) : null;

    App.setHeader(l.name, SYSTEM_HINTS[l.system] || 'Tipología', [
      el('button', {
        class: 'btn btn--quiet btn--sm', html: ico('arrowLeft', 16) + '<span>Tipologías</span>',
        onclick: backToList
      }),
      el('button', {
        class: 'btn btn--ghost btn--sm', html: ico('sliders', 16) + '<span>Configurar</span>',
        onclick: function () { editList(l); }
      })
    ]);

    var wrap = el('div', { style: { maxWidth: '760px' } });

    // Tarjeta de la tipología madre
    var card = el('div', { class: 'card' });
    card.appendChild(head(l.name, describeList(l, child), l.icon || 'list'));
    var body = el('div', { class: 'card__body' });

    var items = Store.listItems(l.id);
    if (!items.length) {
      body.appendChild(el('div', {
        class: 'hint', style: { marginBottom: '12px', padding: '14px', background: 'var(--surface)', borderRadius: '10px' },
        text: 'Todavía no hay elementos. También puedes crearlos sobre la marcha desde una visita.'
      }));
    }
    items.forEach(function (c) { body.appendChild(itemRow(l, c)); });
    body.appendChild(addRow(l, null));
    card.appendChild(body);
    wrap.appendChild(card);

    // Subtipología: agrupada por el elemento del que cuelga
    if (child) {
      var sub = el('div', { class: 'card', style: { marginTop: '15px' } });
      sub.appendChild(el('div', { class: 'card__head' }, [
        el('span', {
          style: { width: '30px', height: '30px', borderRadius: '9px', display: 'grid', placeItems: 'center', flex: 'none', background: UI.withAlpha(child.color, .13), color: child.color },
          html: ico(child.icon || 'mapPin', 16)
        }),
        el('div', { style: { minWidth: '0' } }, [
          el('div', { class: 'card__title', text: child.name }),
          el('div', { class: 'card__sub', text: 'Cada elemento pertenece a un ' + singular(l.name) + '. En los cuestionarios solo se ofrecen los del que se haya elegido.' })
        ]),
        el('button', {
          class: 'btn btn--ghost btn--sm btn--icon', title: 'Configurar la subtipología', html: ico('sliders', 15),
          onclick: function () { editList(child); }
        })
      ]));

      var sbody = el('div', { class: 'card__body' });
      if (!items.length) {
        sbody.appendChild(el('div', { class: 'hint', text: 'Añade antes al menos un elemento a «' + l.name + '».' }));
      } else {
        items.forEach(function (parent) {
          sbody.appendChild(el('div', {
            style: { fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-3)', margin: '16px 0 7px' },
            text: parent.name
          }));
          Store.listItems(child.id, parent.id).forEach(function (k) { sbody.appendChild(itemRow(child, k)); });
          sbody.appendChild(addRow(child, parent.id));
        });

        var orphans = Store.listItems(child.id).filter(function (k) { return !k.parentId; });
        if (orphans.length) {
          sbody.appendChild(el('div', {
            style: { fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--coral-dark)', margin: '18px 0 7px' },
            text: 'Sin asignar'
          }));
          sbody.appendChild(el('div', { class: 'hint', style: { marginBottom: '9px' }, text: 'Ábrelos con el lápiz para indicar a qué ' + singular(l.name) + ' pertenecen.' }));
          orphans.forEach(function (k) { sbody.appendChild(itemRow(child, k)); });
        }
      }
      sub.appendChild(sbody);
      wrap.appendChild(sub);
    }

    view.appendChild(wrap);
  }

  function describeList(l, child) {
    if (SYSTEM_HINTS[l.system]) return SYSTEM_HINTS[l.system];
    if (child) return 'Cada elemento agrupa los de «' + child.name + '»';
    return 'Tipología personalizada';
  }

  function singular(name) {
    var n = String(name || '').toLowerCase();
    if (/^centros e instalaciones$/.test(n)) return 'centro';
    if (/s$/.test(n)) return n.replace(/\s+y\s+.*$/, '').replace(/s$/, '');
    return n;
  }

  function itemRow(l, c) {
    var extras = [c.role, c.email, c.phone].filter(Boolean);
    var row = el('div', { class: 'cat-item' });

    var swatch = el('input', { type: 'color', class: 'opt-row__color', value: c.color || '#4356AE', title: 'Color' });
    swatch.addEventListener('change', function () { c.color = swatch.value; Store.put('catalogs', c); });
    row.appendChild(swatch);

    row.appendChild(el('span', { style: { flex: '1', minWidth: '0' } }, [
      el('div', { class: 'cat-item__name', text: c.name }),
      extras.length ? el('div', {
        style: { fontSize: '11.5px', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        text: extras.join(' · ')
      }) : null
    ]));

    var used = countUsage(c.id);
    if (used) row.appendChild(el('span', { class: 'cat-item__use', title: 'Veces que se ha usado', text: UI.num(used) + '×' }));

    row.appendChild(el('button', {
      class: 'opt-row__del', title: 'Editar elemento', html: ico('edit', 15),
      onclick: function () { editItem(l, c); }
    }));
    row.appendChild(el('button', {
      class: 'opt-row__del', title: 'Eliminar', html: ico('trash', 15),
      onclick: function () { removeItem(c, used); }
    }));
    return row;
  }

  function addRow(l, parentId) {
    var input = el('input', { class: 'input input--sm', placeholder: 'Añadir a ' + l.name.toLowerCase() + '…' });
    function doAdd() {
      var v = input.value.trim();
      if (!v) return;
      Store.addItem(l.id, { name: v, color: defaultColor(l, Store.listItems(l.id).length), parentId: parentId });
      input.value = '';
      render();
      UI.toast('«' + v + '» añadido.');
    }
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doAdd(); });
    return el('div', { class: 'cat-add' }, [
      input,
      el('button', { class: 'btn btn--ghost btn--sm btn--icon', html: ico('plus', 16), onclick: doAdd, title: 'Añadir' })
    ]);
  }

  /* ---------- Alta y edición de una tipología ---------- */

  function editList(l) {
    var isNew = !l;
    var draft = l ? Store.clone(l) : { name: '', color: '#4356AE', icon: 'list', analysable: false, childListId: null };

    var name = el('input', { class: 'input', value: draft.name, placeholder: 'Ej.: Responsables de departamento' });
    if (draft.system) name.value = draft.name;

    var body = el('div', { style: { paddingBottom: '6px' } });
    body.appendChild(UI.field('Nombre de la tipología', name, null, true));

    // Color
    var colorRow = el('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap' } });
    ['#1E2B6F', '#2E3D8A', '#4356AE', '#F16B6B', '#E05C5C', '#178A6B', '#C77A10', '#6B4EA8'].forEach(function (c) {
      var b = el('button', {
        type: 'button',
        style: {
          width: '30px', height: '30px', borderRadius: '9px', background: c,
          border: draft.color === c ? '2.5px solid var(--ink)' : '2.5px solid transparent',
          boxShadow: '0 0 0 1px var(--line)'
        },
        onclick: function () {
          draft.color = c;
          UI.$$('button', colorRow).forEach(function (x, i) {
            x.style.border = x.style.backgroundColor === hexToRgbCss(c) ? '2.5px solid var(--ink)' : '2.5px solid transparent';
          });
        }
      });
      colorRow.appendChild(b);
    });
    body.appendChild(UI.field('Color', colorRow));

    // Dimensión de análisis
    var anaWrap = el('div', { class: 'field' });
    anaWrap.appendChild(mkSwitch('Usar como dimensión de análisis', !!draft.analysable, function (v) { draft.analysable = v; }));
    anaWrap.appendChild(el('div', { class: 'hint', style: { marginTop: '7px' }, text: 'Añade un filtro por esta tipología en el Dashboard y una columna en las exportaciones.' }));
    body.appendChild(anaWrap);

    // Lista hija
    var candidates = Store.lists().filter(function (x) {
      if (l && x.id === l.id) return false;                 // no puede ser hija de sí misma
      if (x.system === 'severity' || x.system === 'category') return false;
      var p = Store.parentListOf(x.id);
      return !p || (l && p.id === l.id);                    // libre, o ya es hija de esta
    });
    var childSel = UI.selectFrom(
      [{ value: '', label: 'Ninguna' }].concat(candidates.map(function (x) { return { value: x.id, label: x.name }; })),
      draft.childListId || '', { class: 'select' });
    childSel.addEventListener('change', function () { draft.childListId = childSel.value || null; });
    body.appendChild(UI.field('Subtipología', childSel,
      'Los elementos de la subtipología cuelgan de un elemento de ésta. Ejemplo: cada instalación agrupa solo sus propias zonas.'));

    if (isNew) {
      body.appendChild(el('div', {
        class: 'hint', style: { background: 'var(--surface)', borderRadius: '10px', padding: '12px 14px' },
        text: 'Si quieres una subtipología, créala primero como tipología independiente y después selecciónala aquí.'
      }));
    }

    var buttons = [{ label: 'Cancelar', kind: 'quiet' }];
    if (l && !l.system) {
      buttons.push({
        label: 'Eliminar', kind: 'danger', icon: 'trash',
        onClick: function () { confirmRemoveList(l); }
      });
    }
    buttons.push({
      label: isNew ? 'Crear tipología' : 'Guardar', kind: 'primary', icon: isNew ? 'plus' : 'save',
      onClick: function () {
        var v = name.value.trim();
        if (!v) { UI.toast('Ponle un nombre a la tipología.', 'err'); return false; }
        if (isNew) {
          Store.addList({ name: v, color: draft.color, analysable: draft.analysable, childListId: draft.childListId });
        } else {
          l.name = v;
          l.color = draft.color;
          l.analysable = draft.analysable;
          l.childListId = draft.childListId;
          Store.put('lists', l);
        }
        UI.toast(isNew ? 'Tipología «' + v + '» creada.' : 'Tipología actualizada.');
        render();
      }
    });

    UI.modal({
      title: isNew ? 'Nueva tipología' : draft.name,
      subtitle: l && l.system ? 'Lista de sistema: puedes ampliarla y renombrarla, pero no eliminarla.' : 'Lista reutilizable en los cuestionarios',
      icon: 'layers',
      body: body,
      footSplit: !!(l && !l.system),
      buttons: buttons
    });
  }

  function hexToRgbCss(hex) {
    var c = hex.replace('#', '');
    return 'rgb(' + parseInt(c.slice(0, 2), 16) + ', ' + parseInt(c.slice(2, 4), 16) + ', ' + parseInt(c.slice(4, 6), 16) + ')';
  }

  function confirmRemoveList(l) {
    var items = Store.listItems(l.id).length;
    var child = l.childListId ? Store.list(l.childListId) : null;
    var usedInForms = formsUsing(l.id);

    var text = 'Se eliminará la tipología y sus ' + UI.num(items) + ' ' + UI.plural(items, 'elemento') + '.';
    if (child) text += ' También se eliminará su subtipología «' + child.name + '».';
    if (usedInForms.length) {
      text += ' Hay ' + UI.num(usedInForms.length) + ' ' + UI.plural(usedInForms.length, 'cuestionario') +
        ' que la usan: sus módulos dejarán de funcionar hasta que los reasignes.';
    }

    UI.confirm({
      title: 'Eliminar «' + l.name + '»',
      text: text,
      confirmLabel: 'Eliminar tipología'
    }).then(function (ok) {
      if (!ok) return;
      Store.removeList(l.id);
      UI.toast('Tipología eliminada.');
      render();
    });
  }

  function formsUsing(listId) {
    return Store.all('forms').filter(function (f) {
      return (f.fields || []).some(function (x) { return x.type === 'listpick' && x.listId === listId; });
    });
  }

  /* ---------- Alta y edición de un elemento ---------- */

  function editItem(l, c) {
    var name = el('input', { class: 'input', value: c.name });
    var role = el('input', { class: 'input', value: c.role || '', placeholder: 'Ej.: Jefe de planta' });
    var email = el('input', { class: 'input', type: 'email', value: c.email || '', placeholder: 'nombre@empresa.com' });
    var phone = el('input', { class: 'input', value: c.phone || '', placeholder: 'Opcional' });
    var notes = el('textarea', { class: 'textarea', style: { minHeight: '70px' } });
    notes.value = c.notes || '';

    var body = el('div', { style: { paddingBottom: '6px' } }, [
      UI.field('Nombre', name, null, true),
      el('div', { class: 'grid-2' }, [
        UI.field('Cargo o puesto', role),
        UI.field('Teléfono', phone)
      ]),
      UI.field('Correo electrónico', email,
        'Si un módulo del cuestionario tiene activado el envío automático, esta dirección se propondrá como destinataria del informe.'),
      UI.field('Notas', notes)
    ]);

    // Reasignar el elemento madre en una lista hija
    var parentList = Store.parentListOf(l.id);
    if (parentList) {
      var opts = [{ value: '', label: '— Sin asignar —' }].concat(
        Store.listItems(parentList.id).map(function (p) { return { value: p.id, label: p.name }; }));
      var sel = UI.selectFrom(opts, c.parentId || '', { class: 'select' });
      body.insertBefore(UI.field(parentList.name, sel, 'A qué elemento pertenece.'), body.childNodes[1]);
      sel.addEventListener('change', function () { c.parentId = sel.value || null; });
    }

    UI.modal({
      title: 'Editar elemento',
      subtitle: l.name,
      icon: 'edit',
      body: body,
      buttons: [
        { label: 'Cancelar', kind: 'quiet' },
        {
          label: 'Guardar', kind: 'primary', icon: 'save', onClick: function () {
            var v = name.value.trim();
            if (!v) { UI.toast('El nombre no puede quedar vacío.', 'err'); return false; }
            c.name = v;
            c.role = role.value.trim();
            c.email = email.value.trim();
            c.phone = phone.value.trim();
            c.notes = notes.value.trim();
            Store.put('catalogs', c);
            UI.toast('Elemento actualizado.');
            render();
          }
        }
      ]
    });
  }

  function countUsage(itemId) {
    var n = 0;
    n += Store.query('deviations', function (d) { return d.severityId === itemId || d.categoryId === itemId; }).length;
    n += Store.query('visits', function (v) {
      if (v.centerId === itemId || v.areaId === itemId) return true;
      var dims = v.dimensions || {};
      return Object.keys(dims).some(function (k) { return (dims[k] || []).indexOf(itemId) !== -1; });
    }).length;
    return n;
  }

  function removeItem(c, used) {
    var kids = Store.query('catalogs', function (x) { return x.parentId === c.id; });
    var text = used
      ? 'Se usa en ' + UI.num(used) + ' ' + UI.plural(used, 'registro') + '. Esos registros quedarán como «Sin clasificar», pero no se borrará ningún dato.'
      : 'No se está usando en ningún registro.';
    if (kids.length) {
      text += ' Además, ' + UI.num(kids.length) + ' ' + UI.plural(kids.length, 'elemento') + ' de la subtipología quedarán sin asignar.';
    }

    UI.confirm({
      title: 'Eliminar «' + c.name + '»',
      text: text,
      confirmLabel: 'Eliminar'
    }).then(function (ok) {
      if (!ok) return;
      kids.forEach(function (k) { k.parentId = null; Store.put('catalogs', k); });
      Store.remove('catalogs', c.id);
      render();
      UI.toast('Elemento eliminado.');
    });
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

  /** Color sugerido para un elemento nuevo, derivado del de su tipología. */
  function defaultColor(l, i) {
    var bySystem = {
      severity: ['#E05C5C', '#F16B6B', '#C77A10', '#4356AE', '#7A83A3'],
      category: ['#1E2B6F', '#2E3D8A', '#4356AE', '#178A6B', '#C77A10', '#6B4EA8', '#E05C5C', '#0E7490']
    };
    var p = (l && bySystem[l.system]) || ['#1E2B6F', '#4356AE', '#178A6B', '#C77A10', '#6B4EA8', '#E05C5C'];
    return p[i % p.length];
  }

  /* ---------- Identidad ---------- */

  function brandCard() {
    var s = Store.settings();
    var card = el('div', { class: 'card' });
    card.appendChild(head('Identidad del departamento', 'Aparece en la cabecera de la aplicación y en los informes PDF', 'shield'));

    var body = el('div', { class: 'card__body' });

    var row = el('div', { class: 'grid-2' });
    var appName = input(s.appName, 'Safety Rounds');
    row.appendChild(UI.field('Nombre de la aplicación', appName));
    var company = input(s.company, 'Nombre de tu empresa');
    row.appendChild(UI.field('Empresa', company));
    body.appendChild(row);

    var row2 = el('div', { class: 'grid-2' });
    var dept = input(s.department, 'Departamento de Safety & Health');
    row2.appendChild(UI.field('Departamento', dept));
    var insp = input(s.defaultInspector, 'Se propondrá al crear una visita');
    row2.appendChild(UI.field('Inspector por defecto', insp));
    body.appendChild(row2);

    var footer = input(s.pdfFooter, 'Texto al pie de los informes');
    body.appendChild(UI.field('Pie de página del PDF', footer));

    // Logo
    var logoBox = el('div', { style: { display: 'flex', gap: '13px', alignItems: 'center', flexWrap: 'wrap' } });
    var preview = el('div', {
      style: {
        width: '66px', height: '66px', borderRadius: '14px', flex: 'none',
        border: '1px solid var(--line)', background: s.logo ? '#fff' : 'var(--surface)',
        display: 'grid', placeItems: 'center', overflow: 'hidden'
      }
    });
    function drawLogo() {
      UI.clear(preview);
      var cur = Store.settings().logo;
      if (cur) preview.appendChild(el('img', { src: cur, style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' } }));
      else preview.appendChild(el('span', { style: { color: 'var(--ink-3)' }, html: ico('building', 22) }));
    }
    drawLogo();

    var fileInput = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    fileInput.addEventListener('change', function () {
      var f = fileInput.files[0];
      if (!f) return;
      Store.compressImage(f, 420, 0.9).then(function (data) {
        Store.saveSettings({ logo: data });
        drawLogo();
        UI.toast('Logotipo actualizado.');
      });
      fileInput.value = '';
    });

    logoBox.appendChild(preview);
    logoBox.appendChild(el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
      el('button', {
        class: 'btn btn--ghost btn--sm', html: ico('upload', 15) + '<span>Subir logotipo</span>',
        onclick: function () { fileInput.click(); }
      }),
      Store.settings().logo ? el('button', {
        class: 'btn btn--quiet btn--sm', html: ico('trash', 15) + '<span>Quitar</span>',
        onclick: function () { Store.saveSettings({ logo: '' }); drawLogo(); render(); }
      }) : null
    ].filter(Boolean)));
    logoBox.appendChild(fileInput);
    body.appendChild(UI.field('Logotipo', logoBox, 'Se incluirá en la portada de todos los informes PDF. Formato PNG o JPG.'));

    body.appendChild(el('button', {
      class: 'btn btn--primary', style: { marginTop: '6px' },
      html: ico('save', 16) + '<span>Guardar identidad</span>',
      onclick: function () {
        Store.saveSettings({
          appName: appName.value.trim() || 'Safety Rounds',
          company: company.value.trim(),
          department: dept.value.trim(),
          defaultInspector: insp.value.trim(),
          pdfFooter: footer.value.trim()
        });
        App.applyBrand();
        UI.toast('Cambios guardados.');
      }
    }));

    card.appendChild(body);
    return card;
  }

  function input(value, placeholder) {
    return el('input', { class: 'input', value: value || '', placeholder: placeholder || '' });
  }

  function head(title, sub, icon) {
    return el('div', { class: 'card__head' }, [
      el('span', {
        style: { width: '30px', height: '30px', borderRadius: '9px', background: 'var(--navy-wash)', color: 'var(--navy)', display: 'grid', placeItems: 'center', flex: 'none' },
        html: ico(icon, 16)
      }),
      el('div', { style: { minWidth: '0' } }, [
        el('div', { class: 'card__title', text: title }),
        sub ? el('div', { class: 'card__sub', text: sub }) : null
      ])
    ]);
  }

  /* ---------- Datos ---------- */

  function dataCard() {
    var card = el('div', { class: 'card' });
    card.appendChild(head('Datos y copias de seguridad', 'Toda la información se guarda en este dispositivo', 'database'));
    var body = el('div', { class: 'card__body' });

    var counts = [
      ['Cuestionarios', Store.all('forms').length, 'clipboard'],
      ['Visitas', Store.all('visits').length, 'inbox'],
      ['Desviaciones', Store.all('deviations').length, 'alert'],
      ['Acciones', Store.all('actions').length, 'target']
    ];
    var grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '10px', marginBottom: '18px' } });
    counts.forEach(function (c) {
      grid.appendChild(el('div', { style: { background: 'var(--surface)', borderRadius: '12px', padding: '13px 15px' } }, [
        el('div', { style: { color: 'var(--navy-soft)', marginBottom: '5px' }, html: ico(c[2], 16) }),
        el('div', { style: { fontSize: '21px', fontWeight: '700', letterSpacing: '-.03em' }, text: String(c[1]) }),
        el('div', { style: { fontSize: '12px', color: 'var(--ink-3)', fontWeight: '600' }, text: c[0] })
      ]));
    });
    body.appendChild(grid);

    var where = {
      idb: 'en el navegador de este dispositivo (IndexedDB), así que la aplicación funciona sin conexión',
      ls: 'en el almacenamiento local de este navegador, así que la aplicación funciona sin conexión',
      mem: '<strong>solo en memoria</strong>: este navegador no permite guardar datos en esta página, de modo que todo se perderá al recargar'
    }[Store.mode] || '';

    body.appendChild(el('div', {
      class: 'hint', style: { marginBottom: '16px', lineHeight: '1.6' },
      html: 'Los datos viven ' + where +
        '. <strong>Descarga una copia de seguridad periódicamente</strong> y guárdala en una carpeta de red o en la nube: es también la forma de pasar los datos a otro equipo.'
    }));

    var actions = el('div', { style: { display: 'flex', gap: '9px', flexWrap: 'wrap' } });
    actions.appendChild(el('button', {
      class: 'btn btn--navy', html: ico('download', 16) + '<span>Descargar copia</span>',
      onclick: backup
    }));

    var importInput = el('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
    importInput.addEventListener('change', function () {
      var f = importInput.files[0];
      if (f) restore(f);
      importInput.value = '';
    });
    actions.appendChild(el('button', {
      class: 'btn btn--ghost', html: ico('upload', 16) + '<span>Restaurar copia</span>',
      onclick: function () { importInput.click(); }
    }));
    actions.appendChild(importInput);
    actions.appendChild(el('button', {
      class: 'btn btn--ghost', html: ico('lightbulb', 16) + '<span>Cargar datos de ejemplo</span>',
      onclick: loadDemo
    }));
    body.appendChild(actions);

    // Zona peligrosa
    var danger = el('div', {
      class: 'card danger-zone',
      style: { marginTop: '20px' }
    });
    danger.appendChild(el('div', { class: 'card__body' }, [
      el('div', { style: { fontWeight: '700', fontSize: '14.5px', color: 'var(--coral-dark)', marginBottom: '5px' }, text: 'Borrar datos' }),
      el('div', { class: 'hint', style: { marginBottom: '14px' }, text: 'Elimina información de forma permanente. Descarga antes una copia de seguridad.' }),
      el('div', { style: { display: 'flex', gap: '9px', flexWrap: 'wrap' } }, [
        el('button', {
          class: 'btn btn--danger btn--sm', html: ico('trash', 15) + '<span>Borrar visitas y desviaciones</span>',
          onclick: function () { wipe(['visits', 'deviations', 'actions'], 'las visitas, desviaciones y acciones', 'Los cuestionarios y las tipologías se conservan.'); }
        }),
        el('button', {
          class: 'btn btn--danger btn--sm', html: ico('trash', 15) + '<span>Borrar todo</span>',
          onclick: function () { wipe(Store.STORES, 'TODOS los datos de la aplicación', 'Cuestionarios, visitas, desviaciones, acciones y tipologías.'); }
        })
      ])
    ]));
    body.appendChild(danger);

    card.appendChild(body);
    return card;
  }

  function loadDemo() {
    UI.confirm({
      title: 'Cargar datos de ejemplo',
      text: 'Se generarán tipologías, centros, áreas y unos seis meses de inspecciones ficticias para que puedas ver el dashboard y el plan de acción funcionando. No se borra nada de lo que ya tengas: podrás eliminarlo después desde «Borrar visitas y desviaciones».',
      confirmLabel: 'Generar ejemplo',
      confirmIcon: 'lightbulb',
      danger: false,
      icon: 'lightbulb'
    }).then(function (ok) {
      if (!ok) return;
      var n = Seed.loadDemoData();
      App.refreshBadges();
      render();
      UI.toast(n + ' visitas de ejemplo generadas. Echa un vistazo al Dashboard.');
    });
  }

  function backup() {
    var data = Store.exportAll();
    var name = 'safety-rounds-copia-' + UI.fmtDateInput(new Date()) + '.json';
    UI.downloadText(name, JSON.stringify(data), 'application/json');
    UI.toast('Copia de seguridad descargada.');
  }

  function restore(file) {
    var r = new FileReader();
    r.onload = function () {
      var data;
      try {
        data = JSON.parse(r.result);
      } catch (e) {
        UI.toast('El archivo no es un JSON válido.', 'err');
        return;
      }
      var summary = Store.STORES.map(function (s) {
        return (data[s] || []).length + ' ' + s;
      }).join(' · ');

      UI.modal({
        title: 'Restaurar copia de seguridad',
        subtitle: 'Contenido del archivo: ' + summary,
        icon: 'upload',
        body: el('div', { class: 'hint', style: { paddingBottom: '8px', lineHeight: '1.6' } },
          'Elige cómo aplicar la copia. «Reemplazar» borra los datos actuales y deja exactamente el contenido del archivo. «Fusionar» conserva lo que ya tienes y añade o actualiza los registros de la copia.'),
        footSplit: true,
        buttons: [
          {
            label: 'Reemplazar todo', kind: 'danger', icon: 'refresh', onClick: function () {
              doRestore(data, true);
            }
          },
          {
            label: 'Fusionar', kind: 'primary', icon: 'plus', onClick: function () {
              doRestore(data, false);
            }
          }
        ]
      });
    };
    r.readAsText(file);
  }

  function doRestore(data, replace) {
    try {
      Store.importAll(data, replace);
      UI.toast('Copia restaurada correctamente.');
      App.applyBrand();
      App.refreshBadges();
      render();
    } catch (e) {
      UI.toast(e.message, 'err');
    }
  }

  function wipe(stores, what, extra) {
    UI.confirm({
      title: 'Borrar ' + what,
      text: extra + ' Esta acción no se puede deshacer. ¿Seguro que quieres continuar?',
      confirmLabel: 'Sí, borrar'
    }).then(function (ok) {
      if (!ok) return;
      stores.forEach(function (s) {
        if (s === 'settings') return; // la identidad se conserva siempre
        Store.clearStore(s);
      });
      UI.toast('Datos eliminados.');
      App.refreshBadges();
      App.updateStorage();
      render();
    });
  }

  global.Settings = { render: render, backup: backup };
})(window);
