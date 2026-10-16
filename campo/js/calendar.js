/* ==========================================================================
   Safety Rounds · Campo — Calendario
   Se ve de un vistazo, con la planta elegida como filtro:
     · «Próximas»: cifras (vencido / esta semana / más adelante), la próxima
       ronda de cada cuestionario agrupada por planta, y las próximas
       caducidades de las desviaciones (fechas límite del plan de acción)
     · «Mes»: cuadrícula con una marca por entrada (planta + tipo + urgencia)
   Los datos salen de CalData (js/calendar-data.js), los mismos que en Safety Desk.
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el, esc = UI.esc;
  var Views = global.Views = global.Views || {};

  var DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  var DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  var today = new Date();
  var st = {
    year: today.getFullYear(), month: today.getMonth(), selected: UI.fmtDateInput(today),
    mode: 'soon',                                         // 'soon' (próximas) | 'month'
    types: { plan: true, expiry: true, done: true },      // qué se pinta en la cuadrícula
    all: { expiries: false },                             // «Ver todas» de las caducidades
    open: {}                                              // tarjetas de planta desplegadas (por planta)
  };
  var EXPIRY_CAP = 5;

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dstr(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function shortDate(s) {
    var d = UI.toDate(s);
    return d ? DOW_LONG[d.getDay()].slice(0, 3) + ' ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] : '';
  }

  var KIND = { late: 'danger', soon: 'warn', later: 'navy', done: 'ok' };
  var ICON = { plan: 'clipboard', expiry: 'flag', done: 'checkCircle', nodate: 'alertCircle' };

  function plantDot(centerId) {
    return el('span', { class: 'f-plantdot', style: { background: CalData.plantColor(centerId) } });
  }

  function plantLabel(centerId) {
    if (!centerId) return null;
    return el('span', { class: 'f-plantlbl' }, [plantDot(centerId), el('span', { text: Store.catalogName(centerId) })]);
  }

  /* ---------- Apertura de una entrada ---------- */

  function open(it) {
    if (it.type === 'done') { Views.forms.openVisit(it.data.id); return; }
    if (it.type === 'expiry') { Views.actions.openDetail(it.id); return; }
    if (it.type === 'nodate') {
      if (it.id) Views.actions.openDetail(it.id); else Views.deviations.openDetail(it.devId);
      return;
    }

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
      title: u.formName, subtitle: 'Ronda prevista · ' + u.centerName, body: body,
      footer: [el('button', {
        class: 'btn btn--primary btn--block f-btn', html: ico('play', 18) + '<span>Iniciar esta visita</span>',
        onclick: function () { s.close(); Views.forms.startFor(u.formId, u.centerId); }
      })]
    });
  }

  /* ---------- Una fila (rondas, caducidades, hechas, sin fecha) ---------- */

  function whenTag(it) {
    if (it.type === 'done') return Campo.tag('Hecha', 'ok');
    if (it.type === 'nodate') return Campo.tag(it.reason === 'noplan' ? 'Sin plan de acción' : 'Sin fecha límite', 'warn');
    return Campo.tag(CalData.when(it.daysUntil), KIND[it.urgency]);
  }

  function itemRow(it, opts) {
    opts = opts || {};
    var kind = it.type === 'nodate' ? 'warn' : KIND[it.urgency];
    var sub, meta = [];

    if (it.type === 'expiry' || it.type === 'nodate') {
      sub = it.devTitle || (it.type === 'nodate' && it.reason === 'noplan' ? 'Desviación abierta' : '');
      if (it.type === 'expiry' && it.devTitle) sub = 'Desviación: ' + it.devTitle;
      if (it.type === 'nodate' && it.reason === 'nodate' && it.devTitle) sub = 'Desviación: ' + it.devTitle;
    } else if (it.type === 'plan') {
      sub = it.data.freqLabel + ' · ' + (it.data.lastDate ? 'última ' + shortDate(it.data.lastDate) : 'primera ronda');
    } else {
      sub = it.data.code || '';
    }
    if (it.severityId) meta.push(Campo.colorTag(it.severityId));
    if (!opts.hidePlant) meta.push(plantLabel(it.centerId));
    if (it.responsible) meta.push(el('span', { class: 'f-plantlbl', html: ico('user', 12) + '<span>' + esc(it.responsible) + '</span>' }));

    var node = el('button', {
      class: 'f-item f-item--tap f-ev f-ev--' + (it.type === 'nodate' ? 'nodate' : it.urgency),
      type: 'button', onclick: function () { open(it); }
    }, [
      el('div', { class: 'f-item__badge f-item__badge--' + kind, html: ico(ICON[it.type], 22) }),
      el('div', { class: 'f-item__main' }, [
        el('div', { class: 'f-item__title f-clamp-2', text: it.title }),
        sub ? el('div', { class: 'f-item__sub f-clamp-2', text: sub }) : null,
        el('div', { class: 'f-ev__when' }, [whenTag(it), it.date ? el('span', { class: 'f-ev__date', text: shortDate(it.date) }) : null]),
        meta.filter(Boolean).length ? el('div', { class: 'f-ev__meta' }, meta.filter(Boolean)) : null
      ])
    ]);
    return node;
  }

  /** Fila compacta de una ronda dentro de la tarjeta de su planta: el plazo va en color en la segunda línea. */
  function roundRow(it) {
    var u = it.data;
    return el('button', { class: 'f-rrow', type: 'button', onclick: function () { open(it); } }, [
      el('span', { class: 'f-rrow__ico f-item__badge--' + KIND[it.urgency], html: ico('clipboard', 18) }),
      el('span', { class: 'f-rrow__main' }, [
        el('strong', { class: 'f-clamp-2', text: it.title }),
        el('span', { class: 'f-rrow__sub' }, [
          el('em', { class: 'f-rrow__when f-rrow__when--' + it.urgency, text: CalData.when(it.daysUntil) }),
          el('span', { text: ' · ' + shortDate(it.date) + ' · ' + u.freqLabel + (u.lastDate ? '' : ' · primera ronda') })
        ])
      ])
    ]);
  }

  /* ---------- Filtro de planta ---------- */

  function plantBar(all) {
    var cur = Campo.plant() || '';
    var by = {}, total = { n: 0, late: 0 };
    all.rounds.concat(all.expiries).forEach(function (it) {
      if (it.urgency === 'later') return;
      var b = by[it.centerId] = by[it.centerId] || { n: 0, late: 0 };
      b.n++; total.n++;
      if (it.urgency === 'late') { b.late++; total.late++; }
    });

    function chip(id, label, color, count) {
      var b = count;
      return el('button', {
        class: 'f-chip f-pchip' + (cur === id ? ' is-on' : ''), type: 'button', 'aria-pressed': cur === id ? 'true' : 'false',
        onclick: function () { if (cur === id) return; Campo.setPlant(id); Shell.render(); }
      }, [
        color ? el('span', { class: 'f-chip__dot', style: { background: color } }) : el('span', { class: 'f-pchip__ico', html: ico('layers', 15) }),
        el('span', { text: label }),
        b && b.n ? el('span', { class: 'f-pchip__n' + (b.late ? ' is-late' : ''), text: String(b.n) }) : null
      ]);
    }

    var box = el('div', { class: 'f-chips f-plantbar', role: 'group', 'aria-label': 'Planta' });
    box.appendChild(chip('', 'Todas', '', total));
    CalData.centers().forEach(function (c) { box.appendChild(chip(c.id, c.name, CalData.plantColor(c.id), by[c.id])); });
    return box;
  }

  /* ======================================================================
     Pestaña «Próximas»
     ====================================================================== */

  function glance(counts) {
    function tile(kind, icon, value, label) {
      return el('div', { class: 'f-glance__tile f-glance__tile--' + kind }, [
        el('span', { class: 'f-glance__ico', html: ico(icon, 18) }),
        el('strong', { text: String(value) }),
        el('span', { class: 'f-glance__lbl', text: label })
      ]);
    }
    var lateKind = counts.late ? 'late' : 'ok';
    return el('div', { class: 'f-glance' }, [
      tile(lateKind, counts.late ? 'alert' : 'checkCircle', counts.late, counts.late === 1 ? 'Vencida' : 'Vencidas'),
      tile('soon', 'clock', counts.soon, 'Esta semana'),
      tile('later', 'calendar', counts.later, 'Más adelante')
    ]);
  }

  function sectionHead(icon, title, count, sub) {
    return el('div', { class: 'f-sec' }, [
      el('span', { class: 'f-sec__ico', html: ico(icon, 18) }),
      el('div', { class: 'f-sec__txt' }, [
        el('h2', { class: 'f-sec__title', text: title }),
        sub ? el('span', { class: 'f-sec__sub', text: sub }) : null
      ]),
      count != null ? el('span', { class: 'f-sec__count', text: String(count) }) : null
    ]);
  }

  function roundsBlock(ov, cur) {
    var box = el('section', { class: 'f-block' });
    var groups = CalData.groupByPlant(ov.rounds, cur);
    var n = ov.rounds.length;
    box.appendChild(sectionHead('clipboard', 'Próximas visitas', n, n ? 'Lo siguiente que toca en cada planta' : ''));

    if (!groups.length) {
      box.appendChild(Campo.empty('building', 'Sin plantas', 'Todavía no hay plantas o centros de trabajo configurados.'));
      return box;
    }
    groups.forEach(function (g) {
      var first = g.items[0], n = g.items.length;
      var open = !!cur || !!st.open[g.centerId];            // con una planta elegida, se ve desplegada
      var card = el('div', { class: 'f-pcard' + (open ? ' is-open' : '') });
      card.style.setProperty('--plant', g.color);

      var sub = !n ? el('span', { text: 'Sin rondas programadas · se activan en Safety Desk' })
        : cur ? el('span', { text: n + (n === 1 ? ' ronda programada' : ' rondas programadas') })
        : el('span', { class: 'f-pcard__sub' }, [
          el('b', { text: n + (n === 1 ? ' ronda' : ' rondas') }), el('i', { text: ' · ' }), el('span', { text: first.title })
        ]);
      var headKids = [
        el('span', { class: 'f-pcard__badge', text: g.code }),
        el('div', { class: 'f-pcard__name' }, [el('strong', { text: g.name }), sub]),
        first ? Campo.tag(CalData.when(first.daysUntil), KIND[first.urgency]) : null,
        n && !cur ? el('span', { class: 'f-pcard__chev', html: ico('chevronDown', 18) }) : null
      ];

      if (!n || cur) {
        card.appendChild(el('div', { class: 'f-pcard__head' }, headKids));
      } else {
        var head = el('button', { class: 'f-pcard__head', type: 'button', 'aria-expanded': open ? 'true' : 'false' }, headKids);
        head.addEventListener('click', function () {
          var now = !card.classList.contains('is-open');
          card.classList.toggle('is-open', now);
          head.setAttribute('aria-expanded', now ? 'true' : 'false');
          st.open[g.centerId] = now;
        });
        card.appendChild(head);
      }
      if (n) {
        var list = el('div', { class: 'f-pcard__list' });
        g.items.forEach(function (it) { list.appendChild(roundRow(it)); });
        card.appendChild(list);
      }
      box.appendChild(card);
    });
    return box;
  }

  function expiriesBlock(ov) {
    var box = el('section', { class: 'f-block' });
    var ex = ov.expiries;
    box.appendChild(sectionHead('flag', 'Próximas caducidades', ex.length || null, 'Fechas límite de las desviaciones abiertas'));

    if (!ex.length && !ov.undated.length) {
      box.appendChild(el('div', { class: 'f-allgood' }, [
        el('span', { html: ico('checkCircle', 26) }),
        el('div', {}, [el('strong', { text: 'Todo al día' }), el('span', { text: 'No hay desviaciones con plazos pendientes' + (Campo.plant() ? ' en ' + Campo.plantName() : '') + '.' })])
      ]));
      return box;
    }

    var list = el('div', { class: 'f-list' });
    var shown = st.all.expiries ? ex : ex.slice(0, EXPIRY_CAP);
    shown.forEach(function (it) { list.appendChild(itemRow(it)); });
    if (ex.length > EXPIRY_CAP) {
      list.appendChild(el('button', {
        class: 'btn btn--ghost btn--block f-btn-sm f-more', type: 'button',
        text: st.all.expiries ? 'Ver menos' : 'Ver las ' + (ex.length - EXPIRY_CAP) + ' restantes',
        onclick: function () { st.all.expiries = !st.all.expiries; Shell.render(); }
      }));
    }
    if (ex.length) box.appendChild(list);

    if (ov.undated.length) {
      box.appendChild(el('h3', { class: 'f-sec__mini', text: 'Sin fecha límite · ' + ov.undated.length }));
      var nd = el('div', { class: 'f-list' });
      ov.undated.slice(0, 4).forEach(function (it) { nd.appendChild(itemRow(it)); });
      if (ov.undated.length > 4) {
        nd.appendChild(el('button', { class: 'f-link', type: 'button', text: 'Ver las ' + (ov.undated.length - 4) + ' restantes en Desviaciones',
          onclick: function () { Shell.go('deviations'); } }));
      }
      box.appendChild(nd);
    }
    return box;
  }

  function soonView(view, ov, cur) {
    view.appendChild(glance(ov.counts));
    view.appendChild(el('div', { class: 'f-cols' }, [roundsBlock(ov, cur), expiriesBlock(ov)]));
  }

  /* ======================================================================
     Pestaña «Mes»
     ====================================================================== */

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
        el('strong', { text: cap(MONTHS_LONG[st.month]) }),
        el('span', { text: String(st.year) })
      ]),
      el('button', { class: 'f-iconbtn f-iconbtn--dark', 'aria-label': 'Mes siguiente', html: ico('chevronRight', 22), onclick: function () { shiftMonth(1); } }),
      el('button', { class: 'btn btn--ghost btn--sm f-btn-sm', type: 'button', text: 'Hoy', onclick: goToday })
    ]);
  }

  var MARK_WORD = { plan: 'Ronda', expiry: 'Vence', done: 'Hecha' };

  function mark(it, codes, single) {
    var label = single ? MARK_WORD[it.type] : (codes[it.centerId] || '—');
    return el('span', {
      class: 'f-cmark f-cmark--' + it.type + ' f-cmark--' + it.urgency,
      html: ico(ICON[it.type], 10) + '<span>' + esc(label) + '</span>'
    });
  }

  function grid(items) {
    var byDate = {};
    items.forEach(function (it) { (byDate[it.date] = byDate[it.date] || []).push(it); });
    var codes = CalData.plantCodes();
    var single = !!Campo.plant();

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
      var MAXM = 2;

      var cell = el('button', {
        class: 'f-cal__day' + (inMonth ? '' : ' is-out') + (ds === todayStr ? ' is-today' : '') + (ds === st.selected ? ' is-selected' : ''),
        type: 'button', 'data-date': ds,
        'aria-label': cd.getDate() + ' de ' + MONTHS_LONG[cd.getMonth()] + (dayItems.length ? ', ' + dayItems.length + (dayItems.length === 1 ? ' entrada' : ' entradas') : ''),
        onclick: (function (dateStr, d) {
          return function () {
            st.selected = dateStr;
            if (d.getMonth() !== st.month) { st.year = d.getFullYear(); st.month = d.getMonth(); }
            Shell.render();
          };
        })(ds, cd)
      }, [
        el('span', { class: 'f-cal__num', text: String(cd.getDate()) }),
        el('span', { class: 'f-cal__marks' }, dayItems.slice(0, MAXM).map(function (it) { return mark(it, codes, single); })
          .concat(dayItems.length > MAXM ? [el('span', { class: 'f-cal__more', text: '+' + (dayItems.length - MAXM) })] : []))
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

  /** Leyenda que también filtra: tocar un tipo lo oculta o lo muestra en la cuadrícula. */
  function legend() {
    function toggle(type, label, sample) {
      var on = st.types[type];
      return el('button', {
        class: 'f-legend__btn' + (on ? ' is-on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false',
        onclick: function () { st.types[type] = !st.types[type]; Shell.render(); }
      }, [sample, el('span', { text: label })]);
    }
    function sample(type, urgency) {
      return el('span', { class: 'f-cmark f-cmark--' + type + ' f-cmark--' + urgency, html: ico(ICON[type], 10) });
    }
    return el('div', { class: 'f-legend f-legend--tg' }, [
      toggle('plan', 'Rondas', sample('plan', 'soon')),
      toggle('expiry', 'Caducidades', sample('expiry', 'late')),
      toggle('done', 'Hechas', sample('done', 'done'))
    ]);
  }

  function colorKey() {
    function k(c, t) { return el('span', { class: 'f-legend__item' }, [el('span', { class: 'f-cal__dot', style: { background: c } }), el('span', { text: t })]); }
    return el('div', { class: 'f-legend' }, [k('var(--coral)', 'Vencido'), k('#C77A10', 'Esta semana'), k('var(--navy-soft)', 'Más adelante')]);
  }

  function monthView(view, cur) {
    var first = new Date(st.year, st.month, 1);
    var offset = (first.getDay() + 6) % 7;
    var days = new Date(st.year, st.month + 1, 0).getDate();
    var cells = Math.ceil((offset + days) / 7) * 7;
    var from = UI.fmtDateInput(new Date(st.year, st.month, 1 - offset));
    var to = UI.fmtDateInput(new Date(st.year, st.month, cells - offset));

    var items = CalData.entries(from, to, { plant: cur, types: st.types });

    var left = el('div', { class: 'f-cal-wrap' }, [header(), grid(items), legend(), colorKey()]);
    var right = el('div', { class: 'f-cal-day' });

    var d = UI.toDate(st.selected);
    var dayItems = items.filter(function (it) { return it.date === st.selected; });
    right.appendChild(el('h2', { class: 'f-section__title', text: cap(DOW_LONG[d.getDay()]) + ', ' + d.getDate() + ' de ' + MONTHS_LONG[d.getMonth()] }));
    if (dayItems.length) {
      var list = el('div', { class: 'f-list', style: { marginTop: '10px' } });
      dayItems.forEach(function (it) { list.appendChild(itemRow(it, { hidePlant: !!cur })); });
      right.appendChild(list);
    } else {
      right.appendChild(el('div', { class: 'f-note', style: { marginTop: '10px' } }, [
        el('span', { html: ico('calendar', 20) }),
        el('span', { text: 'Nada previsto este día' + (cur ? ' en ' + Campo.plantName() : '') + '.' })
      ]));
      // Un día vacío no deja la pantalla muda: se enseña lo siguiente que hay
      var upto = UI.fmtDateInput(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 60));
      var next = CalData.entries(st.selected, upto, { plant: cur, types: { plan: true, expiry: true, done: false } })
        .filter(function (it) { return it.date > st.selected; }).slice(0, 4);
      if (next.length) {
        right.appendChild(el('h3', { class: 'f-sec__mini', text: 'Lo siguiente' }));
        var nl = el('div', { class: 'f-list' });
        next.forEach(function (it) { nl.appendChild(itemRow(it, { hidePlant: !!cur })); });
        right.appendChild(nl);
      }
    }

    view.appendChild(el('div', { class: 'f-split' }, [left, right]));
  }

  /* ======================================================================
     Pantalla
     ====================================================================== */

  function render() {
    var view = UI.$('#view');
    var cur = Campo.plant() || '';
    var all = CalData.overview('');
    var ov = cur ? CalData.overview(cur) : all;

    view.appendChild(el('div', { class: 'f-toolbar' }, [
      el('h1', { class: 'f-title', text: 'Calendario' }),
      Campo.segmented([{ value: 'soon', label: 'Próximas' }, { value: 'month', label: 'Mes' }], st.mode,
        function (v) { st.mode = v; Shell.render(); })
    ]));
    view.appendChild(plantBar(all));
    if (st.mode === 'month') monthView(view, cur); else soonView(view, ov, cur);
  }

  Views.calendar = { render: render };
})(window);
