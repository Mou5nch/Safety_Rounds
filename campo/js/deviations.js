/* ==========================================================================
   Safety Rounds · Campo — Desviaciones
   Listado filtrable y ficha completa (descripción, gravedad, categoría,
   fotos, estado y acción correctora). Todo lo que se cambie aquí se refleja
   en la APP principal y en la visita de origen.
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el, esc = UI.esc;
  var Views = global.Views = global.Views || {};

  var st = { seg: 'open', sev: '', q: '', visitId: '' };

  function list() {
    return Store.query('deviations', function (d) { return Campo.inPlant(d.centerId); });
  }

  function sevColor(d) {
    return d.severityId ? Store.catalogColor(d.severityId) : '#E05C5C';
  }

  /* ======================================================================
     Listado
     ====================================================================== */

  function card(d) {
    var closed = d.status === 'closed';
    var act = Records.actionOf(d);
    var color = sevColor(d);

    var tags = [];
    var sev = Campo.colorTag(d.severityId);
    if (sev) tags.push(sev);
    var cat = Campo.colorTag(d.categoryId);
    if (cat) tags.push(cat);
    tags.push(Campo.tag(closed ? 'Cerrada' : 'Abierta', closed ? 'ok' : 'danger', closed ? 'check' : 'alert'));

    var node = el('div', { class: 'f-dev' + (closed ? ' is-closed' : ''), style: { '--sev': color } });

    node.appendChild(el('button', { class: 'f-dev__body', type: 'button', onclick: function () { openDetail(d.id); } }, [
      el('div', { class: 'f-item__tags' }, tags),
      el('div', { class: 'f-dev__title f-clamp-2', text: d.question || 'Desviación' }),
      el('div', { class: 'f-dev__desc f-clamp-3', text: d.description || 'Sin descripción' }),
      (d.photos || []).length ? el('div', { class: 'f-thumbs' }, d.photos.slice(0, 4).map(function (p, i) {
        return el('img', { src: p, alt: 'Evidencia', loading: 'lazy', onclick: function (e) { e.stopPropagation(); Campo.lightbox(d.photos, i); } });
      }).concat(d.photos.length > 4 ? [el('span', { class: 'f-thumbs__more', text: '+' + (d.photos.length - 4) })] : [])) : null,
      Campo.metaLine([
        d.centerId ? ['building', Store.catalogName(d.centerId)] : null,
        d.areaId ? ['mapPin', Store.catalogName(d.areaId)] : null,
        ['calendar', UI.fmtDate(d.date)],
        d.visitCode ? ['clipboard', d.visitCode] : null
      ])
    ]));

    var foot = el('div', { class: 'f-dev__foot' });
    if (act) {
      var due = Campo.dueInfo(act.dueDate, act.status === 'done');
      foot.appendChild(el('div', { class: 'f-dev__action' }, [
        el('span', { html: ico('target', 15) }),
        el('span', { class: 'f-dev__action-text', text: act.title || 'Acción correctora' }),
        Campo.tag(due.label, due.kind)
      ]));
    } else if (!closed) {
      foot.appendChild(el('div', { class: 'f-dev__action f-dev__action--none' }, [
        el('span', { html: ico('info', 15) }), el('span', { text: 'Sin acción correctora asignada' })
      ]));
    }
    foot.appendChild(el('button', {
      class: 'btn btn--ghost btn--sm f-btn-sm', type: 'button',
      html: ico(closed ? 'refresh' : 'check', 16) + '<span>' + (closed ? 'Reabrir' : 'Cerrar') + '</span>',
      onclick: function () {
        function apply() {
          Records.setDeviationClosed(d, !closed);
          UI.toast(closed ? 'Desviación reabierta.' : 'Desviación cerrada.');
          Shell.render();
        }
        if (closed) { apply(); return; }
        UI.confirm({
          title: '¿Cerrar la desviación?', text: 'Se marcará como resuelta' + (act ? ' junto con su acción correctora.' : '.'),
          confirmLabel: 'Sí, cerrar', cancelLabel: 'Todavía no', danger: false, icon: 'checkCircle', confirmIcon: 'check'
        }).then(function (ok) { if (ok) apply(); });
      }
    }));
    node.appendChild(foot);
    return node;
  }

  function render(params) {
    if (params && params.visitId !== undefined) { st.visitId = params.visitId || ''; if (params.visitId) st.seg = 'all'; }
    if (params && params.seg) st.seg = params.seg;
    var view = UI.$('#view');
    var all = list();
    var open = all.filter(function (d) { return d.status !== 'closed'; });
    var closed = all.filter(function (d) { return d.status === 'closed'; });

    view.appendChild(el('div', { class: 'f-toolbar' }, [
      el('h1', { class: 'f-title', text: 'Desviaciones' }),
      Campo.segmented([
        { value: 'open', label: 'Abiertas', count: open.length },
        { value: 'closed', label: 'Cerradas', count: closed.length || '' },
        { value: 'all', label: 'Todas' }
      ], st.seg, function (v) { st.seg = v; Shell.render(); })
    ]));

    view.appendChild(Campo.searchBox(st.q, 'Descripción, punto de inspección, visita…', function (v) { st.q = v; Shell.render(); }));

    var sevs = Store.catalog('severity');
    if (sevs.length) {
      view.appendChild(Campo.chips([{ value: '', label: 'Toda gravedad' }].concat(sevs.map(function (s) {
        return { value: s.id, label: s.name, color: s.color };
      })), st.sev, function (v) { st.sev = v; Shell.render(); }));
    }

    if (st.visitId) {
      var v = Store.get('visits', st.visitId);
      view.appendChild(el('div', { class: 'f-filterbar' }, [
        el('span', { html: ico('clipboard', 15) + '<span>Visita ' + esc(v ? v.code : '') + '</span>' }),
        el('button', { class: 'f-link', type: 'button', text: 'Quitar filtro', onclick: function () { st.visitId = ''; Shell.render(); } })
      ]));
    }

    var q = st.q.trim().toLowerCase();
    var rows = all.filter(function (d) {
      if (st.seg === 'open' && d.status === 'closed') return false;
      if (st.seg === 'closed' && d.status !== 'closed') return false;
      if (st.sev && d.severityId !== st.sev) return false;
      if (st.visitId && d.visitId !== st.visitId) return false;
      if (q && [d.description, d.question, d.visitCode, d.formName, d.inspector].join(' ').toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) {
      // Primero las abiertas y, dentro de cada grupo, lo más reciente
      var ca = a.status === 'closed' ? 1 : 0, cb = b.status === 'closed' ? 1 : 0;
      if (ca !== cb) return ca - cb;
      return (b.date || '') < (a.date || '') ? -1 : (b.date || '') > (a.date || '') ? 1 : 0;
    });

    if (!rows.length) {
      view.appendChild(Campo.empty(st.seg === 'open' && !q && !st.sev ? 'checkCircle' : 'search',
        st.seg === 'open' && !q && !st.sev ? 'Sin desviaciones abiertas' : 'Sin resultados',
        st.seg === 'open' && !q && !st.sev
          ? 'No hay desviaciones pendientes' + (Campo.plant() ? ' en ' + Campo.plantName() : '') + '. Buen trabajo.'
          : 'Prueba a cambiar los filtros.'));
      return;
    }
    view.appendChild(el('div', { class: 'f-count', text: UI.num(rows.length) + ' ' + UI.plural(rows.length, 'desviación', 'desviaciones') }));
    var grid = el('div', { class: 'f-list f-list--grid' });
    rows.forEach(function (d) { grid.appendChild(card(d)); });
    view.appendChild(grid);
  }

  /* ======================================================================
     Ficha de la desviación
     ====================================================================== */

  function selectField(label, items, value, onChange) {
    var s = UI.selectFrom([{ value: '', label: '— Sin especificar —' }].concat(items.map(function (c) { return { value: c.id, label: c.name }; })), value || '');
    s.addEventListener('change', function () { onChange(s.value); });
    return UI.field(label, s);
  }

  function openDetail(id) {
    var d = Store.get('deviations', id);
    if (!d) { UI.toast('Esa desviación ya no existe.', 'err'); return; }
    var act = Records.actionOf(d);
    var dirty = false;
    function mark() { dirty = true; }

    var cur = { description: d.description || '', severityId: d.severityId || '', categoryId: d.categoryId || '' };
    var body = el('div');

    // --- Contexto ---
    body.appendChild(el('div', { class: 'f-ctx__title', text: d.question || 'Desviación' }));
    body.appendChild(Campo.metaLine([
      d.centerId ? ['building', Store.catalogName(d.centerId)] : null,
      d.areaId ? ['mapPin', Store.catalogName(d.areaId)] : null,
      ['calendar', UI.fmtDate(d.date)],
      d.inspector ? ['user', d.inspector] : null
    ]));

    // --- Fotos (se guardan al momento: son evidencia, no un borrador) ---
    var photosBox = el('div', { class: 'media-grid f-photos' });
    function drawPhotos() {
      UI.clear(photosBox);
      (d.photos || []).forEach(function (p, i) {
        photosBox.appendChild(el('div', { class: 'media-item' }, [
          el('img', { src: p, alt: 'Evidencia ' + (i + 1), onclick: function () { Campo.lightbox(d.photos, i); } }),
          el('button', {
            class: 'media-item__del', type: 'button', 'aria-label': 'Quitar foto', html: ico('x', 14),
            onclick: function (e) {
              e.stopPropagation();
              UI.confirm({ title: 'Quitar la foto', text: 'Se eliminará de la desviación y de la visita de origen.', confirmLabel: 'Quitar' })
                .then(function (ok) { if (ok) { Records.removePhoto(d, i); drawPhotos(); } });
            }
          })
        ]));
      });
      photosBox.appendChild(Campo.photoButton(function (data) {
        Records.addPhoto(d, data);
        drawPhotos();
        UI.toast('Foto añadida.');
      }, 'Añadir foto'));
    }
    drawPhotos();
    body.appendChild(el('div', { class: 'f-section-title', text: 'Evidencias' }));
    body.appendChild(photosBox);

    // --- Datos de la desviación ---
    body.appendChild(el('div', { class: 'f-section-title', text: 'Desviación' }));
    var desc = el('textarea', { class: 'textarea', placeholder: 'Describe qué se ha observado y por qué no es conforme…' });
    desc.value = cur.description;
    desc.addEventListener('input', function () { cur.description = desc.value; mark(); });
    body.appendChild(UI.field('Descripción', desc));
    body.appendChild(el('div', { class: 'grid-2' }, [
      selectField('Gravedad', Store.catalog('severity'), cur.severityId, function (v) { cur.severityId = v; mark(); }),
      selectField('Categoría de riesgo', Store.catalog('category'), cur.categoryId, function (v) { cur.categoryId = v; mark(); })
    ]));

    // --- Estado y acción correctora ---
    body.appendChild(el('div', { class: 'f-section-title', text: 'Seguimiento' }));
    var ed = null;           // editor de la acción (si existe o se añade)
    var plainStatus = d.status === 'closed' ? 'closed' : 'open';
    var actionBox = el('div');

    function drawAction() {
      UI.clear(actionBox);
      if (act || ed) {
        ed = ed || Views.actions.editor(act, { onChange: mark });
        actionBox.appendChild(ed.node);
      } else {
        // Sin acción: el estado es solo abierta / cerrada
        var seg = el('div', { class: 'f-status' });
        [{ v: 'open', l: 'Abierta', k: 'danger' }, { v: 'closed', l: 'Cerrada', k: 'ok' }].forEach(function (s) {
          seg.appendChild(el('button', {
            type: 'button', class: 'f-status__btn f-status__btn--' + s.k + (plainStatus === s.v ? ' is-on' : ''),
            onclick: function () { plainStatus = s.v; mark(); drawAction(); }
          }, el('span', { text: s.l })));
        });
        actionBox.appendChild(UI.field('Estado', seg));
        actionBox.appendChild(el('button', {
          class: 'btn btn--ghost btn--block f-btn', type: 'button', html: ico('plus', 18) + '<span>Añadir acción correctora</span>',
          onclick: function () {
            ed = Views.actions.editor({ title: '', status: 'open' }, { onChange: mark });
            mark();
            drawAction();
          }
        }));
      }
    }
    drawAction();
    body.appendChild(actionBox);

    // --- Trazabilidad y baja ---
    if (d.visitId) {
      body.appendChild(el('button', {
        class: 'btn btn--ghost btn--block f-btn', style: { marginTop: '18px' },
        html: ico('external', 18) + '<span>Abrir la visita ' + esc(d.visitCode || '') + '</span>',
        onclick: function () { dirty = false; sh.close(); Shell.runVisit(d.formId, d.visitId); }
      }));
    }
    body.appendChild(el('button', {
      class: 'btn btn--danger btn--block f-btn', style: { marginTop: '10px' },
      html: ico('trash', 18) + '<span>Eliminar desviación</span>',
      onclick: function () {
        UI.confirm({
          title: 'Eliminar la desviación',
          text: 'Se eliminarán la desviación y su acción correctora en todos los dispositivos. La visita conserva la respuesta «No correcto». No se puede deshacer.',
          confirmLabel: 'Eliminar'
        }).then(function (ok) {
          if (!ok) return;
          dirty = false; sh.close();
          Records.deleteDeviation(d);
          UI.toast('Desviación eliminada.');
          Shell.render();
        });
      }
    }));

    function save() {
      var changes = {};
      if (cur.description !== (d.description || '')) changes.description = cur.description;
      if (cur.severityId !== (d.severityId || '')) changes.severityId = cur.severityId;
      if (cur.categoryId !== (d.categoryId || '')) changes.categoryId = cur.categoryId;
      if (Object.keys(changes).length) Records.saveDeviation(d, changes);

      if (ed) {
        var v = ed.values();
        if (act) {
          if (!v.title.trim()) { UI.toast('Indica qué acción hay que realizar.', 'err'); return; }
          Records.saveAction(act, { title: v.title.trim(), responsible: v.responsible.trim(), dueDate: v.dueDate, notes: v.notes, status: v.status });
        } else if (v.title.trim() || v.responsible.trim() || v.dueDate) {
          var created = Records.createAction(d, { title: v.title.trim(), responsible: v.responsible.trim(), dueDate: v.dueDate });
          if (v.notes || v.status !== 'open') Records.saveAction(created, { notes: v.notes, status: v.status });
        }
      } else if ((plainStatus === 'closed') !== (d.status === 'closed')) {
        Records.setDeviationClosed(d, plainStatus === 'closed');
      }
      dirty = false;
      sh.close();
      UI.toast('Desviación actualizada.');
      Shell.render();
    }

    var sh = Campo.sheet({
      title: 'Desviación', subtitle: d.visitCode ? 'Visita ' + d.visitCode : '', body: body, sticky: true,
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

  Views.deviations = { render: render, openDetail: openDetail };
})(window);
