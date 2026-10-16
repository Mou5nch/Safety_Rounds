/* ==========================================================================
   Safety Rounds — Calendario
   Todo lo que viene, de un vistazo y con la planta como filtro:
     · cuadrícula del mes con una marca por entrada (planta + tipo + urgencia)
     · a la derecha, «De un vistazo»: cifras (vencido / esta semana / más
       adelante), la próxima ronda de cada planta y las próximas caducidades
       de las desviaciones (fechas límite del plan de acción)
   Los datos salen de CalData (js/calendar-data.js), los mismos que usa
   Safety Go; las rondas, de la periodicidad de cada cuestionario
   (js/recurrence.js).
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el, esc = UI.esc;
  var DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  var DOW_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var PLANT_KEY = 'sr:cal:plant';
  var MAX_MARKS = 3;
  var EXPIRY_CAP = 6;

  var today = new Date();
  var cal = {
    year: today.getFullYear(), month: today.getMonth(),
    plant: '',
    types: { plan: true, expiry: true, done: true },
    allExpiries: false
  };
  try { cal.plant = localStorage.getItem(PLANT_KEY) || ''; } catch (e) {}

  var KIND = { late: 'danger', soon: 'warn', later: 'navy', done: 'ok' };
  var ICON = { plan: 'clipboard', expiry: 'flag', done: 'checkCircle', nodate: 'alertCircle' };
  var MARK_WORD = { plan: 'Ronda', expiry: 'Vence', done: 'Hecha' };

  function plant() {
    if (cal.plant && !Store.get('catalogs', cal.plant)) cal.plant = '';
    return cal.plant;
  }

  function setPlant(id) {
    cal.plant = id || '';
    try { localStorage.setItem(PLANT_KEY, cal.plant); } catch (e) {}
    render();
  }

  function shortDate(s) {
    var d = UI.toDate(s);
    return d ? DOW_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] : '';
  }

  function plantLabel(centerId) {
    if (!centerId) return null;
    return el('span', { class: 'cal-plant' }, [
      el('span', { class: 'cal-plant__dot', style: { background: CalData.plantColor(centerId) } }),
      el('span', { text: Store.catalogName(centerId) })
    ]);
  }

  /* ---------- Apertura de una entrada ---------- */

  function open(it) {
    if (it.type === 'plan') { openRound(it.data); return; }
    if (it.type === 'expiry' || (it.type === 'nodate' && it.id)) {
      var a = Store.get('actions', it.id);
      if (a) { Lists.editAction(a, render); return; }
    }
    if (it.type === 'nodate') { App.go('desviaciones'); return; }
    if (it.type === 'done') { PDF.open(it.data.id); }
  }

  function openRound(u) {
    UI.modal({
      title: u.formName,
      subtitle: u.centerName,
      icon: 'calendar',
      body: el('div', { style: { paddingBottom: '6px' } }, [
        detailRow('Periodicidad', u.freqLabel),
        detailRow('Última visita', u.lastDate ? UI.fmtDate(u.lastDate) : 'Todavía no se ha realizado'),
        detailRow('Fecha prevista', UI.fmtDate(u.date) + ' · ' + Recurrence.dueLabel(u.daysUntil)),
        u.projected ? el('div', { class: 'hint', style: { marginTop: '10px' }, text: 'Esta fecha es una previsión: se recalcula a partir de la última visita que se realice.' }) : null
      ]),
      buttons: [
        { label: 'Cerrar', kind: 'quiet' },
        { label: 'Nueva visita', kind: 'primary', icon: 'play', onClick: function () { Runner.start(u.formId, null, { centerId: u.centerId }); } }
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

  /* ---------- Filtro de planta y de tipo ---------- */

  function plantBar(all) {
    var cur = plant();
    var by = {}, total = { n: 0, late: 0 };
    all.rounds.concat(all.expiries).forEach(function (it) {
      if (it.urgency === 'later') return;
      var b = by[it.centerId] = by[it.centerId] || { n: 0, late: 0 };
      b.n++; total.n++;
      if (it.urgency === 'late') { b.late++; total.late++; }
    });

    function chip(id, label, color, b) {
      return el('button', {
        class: 'cal-pchip' + (cur === id ? ' is-on' : ''), type: 'button', 'aria-pressed': cur === id ? 'true' : 'false',
        title: id ? 'Ver solo ' + label : 'Ver todas las plantas',
        onclick: function () { if (cur !== id) setPlant(id); }
      }, [
        color ? el('span', { class: 'cal-pchip__dot', style: { background: color } }) : el('span', { class: 'cal-pchip__ico', html: ico('layers', 14) }),
        el('span', { text: label }),
        b && b.n ? el('span', { class: 'cal-pchip__n' + (b.late ? ' is-late' : ''), text: String(b.n) }) : null
      ]);
    }

    var box = el('div', { class: 'cal-pbar', role: 'group', 'aria-label': 'Planta' });
    box.appendChild(chip('', 'Todas las plantas', '', total));
    CalData.centers().forEach(function (c) { box.appendChild(chip(c.id, c.name, CalData.plantColor(c.id), by[c.id])); });
    return box;
  }

  function mark(it, codes, single) {
    // Con todas las plantas: código de planta + tipo (el tipo se oculta si la casilla es estrecha).
    // Con una sola, el código sobra: tipo y, si cabe, el título del cuestionario.
    var kids = [el('span', { html: ico(ICON[it.type], 11) })];
    if (!single) kids.push(el('b', { text: codes[it.centerId] || '—' }));
    kids.push(el('span', { class: 'cal-mark__word', text: MARK_WORD[it.type] }));
    if (single) kids.push(el('span', { class: 'cal-mark__txt', text: it.title }));
    return el('span', { class: 'cal-mark cal-mark--' + it.type + ' cal-mark--' + it.urgency + (single ? ' cal-mark--single' : '') }, kids);
  }

  /** Leyenda que también filtra: tocar un tipo lo oculta o lo muestra en la cuadrícula. */
  function legend() {
    function toggle(type, label) {
      var on = cal.types[type];
      return el('button', {
        class: 'cal-legend__btn' + (on ? ' is-on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false',
        title: on ? 'Ocultar ' + label.toLowerCase() : 'Mostrar ' + label.toLowerCase(),
        onclick: function () { cal.types[type] = !cal.types[type]; render(); }
      }, [
        el('span', { class: 'cal-mark cal-mark--' + type + ' cal-mark--' + (type === 'done' ? 'done' : type === 'plan' ? 'soon' : 'late') + ' cal-mark--sample', html: ico(ICON[type], 11) }),
        el('span', { text: label })
      ]);
    }
    function key(c, t) { return el('span', { class: 'cal-legend__item' }, [el('span', { class: 'cal-legend__dot', style: { background: c } }), el('span', { text: t })]); }
    return el('div', { class: 'cal-legend2' }, [
      el('div', { class: 'cal-legend2__tg' }, [toggle('plan', 'Rondas'), toggle('expiry', 'Caducidades'), toggle('done', 'Hechas')]),
      el('div', { class: 'cal-legend2__key' }, [key('var(--coral)', 'Vencido'), key('var(--warn)', 'Esta semana'), key('var(--navy-soft)', 'Más adelante')])
    ]);
  }

  function renderNav() {
    var key = cal.year + '-' + UI.pad(cal.month + 1);
    return el('div', { class: 'cal-head' }, [
      el('div', { class: 'cal-head__title', text: UI.monthLabelLong(key) }),
      el('div', { class: 'cal-nav' }, [
        el('button', { class: 'btn btn--ghost btn--sm btn--icon', title: 'Mes anterior', html: ico('chevronLeft', 16), onclick: function () { shiftMonth(-1); } }),
        el('button', { class: 'btn btn--ghost btn--sm', text: 'Hoy', onclick: goToday }),
        el('button', { class: 'btn btn--ghost btn--sm btn--icon', title: 'Mes siguiente', html: ico('chevronRight', 16), onclick: function () { shiftMonth(1); } })
      ])
    ]);
  }

  /* ---------- Cuadrícula mensual ---------- */

  function renderGrid(items) {
    var byDate = {};
    items.forEach(function (it) { (byDate[it.date] = byDate[it.date] || []).push(it); });
    var codes = CalData.plantCodes();
    var single = !!plant();

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
      var dayItems = byDate[dateStr] || [];

      var cell = el('div', {
        class: 'cal-day' + (!inMonth ? ' cal-day--out' : '') + (dateStr === todayStr ? ' cal-day--today' : '')
      });
      cell.appendChild(el('div', { class: 'cal-day__num', text: String(cellDate.getDate()) }));

      dayItems.slice(0, MAX_MARKS).forEach(function (it) {
        var m = mark(it, codes, single);
        var b = el('button', {
          class: 'cal-markbtn', type: 'button',
          title: it.title + (it.centerId ? ' · ' + Store.catalogName(it.centerId) : '') + ' · ' + (it.type === 'done' ? 'hecha' : CalData.when(it.daysUntil).toLowerCase()),
          onclick: function () { open(it); }
        }, m);
        cell.appendChild(b);
      });
      if (dayItems.length > MAX_MARKS) {
        cell.appendChild(el('div', { class: 'cal-chip cal-chip--more', text: '+' + (dayItems.length - MAX_MARKS) + ' más' }));
      }

      grid.appendChild(cell);
    }
    return grid;
  }

  /* ---------- Panel «De un vistazo» ---------- */

  function glance(counts) {
    function tile(kind, icon, value, label) {
      return el('div', { class: 'cal-glance__tile cal-glance__tile--' + kind }, [
        el('span', { class: 'cal-glance__ico', html: ico(icon, 17) }),
        el('strong', { text: String(value) }),
        el('span', { text: label })
      ]);
    }
    return el('div', { class: 'cal-glance' }, [
      tile(counts.late ? 'late' : 'ok', counts.late ? 'alert' : 'checkCircle', counts.late, counts.late === 1 ? 'Vencida' : 'Vencidas'),
      tile('soon', 'clock', counts.soon, 'Esta semana'),
      tile('later', 'calendar', counts.later, 'Más adelante')
    ]);
  }

  function sideHead(icon, title, count) {
    return el('div', { class: 'cal-sec' }, [
      el('span', { class: 'cal-sec__ico', html: ico(icon, 16) }),
      el('h3', { class: 'cal-sec__title', text: title }),
      count != null ? el('span', { class: 'cal-sec__n', text: String(count) }) : null
    ]);
  }

  function whenTag(it) {
    if (it.type === 'nodate') return el('span', { class: 'tag tag--warn', text: it.reason === 'noplan' ? 'Sin plan de acción' : 'Sin fecha límite' });
    return el('span', { class: 'tag' + (KIND[it.urgency] === 'navy' ? ' tag--navy' : ' tag--' + KIND[it.urgency]), text: CalData.when(it.daysUntil) });
  }

  function row(it, opts) {
    opts = opts || {};
    var kind = it.type === 'nodate' ? 'warn' : KIND[it.urgency];
    var sub;
    if (it.type === 'plan') sub = it.data.freqLabel + ' · ' + (it.data.lastDate ? 'última ' + shortDate(it.data.lastDate) : 'primera ronda');
    else if (it.devTitle) sub = 'Desviación: ' + it.devTitle;
    else sub = it.type === 'nodate' && it.reason === 'noplan' ? 'Desviación abierta' : '';

    var meta = [];
    if (it.severityId) meta.push(el('span', { class: 'tag', style: { background: UI.withAlpha(Store.catalogColor(it.severityId), .14), color: Store.catalogColor(it.severityId) }, text: Store.catalogName(it.severityId) }));
    if (!opts.hidePlant) meta.push(plantLabel(it.centerId));
    if (it.responsible) meta.push(el('span', { class: 'cal-plant', html: ico('user', 12) + '<span>' + esc(it.responsible) + '</span>' }));

    return el('button', { class: 'cal-row cal-row--' + (it.type === 'nodate' ? 'nodate' : it.urgency), type: 'button', onclick: function () { open(it); } }, [
      el('span', { class: 'cal-row__ico cal-row__ico--' + kind, html: ico(ICON[it.type], 18) }),
      el('span', { class: 'cal-row__main' }, [
        el('strong', { text: it.title }),
        sub ? el('span', { class: 'cal-row__sub', text: sub }) : null,
        el('span', { class: 'cal-row__when' }, [whenTag(it), it.date ? el('em', { text: shortDate(it.date) }) : null]),
        meta.filter(Boolean).length ? el('span', { class: 'cal-row__meta' }, meta.filter(Boolean)) : null
      ])
    ]);
  }

  function roundsPanel(ov, cur) {
    var box = el('section', { class: 'cal-panel' });
    box.appendChild(sideHead('clipboard', 'Próximas visitas', ov.rounds.length));
    CalData.groupByPlant(ov.rounds, cur).forEach(function (g) {
      var card = el('div', { class: 'cal-pcard' });
      card.style.setProperty('--plant', g.color);
      card.appendChild(el('div', { class: 'cal-pcard__head' }, [
        el('span', { class: 'cal-pcard__badge', text: g.code }),
        el('strong', { text: g.name }),
        el('span', { class: 'cal-pcard__n', text: g.items.length ? g.items.length + (g.items.length === 1 ? ' ronda' : ' rondas') : 'Sin rondas programadas' })
      ]));
      g.items.forEach(function (it) {
        card.appendChild(el('button', { class: 'cal-rrow', type: 'button', onclick: function () { open(it); } }, [
          el('span', { class: 'cal-rrow__main' }, [
            el('strong', { text: it.title }),
            el('span', { text: shortDate(it.date) + ' · ' + it.data.freqLabel + (it.data.lastDate ? '' : ' · primera ronda') })
          ]),
          whenTag(it)
        ]));
      });
      if (!g.items.length) card.appendChild(el('div', { class: 'cal-pcard__none', text: 'Se programan en Configuración de cuestionarios: periodicidad y plantas donde se repite.' }));
      box.appendChild(card);
    });
    return box;
  }

  function expiriesPanel(ov) {
    var box = el('section', { class: 'cal-panel' });
    var ex = ov.expiries;
    box.appendChild(sideHead('flag', 'Próximas caducidades', ex.length || null));
    box.appendChild(el('p', { class: 'cal-panel__hint', text: 'Fechas límite de las acciones que corrigen las desviaciones abiertas.' }));

    if (!ex.length && !ov.undated.length) {
      box.appendChild(el('div', { class: 'cal-allgood', html: ico('checkCircle', 22) + '<div><strong>Todo al día</strong><span>No hay desviaciones con plazos pendientes' + (plant() ? ' en ' + esc(Store.catalogName(plant())) : '') + '.</span></div>' }));
      return box;
    }
    (cal.allExpiries ? ex : ex.slice(0, EXPIRY_CAP)).forEach(function (it) { box.appendChild(row(it)); });
    if (ex.length > EXPIRY_CAP) {
      box.appendChild(el('button', {
        class: 'btn btn--ghost btn--sm', type: 'button', style: { alignSelf: 'flex-start' },
        text: cal.allExpiries ? 'Ver menos' : 'Ver las ' + (ex.length - EXPIRY_CAP) + ' restantes',
        onclick: function () { cal.allExpiries = !cal.allExpiries; render(); }
      }));
    }
    if (ov.undated.length) {
      box.appendChild(el('div', { class: 'cal-mini', text: 'Sin fecha límite · ' + ov.undated.length }));
      ov.undated.slice(0, 4).forEach(function (it) { box.appendChild(row(it)); });
      if (ov.undated.length > 4) {
        box.appendChild(el('button', { class: 'btn btn--ghost btn--sm', type: 'button', style: { alignSelf: 'flex-start' },
          text: 'Ver las ' + (ov.undated.length - 4) + ' restantes en Desviaciones', onclick: function () { App.go('desviaciones'); } }));
      }
    }
    return box;
  }

  /* ---------- Pantalla ---------- */

  function emptyState() {
    return el('div', { class: 'card' }, el('div', { class: 'card__body' },
      UI.empty('calendar', 'Todavía no hay nada que programar',
        'Activa la periodicidad de un cuestionario y elige en qué plantas debe repetirse desde Configuración de cuestionarios, y aquí verás sus próximas visitas junto con las caducidades del plan de acción.',
        el('button', {
          class: 'btn btn--primary', html: ico('sliders', 17) + '<span>Ir a Configuración de cuestionarios</span>',
          onclick: function () { App.go('configuracion'); }
        }))));
  }

  function render() {
    var view = UI.$('#view');
    view.className = 'view';
    UI.clear(view);

    App.setHeader('Calendario', 'Próximas visitas por planta y caducidades de las desviaciones, de un vistazo');

    var cur = plant();
    var all = CalData.overview('');
    if (!all.rounds.length && !all.expiries.length && !all.undated.length && !Store.all('visits').length) {
      view.appendChild(emptyState());
      return;
    }
    var ov = cur ? CalData.overview(cur) : all;

    var first = new Date(cal.year, cal.month, 1);
    var offset = (first.getDay() + 6) % 7;
    var days = new Date(cal.year, cal.month + 1, 0).getDate();
    var cells = Math.ceil((offset + days) / 7) * 7;
    var from = UI.fmtDateInput(new Date(cal.year, cal.month, 1 - offset));
    var to = UI.fmtDateInput(new Date(cal.year, cal.month, cells - offset));
    var items = CalData.entries(from, to, { plant: cur, types: cal.types });

    view.appendChild(plantBar(all));
    view.appendChild(el('div', { class: 'cal-layout' }, [
      el('div', { class: 'cal-main' }, [renderNav(), renderGrid(items), legend()]),
      el('aside', { class: 'cal-side' }, [glance(ov.counts), roundsPanel(ov, cur), expiriesPanel(ov)])
    ]));
  }

  /* ---------- Exposición ---------- */

  global.Calendar = { render: render };
})(window);
