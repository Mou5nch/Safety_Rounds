/* ==========================================================================
   Safety Rounds — Calendario
   Vista de solo lectura con las próximas visitas de los cuestionarios
   recurrentes: calendario mensual + agenda. Las fechas se calculan a partir
   de la periodicidad configurada en cada cuestionario (js/recurrence.js).
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el, esc = UI.esc;
  var DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  var today = new Date();
  var cal = { year: today.getFullYear(), month: today.getMonth() };

  function render() {
    var view = UI.$('#view');
    view.className = 'view';
    UI.clear(view);

    App.setHeader('Calendario', 'Próximas visitas según la periodicidad configurada en cada cuestionario');

    var items = Recurrence.upcoming();
    if (!items.length) {
      view.appendChild(emptyState());
      return;
    }

    var itemsByDate = {};
    items.forEach(function (it) { (itemsByDate[it.date] = itemsByDate[it.date] || []).push(it); });

    view.appendChild(renderNav());
    view.appendChild(renderGrid(itemsByDate));
    view.appendChild(renderAgenda(items));
  }

  function emptyState() {
    return el('div', { class: 'card' }, el('div', { class: 'card__body' },
      UI.empty('calendar', 'Ningún cuestionario recurrente configurado',
        'Activa la periodicidad de un cuestionario y elige en qué centros debe repetirse desde Configuración de cuestionarios, y aquí verás sus próximas visitas.',
        el('button', {
          class: 'btn btn--primary', html: ico('sliders', 17) + '<span>Ir a Configuración de cuestionarios</span>',
          onclick: function () { App.go('configuracion'); }
        }))));
  }

  /* ---------- Navegación de mes ---------- */

  function shiftMonth(delta) {
    var d = new Date(cal.year, cal.month + delta, 1);
    cal.year = d.getFullYear(); cal.month = d.getMonth();
    render();
  }

  function goToday() {
    var n = new Date();
    cal.year = n.getFullYear(); cal.month = n.getMonth();
    render();
  }

  function renderNav() {
    var key = cal.year + '-' + UI.pad(cal.month + 1);
    var box = el('div', { class: 'cal-head' });

    box.appendChild(el('div', { class: 'cal-head__title', text: UI.monthLabelLong(key) }));

    var nav = el('div', { class: 'cal-nav' });
    nav.appendChild(el('button', {
      class: 'btn btn--ghost btn--sm btn--icon', title: 'Mes anterior', html: ico('chevronLeft', 16),
      onclick: function () { shiftMonth(-1); }
    }));
    nav.appendChild(el('button', { class: 'btn btn--ghost btn--sm', text: 'Hoy', onclick: goToday }));
    nav.appendChild(el('button', {
      class: 'btn btn--ghost btn--sm btn--icon', title: 'Mes siguiente', html: ico('chevronRight', 16),
      onclick: function () { shiftMonth(1); }
    }));
    box.appendChild(nav);

    box.appendChild(el('div', { class: 'cal-legend' }, [
      legendItem('var(--coral)', 'Vencida'),
      legendItem('var(--warn)', 'Esta semana'),
      legendItem('var(--navy-soft)', 'Próxima')
    ]));

    return box;
  }

  function legendItem(color, text) {
    return el('span', { class: 'cal-legend__item' }, [
      el('span', { class: 'cal-legend__dot', style: { background: color } }),
      el('span', { text: text })
    ]);
  }

  /* ---------- Cuadrícula mensual ---------- */

  function renderGrid(itemsByDate) {
    var grid = el('div', { class: 'cal-grid' });
    DOW.forEach(function (d) { grid.appendChild(el('div', { class: 'cal-dow', text: d })); });

    var first = new Date(cal.year, cal.month, 1);
    var startOffset = (first.getDay() + 6) % 7; // semana empieza en lunes
    var daysInMonth = new Date(cal.year, cal.month + 1, 0).getDate();
    var totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    var todayStr = UI.fmtDateInput(new Date());

    for (var i = 0; i < totalCells; i++) {
      var dayNum = i - startOffset + 1;
      var cellDate = new Date(cal.year, cal.month, dayNum);
      var dateStr = UI.fmtDateInput(cellDate);
      var inMonth = dayNum >= 1 && dayNum <= daysInMonth;
      var dayItems = itemsByDate[dateStr] || [];

      var cell = el('div', {
        class: 'cal-day' + (!inMonth ? ' cal-day--out' : '') + (dateStr === todayStr ? ' cal-day--today' : '')
      });
      cell.appendChild(el('div', { class: 'cal-day__num', text: String(cellDate.getDate()) }));

      dayItems.slice(0, 2).forEach(function (it) {
        cell.appendChild(el('button', {
          class: 'cal-chip' + (it.overdue ? ' cal-chip--overdue' : it.daysUntil <= 7 ? ' cal-chip--soon' : ''),
          title: it.formName + ' · ' + it.centerName,
          text: it.formName,
          onclick: function () { openDetail(it); }
        }));
      });
      if (dayItems.length > 2) {
        cell.appendChild(el('div', { class: 'cal-chip cal-chip--more', text: '+' + (dayItems.length - 2) + ' más' }));
      }

      grid.appendChild(cell);
    }

    return grid;
  }

  function openDetail(it) {
    UI.modal({
      title: it.formName,
      subtitle: it.centerName,
      icon: 'calendar',
      body: el('div', { style: { paddingBottom: '6px' } }, [
        detailRow('Periodicidad', it.freqLabel),
        detailRow('Última visita', it.lastDate ? UI.fmtDate(it.lastDate) : 'Todavía no se ha realizado'),
        detailRow('Próxima visita', UI.fmtDate(it.date) + ' · ' + Recurrence.dueLabel(it.daysUntil))
      ]),
      buttons: [
        { label: 'Cerrar', kind: 'quiet' },
        { label: 'Nueva visita', kind: 'primary', icon: 'play', onClick: function () { Runner.start(it.formId); } }
      ]
    });
  }

  function detailRow(label, value) {
    return el('div', {
      style: { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '9px 0', borderBottom: '1px solid var(--line-soft)', fontSize: '13.5px' }
    }, [
      el('span', { style: { color: 'var(--ink-2)' }, text: label }),
      el('strong', { style: { textAlign: 'right' }, text: value })
    ]);
  }

  /* ---------- Agenda ---------- */

  function bucketOf(daysUntil) {
    if (daysUntil < 0) return 'Vencidas';
    if (daysUntil <= 7) return 'Esta semana';
    if (daysUntil <= 30) return 'Este mes';
    return 'Más adelante';
  }

  function renderAgenda(items) {
    var box = el('div', {});
    var lastBucket = null;
    items.forEach(function (it) {
      var b = bucketOf(it.daysUntil);
      if (b !== lastBucket) {
        box.appendChild(el('div', {
          style: { fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-3)', margin: '22px 0 10px' },
          text: b
        }));
        lastBucket = b;
      }
      box.appendChild(agendaRow(it));
    });
    return box;
  }

  function agendaRow(it) {
    var color = it.overdue ? { bg: 'var(--coral-wash)', fg: 'var(--coral-dark)' }
      : it.daysUntil <= 7 ? { bg: 'var(--warn-wash)', fg: 'var(--warn)' }
      : { bg: 'var(--navy-wash)', fg: 'var(--navy)' };

    var row = el('div', { class: 'visit-row' });
    row.appendChild(el('div', { class: 'visit-row__score', style: { background: color.bg, color: color.fg }, html: ico('calendar', 19) }));

    var metaParts = [
      el('span', { html: ico('building', 13) + '<span>' + esc(it.centerName) + '</span>' }),
      el('span', { html: ico('refresh', 13) + '<span>' + esc(it.freqLabel) + '</span>' }),
      it.isFirst ? el('span', { html: ico('info', 13) + '<span>Aún no realizada</span>' }) : null
    ].filter(Boolean);

    row.appendChild(el('div', { class: 'visit-row__main' }, [
      el('div', { class: 'visit-row__title', text: it.formName }),
      el('div', { class: 'visit-row__meta' }, metaParts)
    ]));

    row.appendChild(el('div', { class: 'visit-row__tags' }, el('span', {
      class: 'tag ' + (it.overdue ? 'tag--danger' : it.daysUntil <= 7 ? 'tag--warn' : ''),
      text: Recurrence.dueLabel(it.daysUntil)
    })));

    row.appendChild(el('div', { class: 'visit-row__actions' }, el('button', {
      class: 'btn btn--primary btn--sm btn--icon', title: 'Nueva visita', html: ico('play', 15),
      onclick: function () { Runner.start(it.formId); }
    })));

    return row;
  }

  /* ---------- Exposición ---------- */

  global.Calendar = { render: render };
})(window);
