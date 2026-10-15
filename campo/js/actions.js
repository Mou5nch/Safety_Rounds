/* ==========================================================================
   Safety Rounds · Campo — Plan de acción
   Seguimiento de las acciones correctoras: qué hay pendiente, qué está
   vencido y qué se ha cerrado, filtrado por la planta elegida. Los cambios
   se sincronizan con la APP principal.
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el, esc = UI.esc;
  var Views = global.Views = global.Views || {};

  var st = { seg: 'pending', q: '' };

  var STATUS = [
    { value: 'open', label: 'Abierta', kind: 'danger' },
    { value: 'progress', label: 'En curso', kind: 'warn' },
    { value: 'done', label: 'Cerrada', kind: 'ok' }
  ];

  function statusDef(v) {
    return STATUS.filter(function (s) { return s.value === (v || 'open'); })[0] || STATUS[0];
  }

  function isOverdue(a) {
    return a.status !== 'done' && a.dueDate && UI.relativeDays(a.dueDate) < 0;
  }

  /* ======================================================================
     Editor de la acción (lo comparten esta pantalla y el detalle de la desviación)
     ----------------------------------------------------------------------
     opts.states: qué estados ofrece (por defecto los tres).
     Devuelve { node, values(), dirty() }.
     ====================================================================== */

  function responsibleSuggestions() {
    var names = {};
    Store.lists().filter(function (l) { return /responsable/i.test(l.name); }).forEach(function (l) {
      Store.listItems(l.id).forEach(function (c) { names[c.name] = 1; });
    });
    Store.all('actions').forEach(function (a) { if (a.responsible) names[a.responsible] = 1; });
    return Object.keys(names).sort();
  }

  function editor(act, opts) {
    opts = opts || {};
    var init = {
      title: (act && act.title) || '', responsible: (act && act.responsible) || '',
      dueDate: (act && act.dueDate) || '', notes: (act && act.notes) || '',
      status: (act && act.status) || 'open'
    };
    var cur = Object.assign({}, init);
    var onDirty = opts.onChange || function () {};

    var node = el('div', { class: 'f-form-fields' });

    // Estado
    var states = opts.states || STATUS;
    var seg = el('div', { class: 'f-status' });
    function paintStatus() {
      UI.clear(seg);
      states.forEach(function (s) {
        seg.appendChild(el('button', {
          type: 'button', class: 'f-status__btn f-status__btn--' + s.kind + (cur.status === s.value ? ' is-on' : ''),
          onclick: function () { cur.status = s.value; paintStatus(); onDirty(); }
        }, el('span', { text: s.label })));
      });
    }
    paintStatus();
    node.appendChild(UI.field('Estado', seg));

    var title = el('input', { class: 'input', value: cur.title, placeholder: 'Qué hay que hacer para corregirlo', autocomplete: 'off' });
    title.addEventListener('input', function () { cur.title = title.value; onDirty(); });
    node.appendChild(UI.field('Acción correctora', title));

    var listId = 'dl_' + Math.random().toString(36).slice(2, 7);
    var resp = el('input', { class: 'input', value: cur.responsible, placeholder: 'Persona o departamento', list: listId, autocomplete: 'off' });
    resp.addEventListener('input', function () { cur.responsible = resp.value; onDirty(); });
    var dl = el('datalist', { id: listId }, responsibleSuggestions().map(function (n) { return el('option', { value: n }); }));
    var due = el('input', { class: 'input', type: 'date', value: cur.dueDate });
    due.addEventListener('input', function () { cur.dueDate = due.value; onDirty(); });
    node.appendChild(el('div', { class: 'grid-2' }, [UI.field('Responsable', el('div', {}, [resp, dl])), UI.field('Fecha límite', due)]));

    var notes = el('textarea', { class: 'textarea', placeholder: 'Avances, incidencias, evidencia del cierre…' });
    notes.value = cur.notes;
    notes.addEventListener('input', function () { cur.notes = notes.value; onDirty(); });
    node.appendChild(UI.field('Notas de seguimiento', notes));

    return {
      node: node,
      values: function () { return Object.assign({}, cur); },
      dirty: function () { return Object.keys(init).some(function (k) { return init[k] !== cur[k]; }); }
    };
  }

  /* ======================================================================
     Listado
     ====================================================================== */

  function list() {
    return Store.query('actions', function (a) { return Campo.inPlant(a.centerId); });
  }

  // Cerrar una acción de seguridad es una decisión que conviene confirmar: el
  // botón es grande a propósito (se usa con guantes) y un toque fallido no
  // debe dar por resuelto algo que sigue abierto. Reabrir no necesita aviso.
  function quickToggle(a) {
    var closing = a.status !== 'done';
    function apply() {
      Records.saveAction(a, { status: closing ? 'done' : 'open' });
      UI.toast(closing ? 'Acción cerrada.' : 'Acción reabierta.');
      Shell.render();
    }
    if (!closing) { apply(); return; }
    UI.confirm({
      title: '¿Cerrar la acción?', text: '«' + (a.title || 'Acción correctora') + '». La desviación asociada también se cerrará.',
      confirmLabel: 'Sí, cerrar', cancelLabel: 'Todavía no', danger: false, icon: 'checkCircle', confirmIcon: 'check'
    }).then(function (ok) { if (ok) apply(); });
  }

  function card(a) {
    var overdue = isOverdue(a);
    var due = Campo.dueInfo(a.dueDate, a.status === 'done');
    var sd = statusDef(a.status);
    var dev = Store.get('deviations', a.deviationId);

    return el('div', { class: 'f-item f-item--action' + (overdue ? ' is-overdue' : '') }, [
      el('div', { class: 'f-item__badge f-item__badge--' + (a.status === 'done' ? 'ok' : overdue ? 'danger' : 'warn'), html: ico(a.status === 'done' ? 'checkCircle' : 'target', 22) }),
      el('button', { class: 'f-item__main f-item__main--btn', type: 'button', onclick: function () { openDetail(a.id); } }, [
        el('div', { class: 'f-item__title f-clamp-2', text: a.title || 'Acción correctora' }),
        Campo.metaLine([
          a.responsible ? ['user', a.responsible] : ['user', 'Sin responsable'],
          a.centerId ? ['building', Store.catalogName(a.centerId)] : null,
          a.visitCode ? ['clipboard', a.visitCode] : null
        ]),
        dev && dev.description ? el('div', { class: 'f-item__sub f-clamp-2', text: dev.description }) : null,
        el('div', { class: 'f-item__tags' }, [Campo.tag(due.label, due.kind, 'calendar'), Campo.tag(sd.label, sd.kind)])
      ]),
      el('button', {
        class: 'f-roundbtn f-roundbtn--' + (a.status === 'done' ? 'ghost' : 'ok'), type: 'button',
        'aria-label': a.status === 'done' ? 'Reabrir acción' : 'Cerrar acción',
        html: ico(a.status === 'done' ? 'refresh' : 'check', 22), onclick: function () { quickToggle(a); }
      })
    ]);
  }

  function render(params) {
    if (params && params.seg) st.seg = params.seg;
    var view = UI.$('#view');
    var all = list();
    var pending = all.filter(function (a) { return a.status !== 'done'; });
    var overdue = all.filter(isOverdue);
    var closed = all.filter(function (a) { return a.status === 'done'; });

    view.appendChild(el('div', { class: 'f-toolbar' }, [
      el('h1', { class: 'f-title', text: 'Plan de acción' }),
      Campo.segmented([
        { value: 'pending', label: 'Pendientes', count: pending.length },
        { value: 'overdue', label: 'Vencidas', count: overdue.length || '' },
        { value: 'done', label: 'Cerradas' }
      ], st.seg, function (v) { st.seg = v; Shell.render(); })
    ]));
    view.appendChild(Campo.searchBox(st.q, 'Acción, responsable, visita…', function (v) { st.q = v; Shell.render(); }));

    var rows = st.seg === 'overdue' ? overdue : st.seg === 'done' ? closed : pending;
    var q = st.q.trim().toLowerCase();
    if (q) rows = rows.filter(function (a) { return [a.title, a.responsible, a.visitCode, a.description].join(' ').toLowerCase().indexOf(q) !== -1; });

    rows = rows.slice().sort(function (a, b) {
      if (st.seg === 'done') return (b.closedAt || '') < (a.closedAt || '') ? -1 : 1;
      var oa = isOverdue(a) ? 0 : 1, ob = isOverdue(b) ? 0 : 1;
      if (oa !== ob) return oa - ob;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    });

    if (!rows.length) {
      var msg = st.seg === 'overdue' ? ['checkCircle', 'Nada vencido', 'No hay acciones fuera de plazo' + (Campo.plant() ? ' en ' + Campo.plantName() : '') + '.']
        : st.seg === 'done' ? ['inbox', 'Aún no hay acciones cerradas', 'Cuando cierres una acción correctora aparecerá aquí.']
        : q ? ['search', 'Sin resultados', 'Prueba con otra búsqueda.']
        : ['target', 'No hay acciones pendientes', 'Las acciones correctoras nacen de las desviaciones que se registran en las visitas.'];
      view.appendChild(Campo.empty(msg[0], msg[1], msg[2]));
      return;
    }
    var grid = el('div', { class: 'f-list f-list--grid' });
    rows.forEach(function (a) { grid.appendChild(card(a)); });
    view.appendChild(grid);
  }

  /* ======================================================================
     Detalle de una acción
     ====================================================================== */

  function openDetail(id) {
    var a = Store.get('actions', id);
    if (!a) { UI.toast('Esa acción ya no existe.', 'err'); return; }
    var dev = Store.get('deviations', a.deviationId);

    var body = el('div');
    if (dev) {
      var ctx = el('div', { class: 'f-card f-card--flat f-ctx' }, [
        el('div', { class: 'f-item__tags' }, [Campo.colorTag(dev.severityId), Campo.colorTag(dev.categoryId)].filter(Boolean)),
        el('div', { class: 'f-ctx__title', text: dev.question || 'Desviación' }),
        el('div', { class: 'f-ctx__text', text: dev.description || 'Sin descripción' })
      ]);
      if ((dev.photos || []).length) {
        var strip = el('div', { class: 'f-thumbs' });
        dev.photos.slice(0, 5).forEach(function (p, i) {
          strip.appendChild(el('img', { src: p, alt: 'Evidencia', loading: 'lazy', onclick: function () { Campo.lightbox(dev.photos, i); } }));
        });
        ctx.appendChild(strip);
      }
      ctx.appendChild(el('button', {
        class: 'f-link', type: 'button', text: 'Ver la desviación completa',
        onclick: function () { sh.close(); Views.deviations.openDetail(dev.id); }
      }));
      body.appendChild(ctx);
    }

    var dirty = false;
    var ed = editor(a, { onChange: function () { dirty = true; } });
    body.appendChild(ed.node);

    function save() {
      var v = ed.values();
      if (!v.title.trim()) { UI.toast('Indica qué acción hay que realizar.', 'err'); return; }
      Records.saveAction(a, {
        title: v.title.trim(), responsible: v.responsible.trim(), dueDate: v.dueDate, notes: v.notes, status: v.status
      });
      dirty = false;
      sh.close();
      UI.toast('Acción actualizada.');
      Shell.render();
    }

    var sh = Campo.sheet({
      title: 'Acción correctora', subtitle: (a.visitCode || '') + (a.centerId ? ' · ' + Store.catalogName(a.centerId) : ''),
      body: body, sticky: true,
      footer: [el('button', { class: 'btn btn--primary btn--block f-btn', html: ico('save', 18) + '<span>Guardar cambios</span>', onclick: save })],
      beforeClose: function () {
        if (!dirty) return true;
        return UI.confirm({
          title: 'Hay cambios sin guardar', text: '¿Quieres descartarlos?',
          confirmLabel: 'Descartar', cancelLabel: 'Seguir editando', danger: false, icon: 'edit'
        });
      }
    });
  }

  Views.actions = { render: render, openDetail: openDetail, editor: editor, STATUS: STATUS, statusDef: statusDef };
})(window);
