/* ==========================================================================
   Safety Rounds · Campo — Calendario
   Tres tipos de entrada, todas filtradas por la planta elegida:
     · rondas previstas (periodicidad de cada cuestionario, igual que en la
       APP principal, proyectadas a todo el mes)
     · visitas ya realizadas
     · vencimientos del plan de acción
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el, esc = UI.esc;
  var Views = global.Views = global.Views || {};

  var DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  var DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var today = new Date();
  var st = { year: today.getFullYear(), month: today.getMonth(), selected: UI.fmtDateInput(today), mode: 'month' };

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dstr(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }

  /* ---------- Entradas del calendario ---------- */

  function itemsBetween(from, to) {
    var out = [];

    Recurrence.occurrences(from, to).forEach(function (u) {
      if (!Campo.inPlant(u.centerId)) return;
      out.push({
        type: 'plan', date: u.date, title: u.formName, sub: u.centerName,
        kind: u.overdue ? 'danger' : u.daysUntil <= 7 ? 'warn' : 'navy', icon: 'clipboard', data: u
      });
    });

    Store.query('visits', function (v) {
      return v.status === 'completed' && v.date >= from && v.date <= to && Campo.inPlant(v.centerId);
    }).forEach(function (v) {
      out.push({
        type: 'done', date: v.date, title: v.formName || 'Visita', sub: (v.code || '') + (v.centerId ? ' · ' + Store.catalogName(v.centerId) : ''),
        kind: 'ok', icon: 'checkCircle', data: v
      });
    });

    Store.query('actions', function (a) {
      return a.status !== 'done' && a.dueDate && a.dueDate >= from && a.dueDate <= to && Campo.inPlant(a.centerId);
    }).forEach(function (a) {
      var over = UI.relativeDays(a.dueDate) < 0;
      out.push({
        type: 'action', date: a.dueDate, title: a.title || 'Acción correctora',
        sub: (a.responsible ? a.responsible + ' · ' : '') + (a.centerId ? Store.catalogName(a.centerId) : ''),
        kind: over ? 'danger' : 'warn', icon: 'target', data: a
      });
    });

    var rank = { plan: 0, action: 1, done: 2 };
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : rank[a.type] - rank[b.type]; });
    return out;
  }

  var TYPE_LABEL = { plan: 'Ronda', done: 'Realizada', action: 'Vencimiento' };

  /* ---------- Apertura de una entrada ---------- */

  function open(it) {
    if (it.type === 'done') { Views.forms.openVisit(it.data.id); return; }
    if (it.type === 'action') { Views.actions.openDetail(it.data.id); return; }

    var u = it.data;
    var body = el('div');
    [
      ['Planta', u.centerName],
      ['Periodicidad', u.freqLabel],
      ['Última visita', u.lastDate ? UI.fmtDate(u.lastDate) : 'Todavía no se ha realizado'],
      ['Fecha prevista', UI.fmtDate(u.date) + ' · ' + Recurrence.dueLabel(u.daysUntil)]
    ].forEach(function (r) {
      body.appendChild(el('div', { class: 'f-kv' }, [el('span', { text: r[0] }), el('strong', { text: r[1] })]));
    });
    if (u.projected) {
      body.appendChild(el('div', { class: 'f-hint', style: { marginTop: '12px' },
        text: 'Esta fecha es una previsión: se recalcula a partir de la última visita que se realice.' }));
    }
    var s = Campo.sheet({
      title: u.formName, subtitle: 'Ronda prevista', body: body,
      footer: [el('button', {
        class: 'btn btn--primary btn--block f-btn', html: ico('play', 18) + '<span>Iniciar esta visita</span>',
        onclick: function () { s.close(); Views.forms.startFor(u.formId, u.centerId); }
      })]
    });
  }

  /* ---------- Piezas ---------- */

  function itemRow(it, showDate) {
    var dateLabel = '';
    if (showDate) {
      var d = UI.toDate(it.date);
      dateLabel = d ? DOW_LONG[d.getDay()].slice(0, 3) + ' ' + d.getDate() : '';
    }
    return el('button', { class: 'f-item f-item--tap', type: 'button', onclick: function () { open(it); } }, [
      el('div', { class: 'f-item__badge f-item__badge--' + it.kind, html: ico(it.icon, 22) }),
      el('div', { class: 'f-item__main' }, [
        el('div', { class: 'f-item__title f-clamp-2', text: it.title }),
        el('div', { class: 'f-item__sub', text: it.sub })
      ]),
      el('div', { class: 'f-item__side' }, [
        Campo.tag(TYPE_LABEL[it.type], it.kind === 'navy' ? 'navy' : it.kind),
        dateLabel ? el('span', { class: 'f-item__date', text: dateLabel }) : null
      ])
    ]);
  }

  function shiftMonth(delta) {
    var d = new Date(st.year, st.month + delta, 1);
    st.year = d.getFullYear(); st.month = d.getMonth();
    // Se mantiene el mismo día si existe; si no, el último del mes
    var last = new Date(st.year, st.month + 1, 0).getDate();
    var day = Math.min(parseInt(st.selected.slice(8), 10), last);
    st.selected = dstr(st.year, st.month, day);
    Shell.render();
  }

  function goToday() {
    var n = new Date();
    st.year = n.getFullYear(); st.month = n.getMonth(); st.selected = UI.fmtDateInput(n);
    Shell.render();
  }

  function header() {
    return el('div', { class: 'f-cal-head' }, [
      el('button', { class: 'f-iconbtn f-iconbtn--dark', 'aria-label': 'Mes anterior', html: ico('chevronLeft', 22), onclick: function () { shiftMonth(-1); } }),
      el('div', { class: 'f-cal-head__title' }, [
        el('strong', { text: MONTHS_LONG[st.month][0].toUpperCase() + MONTHS_LONG[st.month].slice(1) }),
        el('span', { text: String(st.year) })
      ]),
      el('button', { class: 'f-iconbtn f-iconbtn--dark', 'aria-label': 'Mes siguiente', html: ico('chevronRight', 22), onclick: function () { shiftMonth(1); } }),
      el('button', { class: 'btn btn--ghost btn--sm f-btn-sm', type: 'button', text: 'Hoy', onclick: goToday })
    ]);
  }

  function grid(items) {
    var byDate = {};
    items.forEach(function (it) { (byDate[it.date] = byDate[it.date] || []).push(it); });

    var box = el('div', { class: 'f-cal' });
    DOW.forEach(function (d) { box.appendChild(el('div', { class: 'f-cal__dow', text: d })); });

    var first = new Date(st.year, st.month, 1);
    var offset = (first.getDay() + 6) % 7;
    var days = new Date(st.year, st.month + 1, 0).getDate();
    var cells = Math.ceil((offset + days) / 7) * 7;
    var todayStr = UI.fmtDateInput(new Date());

    for (var i = 0; i < cells; i++) {
      var cd = new Date(st.year, st.month, i - offset + 1);
      var ds = UI.fmtDateInput(cd);
      var inMonth = cd.getMonth() === st.month;
      var dayItems = byDate[ds] || [];

      var kinds = [];
      ['danger', 'warn', 'navy', 'ok'].forEach(function (k) {
        if (dayItems.some(function (x) { return x.kind === k; })) kinds.push(k);
      });

      var cell = el('button', {
        class: 'f-cal__day' + (inMonth ? '' : ' is-out') + (ds === todayStr ? ' is-today' : '') + (ds === st.selected ? ' is-selected' : ''),
        type: 'button', 'data-date': ds,
        'aria-label': cd.getDate() + ' de ' + MONTHS_LONG[cd.getMonth()] + (dayItems.length ? ', ' + dayItems.length + ' entradas' : ''),
        onclick: (function (dateStr, d) {
          return function () {
            st.selected = dateStr;
            if (d.getMonth() !== st.month) { st.year = d.getFullYear(); st.month = d.getMonth(); }
            Shell.render();
          };
        })(ds, cd)
      }, [
        el('span', { class: 'f-cal__num', text: String(cd.getDate()) }),
        el('span', { class: 'f-cal__dots' }, kinds.slice(0, 3).map(function (k) { return el('span', { class: 'f-cal__dot f-cal__dot--' + k }); })),
        dayItems.length > 1 ? el('span', { class: 'f-cal__n', text: String(dayItems.length) }) : null
      ]);
      box.appendChild(cell);
    }

    // Deslizar para cambiar de mes
    var x0 = null;
    box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 70) shiftMonth(dx < 0 ? 1 : -1);
    });
    return box;
  }

  function legend() {
    function item(k, t) { return el('span', { class: 'f-legend__item' }, [el('span', { class: 'f-cal__dot f-cal__dot--' + k }), el('span', { text: t })]); }
    return el('div', { class: 'f-legend' }, [item('danger', 'Vencido'), item('warn', 'Esta semana'), item('navy', 'Ronda prevista'), item('ok', 'Realizada')]);
  }

  /* ---------- Vista mensual ---------- */

  function monthView(view) {
    var first = new Date(st.year, st.month, 1);
    var offset = (first.getDay() + 6) % 7;
    var days = new Date(st.year, st.month + 1, 0).getDate();
    var cells = Math.ceil((offset + days) / 7) * 7;
    var from = UI.fmtDateInput(new Date(st.year, st.month, 1 - offset));
    var to = UI.fmtDateInput(new Date(st.year, st.month, cells - offset));

    var items = itemsBetween(from, to);

    var left = el('div', { class: 'f-cal-wrap' }, [header(), grid(items), legend()]);
    var right = el('div', { class: 'f-cal-day' });

    var d = UI.toDate(st.selected);
    var dayItems = items.filter(function (it) { return it.date === st.selected; });
    right.appendChild(el('h2', { class: 'f-section__title', text: DOW_LONG[d.getDay()][0].toUpperCase() + DOW_LONG[d.getDay()].slice(1) + ', ' + d.getDate() + ' de ' + MONTHS_LONG[d.getMonth()] }));
    if (dayItems.length) {
      var list = el('div', { class: 'f-list' });
      dayItems.forEach(function (it) { list.appendChild(itemRow(it, false)); });
      right.appendChild(list);
    } else {
      right.appendChild(el('div', { class: 'f-note' }, [
        el('span', { html: ico('calendar', 20) }),
        el('span', { text: 'Nada previsto este día' + (Campo.plant() ? ' en ' + Campo.plantName() : '') + '.' })
      ]));
    }

    view.appendChild(el('div', { class: 'f-split' }, [left, right]));
  }

  /* ---------- Agenda ---------- */

  function agendaView(view) {
    var from = UI.fmtDateInput(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()));
    var to = UI.fmtDateInput(new Date(new Date().getFullYear(), new Date().getMonth() + 2, new Date().getDate()));
    var items = itemsBetween(from, to).filter(function (it) { return it.type !== 'done'; });
    var todayStr = UI.fmtDateInput(new Date());

    var groups = [
      ['Vencidas', function (it) { return it.date < todayStr; }],
      ['Hoy', function (it) { return it.date === todayStr; }],
      ['Esta semana', function (it) { var d = UI.relativeDays(it.date); return d > 0 && d <= 7; }],
      ['Este mes y el siguiente', function (it) { return UI.relativeDays(it.date) > 7; }]
    ];
    var any = false;
    groups.forEach(function (g) {
      var rows = items.filter(g[1]);
      if (!rows.length) return;
      any = true;
      view.appendChild(el('h2', { class: 'f-section__title f-section__title--sticky', text: g[0] + ' · ' + rows.length }));
      var list = el('div', { class: 'f-list' });
      rows.forEach(function (it) { list.appendChild(itemRow(it, true)); });
      view.appendChild(list);
    });
    if (!any) {
      view.appendChild(Campo.empty('calendar', 'Nada pendiente',
        'No hay rondas previstas ni vencimientos' + (Campo.plant() ? ' en ' + Campo.plantName() : '') + '. Las rondas aparecen si el cuestionario tiene periodicidad configurada.'));
    }
  }

  function render() {
    var view = UI.$('#view');
    view.appendChild(el('div', { class: 'f-toolbar' }, [
      el('h1', { class: 'f-title', text: 'Calendario' }),
      Campo.segmented([{ value: 'month', label: 'Mes' }, { value: 'agenda', label: 'Agenda' }], st.mode,
        function (v) { st.mode = v; Shell.render(); })
    ]));
    if (st.mode === 'agenda') agendaView(view); else monthView(view);
  }

  Views.calendar = { render: render };
})(window);
