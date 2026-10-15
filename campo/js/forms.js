/* ==========================================================================
   Safety Rounds · Campo — Cuestionarios y visitas
   Tres apartados: empezar una visita nueva, retomar borradores y consultar
   las visitas realizadas (con PDF y envío por correo). La parte de
   configuración de cuestionarios no está aquí a propósito: se hace en la
   APP principal.
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el, esc = UI.esc;
  var Views = global.Views = global.Views || {};

  var st = { seg: 'new', q: '', folder: '', formId: '' };

  /* ======================================================================
     Empezar una visita
     ====================================================================== */

  function askPlant(cb) {
    var body = el('div', { class: 'f-list' });
    var s = null;
    Campo.centers().forEach(function (c) {
      body.appendChild(el('button', {
        class: 'f-pick', type: 'button',
        onclick: function () { s.close(); cb(c.id); }
      }, [
        el('span', { class: 'f-pick__dot', style: { background: c.color || '#4356AE' } }),
        el('span', { class: 'f-pick__main' }, el('span', { class: 'f-pick__name', text: c.name })),
        el('span', { class: 'f-pick__check', html: ico('chevronRight', 18) })
      ]));
    });
    s = Campo.sheet({
      title: '¿En qué planta estás?', subtitle: 'La visita se abrirá ya situada en esa planta. Podrás cambiarla dentro de la visita.',
      body: body
    });
  }

  function begin(form, centerId) {
    Shell.runVisit(form.id, null, centerId ? { centerId: centerId } : null);
  }

  function startVisit(form, centerId) {
    var c = centerId || Campo.plant();
    if (c) { begin(form, c); return; }
    if (!Campo.centers().length) { begin(form, ''); return; }
    askPlant(function (id) { Campo.setPlant(id); begin(form, id); });
  }

  function startFor(formId, centerId) {
    var form = Store.get('forms', formId);
    if (!form) { UI.toast('Ese cuestionario ya no existe.', 'err'); return; }
    startVisit(form, centerId);
  }

  /* ======================================================================
     Nuevo
     ====================================================================== */

  function formCard(f, dueByForm) {
    var color = f.color || '#1E2B6F';
    var questions = (f.fields || []).filter(function (x) { return Builder.isQuestion(x); }).length;
    var due = dueByForm[f.id];
    var tags = [];
    if (due) {
      var kind = due.overdue ? 'danger' : due.daysUntil <= 7 ? 'warn' : 'navy';
      tags.push(Campo.tag(due.overdue ? 'Vencida' : due.daysUntil === 0 ? 'Toca hoy' : 'En ' + due.daysUntil + ' d', kind, 'calendar'));
    }
    if (f.recurrence && f.recurrence.enabled) tags.push(Campo.tag(Recurrence.freqLabel(f.recurrence), '', 'refresh'));
    tags.push(Campo.tag(questions + (questions === 1 ? ' pregunta' : ' preguntas'), ''));

    return el('button', { class: 'f-form', type: 'button', onclick: function () { startVisit(f); } }, [
      el('span', { class: 'f-form__icon', style: { background: UI.withAlpha(color, .13), color: color }, html: ico(f.icon || 'clipboard', 26) }),
      el('span', { class: 'f-form__main' }, [
        el('span', { class: 'f-form__name', text: f.name }),
        f.description ? el('span', { class: 'f-form__desc f-clamp-2', text: f.description }) : null,
        el('span', { class: 'f-form__tags' }, tags)
      ]),
      el('span', { class: 'f-form__go', html: ico('play', 20) })
    ]);
  }

  function formRow(f, dueByForm) {
    var color = f.color || '#1E2B6F';
    var questions = (f.fields || []).filter(function (x) { return Builder.isQuestion(x); }).length;
    var due = dueByForm[f.id];
    var dueTag = due ? Campo.tag(due.overdue ? 'Vencida' : due.daysUntil === 0 ? 'Toca hoy' : 'En ' + due.daysUntil + ' d',
      due.overdue ? 'danger' : due.daysUntil <= 7 ? 'warn' : 'navy', 'calendar') : null;
    var freq = f.recurrence && f.recurrence.enabled ? Recurrence.freqLabel(f.recurrence) : '';

    return Campo.listRow({
      color: color,
      title: f.name, sub: f.description || null,
      meta: [dueTag, freq ? Campo.tag(freq, '', 'refresh') : null, questions + (questions === 1 ? ' pregunta' : ' preguntas')],
      cells: [freq || '—', dueTag || '—', String(questions)],
      end: [Campo.rowButton('play', 'Iniciar visita', function () { startVisit(f); }, 'primary')],
      onclick: function () { startVisit(f); }
    });
  }

  function segNew(view) {
    var folders = Store.all('folders').sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    var forms = Store.all('forms').filter(function (f) { return !f.archived; });

    var dueByForm = {};
    Recurrence.upcoming().forEach(function (u) {
      if (Campo.plant() && u.centerId !== Campo.plant()) return;
      var prev = dueByForm[u.formId];
      if (!prev || u.date < prev.date) dueByForm[u.formId] = u;
    });

    view.appendChild(Campo.filterRow('forms-new', Campo.searchBox(st.q, 'Buscar cuestionario…', function (v) { st.q = v; Shell.render(); })));
    if (folders.length > 1) {
      view.appendChild(Campo.chips([{ value: '', label: 'Todos' }].concat(folders.map(function (f) {
        return { value: f.id, label: f.name, color: f.color };
      })), st.folder, function (v) { st.folder = v; Shell.render(); }));
    }

    var q = st.q.trim().toLowerCase();
    var shown = forms.filter(function (f) {
      if (st.folder && f.folderId !== st.folder) return false;
      if (q && (f.name + ' ' + (f.description || '')).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    // Los que tocan primero
    shown.sort(function (a, b) {
      var da = dueByForm[a.id] ? dueByForm[a.id].date : '9999', db = dueByForm[b.id] ? dueByForm[b.id].date : '9999';
      return da < db ? -1 : da > db ? 1 : a.name.localeCompare(b.name);
    });

    if (!shown.length) {
      view.appendChild(Campo.empty('clipboard', forms.length ? 'Sin resultados' : 'Todavía no hay cuestionarios',
        forms.length ? 'Prueba con otra búsqueda.' : 'Los cuestionarios se crean en la APP principal y llegan aquí al sincronizar.'));
      return;
    }
    if (Campo.viewMode('forms-new') === 'list') {
      var box = Campo.listBox('6px minmax(0,2.6fr) 150px 150px 100px 56px', ['', 'Cuestionario', 'Periodicidad', 'Próxima ronda', 'Preguntas', '']);
      shown.forEach(function (f) { box.appendChild(formRow(f, dueByForm)); });
      view.appendChild(box);
      return;
    }
    var grid = el('div', { class: 'f-grid' });
    shown.forEach(function (f) { grid.appendChild(formCard(f, dueByForm)); });
    view.appendChild(grid);
  }

  /* ======================================================================
     Borradores
     ====================================================================== */

  function drafts() {
    return Store.query('visits', function (v) {
      return v.status !== 'completed' && (!v.centerId || Campo.inPlant(v.centerId));
    }).sort(function (a, b) { return (b.updatedAt || '') < (a.updatedAt || '') ? -1 : 1; });
  }

  function draftRow(v) {
    var s = v.score || {};
    var plant = v.centerId ? Store.catalogName(v.centerId) : '';
    return Campo.listRow({
      color: '#E3A02F',
      title: v.formName || 'Visita',
      sub: 'Última edición ' + UI.fmtDateTime(v.updatedAt),
      meta: [UI.fmtDate(v.date), plant || null, s.total ? UI.num(s.ok + s.ko) + ' respondidas' : null],
      cells: [UI.fmtDate(v.date), plant || '—', UI.fmtDateTime(v.updatedAt)],
      end: [
        Campo.rowButton('play', 'Seguir la visita', function () { Shell.runVisit(v.formId, v.id); }, 'primary'),
        Campo.rowButton('trash', 'Descartar borrador', function () { removeVisit(v); })
      ],
      onclick: function () { Shell.runVisit(v.formId, v.id); }
    });
  }

  function segDrafts(view) {
    var rows = drafts();
    view.appendChild(Campo.filterRow('forms-drafts', null));
    if (!rows.length) {
      view.appendChild(Campo.empty('edit', 'No tienes visitas sin terminar',
        'Cuando guardes una visita como borrador o salgas sin terminarla, podrás retomarla desde aquí.'));
      return;
    }
    if (Campo.viewMode('forms-drafts') === 'list') {
      var box = Campo.listBox('6px minmax(0,2.4fr) 110px minmax(0,1fr) 170px 100px', ['', 'Visita', 'Fecha', 'Planta', 'Última edición', '']);
      rows.forEach(function (v) { box.appendChild(draftRow(v)); });
      view.appendChild(box);
      return;
    }
    var list = el('div', { class: 'f-list' });
    rows.forEach(function (v) {
      var s = v.score || {};
      list.appendChild(el('div', { class: 'f-item' }, [
        el('div', { class: 'f-item__badge f-item__badge--warn', html: ico('edit', 22) }),
        el('button', { class: 'f-item__main f-item__main--btn', type: 'button', onclick: function () { Shell.runVisit(v.formId, v.id); } }, [
          el('div', { class: 'f-item__title', text: v.formName || 'Visita' }),
          Campo.metaLine([
            ['calendar', UI.fmtDate(v.date)],
            v.centerId ? ['building', Store.catalogName(v.centerId)] : null,
            s.total ? ['checkCircle', UI.num(s.ok + s.ko) + ' respondidas'] : null
          ]),
          el('div', { class: 'f-item__sub', text: 'Última edición ' + UI.fmtDateTime(v.updatedAt) })
        ]),
        el('div', { class: 'f-item__side' }, [
          el('button', { class: 'btn btn--primary btn--sm f-btn-sm', type: 'button', html: ico('play', 16) + '<span>Seguir</span>', onclick: function () { Shell.runVisit(v.formId, v.id); } }),
          el('button', { class: 'f-iconbtn f-iconbtn--dark', 'aria-label': 'Descartar borrador', html: ico('trash', 18), onclick: function () { removeVisit(v); } })
        ])
      ]));
    });
    view.appendChild(list);
  }

  /* ======================================================================
     Realizadas
     ====================================================================== */

  function done() {
    return Store.query('visits', function (v) { return v.status === 'completed' && Campo.inPlant(v.centerId); })
      .sort(function (a, b) {
        var da = a.date || '', db = b.date || '';
        return db < da ? -1 : db > da ? 1 : ((b.createdAt || '') < (a.createdAt || '') ? -1 : 1);
      });
  }

  function mailChip(v) {
    var m = Mailer.lastStatus(v);
    if (!m) return null;
    if (m.status === 'sent') return Campo.tag('Enviado', 'ok', 'mail');
    if (m.status === 'queued') return Campo.tag('Envío en cola', 'warn', 'mail');
    return Campo.tag('Envío fallido', 'danger', 'mail');
  }

  function visitRow(v) {
    var s = v.score || { ok: 0, ko: 0, pct: 0, total: 0 };
    var col = UI.scoreColor(s.pct);
    var chips = [];
    if (s.ko) chips.push(Campo.tag(s.ko + (s.ko === 1 ? ' desviación' : ' desviaciones'), 'danger', 'alert'));
    else if (s.total) chips.push(Campo.tag('Sin desviaciones', 'ok', 'check'));
    var mc = mailChip(v);
    if (mc) chips.push(mc);

    return el('button', { class: 'f-item f-item--tap', type: 'button', onclick: function () { openVisit(v.id); } }, [
      el('div', {
        class: 'f-item__badge f-item__badge--score',
        style: s.total ? { background: col.bg, color: col.fg } : null,
        text: s.total ? UI.pct(s.pct) : '—'
      }),
      el('div', { class: 'f-item__main' }, [
        el('div', { class: 'f-item__title f-clamp-2', text: v.formName || 'Visita' }),
        Campo.metaLine([
          ['clipboard', v.code], ['calendar', UI.fmtDate(v.date)],
          v.centerId ? ['building', Store.catalogName(v.centerId)] : null,
          v.areaId ? ['mapPin', Store.catalogName(v.areaId)] : null
        ]),
        chips.length ? el('div', { class: 'f-item__tags' }, chips) : null
      ]),
      el('span', { class: 'f-item__chev', html: ico('chevronRight', 20) })
    ]);
  }

  function doneRow(v) {
    var s = v.score || { ok: 0, ko: 0, pct: 0, total: 0 };
    var col = UI.scoreColor(s.pct);
    var where = [v.centerId ? Store.catalogName(v.centerId) : '', v.areaId ? Store.catalogName(v.areaId) : ''].filter(Boolean).join(' · ');
    var dev = s.ko ? Campo.tag(s.ko + (s.ko === 1 ? ' desviación' : ' desviaciones'), 'danger', 'alert') : (s.total ? Campo.tag('Sin desviaciones', 'ok', 'check') : null);
    var mail = mailChip(v);

    return Campo.listRow({
      color: s.total ? col.fg : 'var(--ink-3)',
      title: v.formName || 'Visita',
      sub: v.code,
      meta: [s.total ? Campo.tag(UI.pct(s.pct), s.pct >= 90 ? 'ok' : s.pct >= 70 ? 'warn' : 'danger') : null, UI.fmtDate(v.date), where || null, dev, mail],
      cells: [v.code, UI.fmtDate(v.date), where || '—', dev || '—', s.total ? UI.pct(s.pct) : '—', mail || '—'],
      end: [el('span', { class: 'f-item__chev', html: ico('chevronRight', 20) })],
      onclick: function () { openVisit(v.id); }
    });
  }

  function segDone(view) {
    var all = done();
    view.appendChild(Campo.filterRow('forms-done', Campo.searchBox(st.q, 'Referencia, cuestionario, inspector…', function (v) { st.q = v; Shell.render(); })));

    // Chips por cuestionario (solo los que tienen visitas)
    var seen = {}, opts = [{ value: '', label: 'Todos' }];
    all.forEach(function (v) { if (v.formId && !seen[v.formId]) { seen[v.formId] = 1; opts.push({ value: v.formId, label: v.formName || 'Sin nombre' }); } });
    if (opts.length > 2) view.appendChild(Campo.chips(opts, st.formId, function (v) { st.formId = v; Shell.render(); }));

    var q = st.q.trim().toLowerCase();
    var rows = all.filter(function (v) {
      if (st.formId && v.formId !== st.formId) return false;
      if (q) {
        var hay = [v.code, v.formName, v.inspector, v.centerId ? Store.catalogName(v.centerId) : '', v.areaId ? Store.catalogName(v.areaId) : ''].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (!rows.length) {
      view.appendChild(Campo.empty('inbox', all.length ? 'Sin resultados' : 'Aún no hay visitas realizadas',
        all.length ? 'Prueba con otra búsqueda.' : 'Aquí se archivan las inspecciones terminadas' + (Campo.plant() ? ' en ' + Campo.plantName() : '') + ', con su PDF y el envío por correo.'));
      return;
    }
    view.appendChild(el('div', { class: 'f-count', text: UI.num(rows.length) + ' ' + UI.plural(rows.length, 'visita') }));
    if (Campo.viewMode('forms-done') === 'list') {
      var box = Campo.listBox('6px minmax(0,2fr) 140px 100px minmax(0,1fr) 140px 90px 130px 28px',
        ['', 'Cuestionario', 'Referencia', 'Fecha', 'Planta · Área', 'Desviaciones', '% conforme', 'Correo', '']);
      rows.forEach(function (v) { box.appendChild(doneRow(v)); });
      view.appendChild(box);
      return;
    }
    var grid = el('div', { class: 'f-list f-list--grid' });
    rows.forEach(function (v) { grid.appendChild(visitRow(v)); });
    view.appendChild(grid);
  }

  /* ======================================================================
     Detalle de una visita
     ====================================================================== */

  function sharePdf(v) {
    var blob = PDF.blobFor(v.id);
    if (!blob) { UI.toast('No se ha podido generar el PDF.', 'err'); return; }
    var c = PDF.emailContent(v);
    var file = new File([blob], c.filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: c.subject, text: c.body }).catch(function () {});
    } else {
      UI.download(c.filename, blob);
      UI.toast('PDF descargado.');
    }
  }

  function removeVisit(v) {
    var devs = Store.query('deviations', function (d) { return d.visitId === v.id; });
    var draft = v.status !== 'completed';
    UI.confirm({
      title: draft ? 'Descartar el borrador' : 'Eliminar visita ' + v.code,
      text: devs.length
        ? 'Se eliminarán también sus ' + devs.length + ' ' + UI.plural(devs.length, 'desviación', 'desviaciones') +
          ' y las acciones correctoras asociadas, en todos los dispositivos. No se puede deshacer.'
        : 'Se eliminará en todos los dispositivos. No se puede deshacer.',
      confirmLabel: draft ? 'Descartar' : 'Eliminar visita'
    }).then(function (ok) {
      if (!ok) return;
      devs.forEach(function (d) {
        Store.query('actions', function (a) { return a.deviationId === d.id; })
          .forEach(function (a) { Store.remove('actions', a.id); });
        Store.remove('deviations', d.id);
      });
      Store.remove('visits', v.id);
      UI.toast(draft ? 'Borrador descartado.' : 'Visita eliminada.');
      Shell.render();
    });
  }

  function openVisit(id) {
    var v = Store.get('visits', id);
    if (!v) { UI.toast('La visita ya no existe.', 'err'); return; }
    var s = v.score || { ok: 0, ko: 0, pct: 0, total: 0 };
    var body = el('div');

    body.appendChild(el('div', { class: 'f-kpis f-kpis--3' }, [
      el('div', { class: 'f-mini' }, [el('strong', { style: { color: 'var(--ok)' }, text: UI.num(s.ok) }), el('span', { text: 'Conformes' })]),
      el('div', { class: 'f-mini' }, [el('strong', { style: { color: 'var(--coral-dark)' }, text: UI.num(s.ko) }), el('span', { text: 'Desviaciones' })]),
      el('div', { class: 'f-mini' }, [el('strong', { style: { color: UI.scoreColor(s.pct).fg }, text: s.total ? UI.pct(s.pct) : '—' }), el('span', { text: '% conforme' })])
    ]));

    var card = el('div', { class: 'f-card f-card--flat' });
    [
      ['Referencia', v.code], ['Fecha', UI.fmtDate(v.date)], ['Inspector', v.inspector || '—'],
      ['Planta', v.centerId ? Store.catalogName(v.centerId) : '—'], ['Área', v.areaId ? Store.catalogName(v.areaId) : '—']
    ].forEach(function (r) { card.appendChild(el('div', { class: 'f-kv' }, [el('span', { text: r[0] }), el('strong', { text: r[1] })])); });
    body.appendChild(card);

    // Estado del envío por correo
    var log = (v.emailLog || []).slice().reverse();
    if (log.length) {
      body.appendChild(el('div', { class: 'f-section-title', text: 'Envíos por correo' }));
      var lc = el('div', { class: 'f-card f-card--flat' });
      log.slice(0, 4).forEach(function (m) {
        var kind = m.status === 'sent' ? 'ok' : m.status === 'queued' ? 'warn' : 'danger';
        var label = m.status === 'sent' ? 'Enviado' : m.status === 'queued' ? 'En cola' : 'Fallido';
        lc.appendChild(el('div', { class: 'f-mail' }, [
          Campo.tag(label, kind),
          el('div', { class: 'f-mail__main' }, [
            el('div', { text: (m.to || []).join(', ') }),
            el('div', { class: 'f-hint', text: UI.fmtDateTime(m.sentAt || m.at) + (m.error ? ' · ' + m.error : '') })
          ])
        ]));
      });
      body.appendChild(lc);
    }

    if (v.status === 'completed' && (s.ko || 0) > 0) {
      body.appendChild(el('button', {
        class: 'btn btn--ghost btn--block f-btn', style: { marginTop: '14px' },
        html: ico('alert', 18) + '<span>Ver sus ' + s.ko + (s.ko === 1 ? ' desviación' : ' desviaciones') + '</span>',
        onclick: function () { sh.close(); Shell.go('deviations', { visitId: v.id }); }
      }));
    }

    body.appendChild(el('button', {
      class: 'btn btn--danger btn--block f-btn', style: { marginTop: '10px' },
      html: ico('trash', 18) + '<span>Eliminar visita</span>',
      onclick: function () { sh.close(); removeVisit(v); }
    }));

    var sh = Campo.sheet({
      title: v.formName || 'Visita', subtitle: v.code + ' · ' + UI.fmtDate(v.date), body: body,
      footer: [
        el('button', {
          class: 'btn btn--primary f-btn f-grow', html: ico('mail', 18) + '<span>Enviar por correo</span>',
          onclick: function () { PDF.sendByEmail(v.id); }
        }),
        el('button', { class: 'btn btn--ghost f-btn f-iconfull', 'aria-label': 'Ver PDF', html: ico('filePdf', 20), onclick: function () { PDF.open(v.id); } }),
        el('button', { class: 'btn btn--ghost f-btn f-iconfull', 'aria-label': 'Compartir PDF', html: ico('send', 20), onclick: function () { sharePdf(v); } }),
        el('button', { class: 'btn btn--ghost f-btn f-iconfull', 'aria-label': 'Editar visita', html: ico('edit', 20), onclick: function () { sh.close(); Shell.runVisit(v.formId, v.id); } })
      ]
    });
  }

  /* ======================================================================
     Pantalla
     ====================================================================== */

  function render(params) {
    if (params && params.seg) st.seg = params.seg;
    var view = UI.$('#view');
    var nDrafts = drafts().length;

    view.appendChild(el('div', { class: 'f-toolbar' }, [
      el('h1', { class: 'f-title', text: 'Cuestionarios' }),
      Campo.segmented([
        { value: 'new', label: 'Nueva' },
        { value: 'drafts', label: 'Sin terminar', count: nDrafts || '' },
        { value: 'done', label: 'Realizadas' }
      ], st.seg, function (v) { st.seg = v; st.q = ''; st.formId = ''; Shell.render(); })
    ]));

    if (st.seg === 'drafts') segDrafts(view);
    else if (st.seg === 'done') segDone(view);
    else segNew(view);
  }

  Views.forms = { render: render, startFor: startFor, openVisit: openVisit };
})(window);
