/* ==========================================================================
   Safety Rounds — Dashboard de control
   KPIs, evolución temporal, desglose por cuestionario y control de acciones.
   Gráficos SVG propios: sin librerías externas, funciona sin conexión.
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el, esc = UI.esc;

  var filters = {
    from: '', to: '', formId: '', centerId: '', areaId: '', severityId: '', categoryId: '', period: '6m'
  };

  // Filtros por tipologías personalizadas marcadas como dimensión de análisis:
  // { listId: itemId }
  var dimFilters = {};

  /** Listas marcadas para análisis que no son ya un filtro fijo del panel. */
  function extraDimensions() {
    return Store.lists().filter(function (l) {
      return l.analysable && !l.system;
    });
  }

  function activeDims() {
    return Object.keys(dimFilters).filter(function (k) { return dimFilters[k]; });
  }

  function matchesDims(rec) {
    var keys = activeDims();
    if (!keys.length) return true;
    var dims = rec.dimensions || {};
    return keys.every(function (listId) {
      return (dims[listId] || []).indexOf(dimFilters[listId]) !== -1;
    });
  }

  /* ======================================================================
     Selección de datos
     ====================================================================== */

  function applyPeriod() {
    if (filters.period === 'custom') return;
    var now = new Date();
    var from = new Date();
    if (filters.period === '1m') from.setMonth(now.getMonth() - 1);
    else if (filters.period === '3m') from.setMonth(now.getMonth() - 3);
    else if (filters.period === '6m') from.setMonth(now.getMonth() - 6);
    else if (filters.period === '12m') from.setFullYear(now.getFullYear() - 1);
    else if (filters.period === 'all') { filters.from = ''; filters.to = ''; return; }
    filters.from = UI.fmtDateInput(from);
    filters.to = UI.fmtDateInput(now);
  }

  function inRange(dateStr) {
    if (!dateStr) return false;
    if (filters.from && dateStr < filters.from) return false;
    if (filters.to && dateStr > filters.to) return false;
    return true;
  }

  function selectedVisits() {
    return Store.all('visits').filter(function (v) {
      if (v.status !== 'completed') return false;
      if (!inRange(v.date)) return false;
      if (filters.formId && v.formId !== filters.formId) return false;
      if (filters.centerId && v.centerId !== filters.centerId) return false;
      if (filters.areaId && v.areaId !== filters.areaId) return false;
      if (!matchesDims(v)) return false;
      return true;
    });
  }

  function selectedDeviations(visits) {
    var ids = {};
    visits.forEach(function (v) { ids[v.id] = true; });
    return Store.all('deviations').filter(function (d) {
      if (!ids[d.visitId]) return false;
      if (filters.severityId && d.severityId !== filters.severityId) return false;
      if (filters.categoryId && d.categoryId !== filters.categoryId) return false;
      return true;
    });
  }

  /* ======================================================================
     Render
     ====================================================================== */

  function render() {
    applyPeriod();
    var view = UI.$('#view');
    view.className = 'view';
    UI.clear(view);

    var visits = selectedVisits();
    var devs = selectedDeviations(visits);
    var totalVisits = Store.all('visits').filter(function (v) { return v.status === 'completed'; }).length;

    App.setHeader('Dashboard de control', 'Visión conjunta e individualizada de las inspecciones', [
      el('button', {
        class: 'btn btn--ghost btn--sm', html: ico('filePdf', 16) + '<span>Descargar PDF</span>',
        onclick: function () { exportDashboardPDF(visits, devs); }
      }),
      el('button', {
        class: 'btn btn--ghost btn--sm', html: ico('table', 16) + '<span>Exportar</span>',
        onclick: function () { exportMenu(visits, devs); }
      })
    ]);

    if (!totalVisits) {
      view.appendChild(el('div', { class: 'card' }, el('div', { class: 'card__body' },
        UI.empty('barChart', 'Todavía no hay datos que analizar',
          'El dashboard se construye a partir de las visitas finalizadas. Crea un cuestionario y realiza tu primera inspección para empezar a ver indicadores.',
          el('div', { style: { display: 'flex', gap: '9px', justifyContent: 'center', flexWrap: 'wrap' } }, [
            el('button', {
              class: 'btn btn--primary', html: ico('plus', 17) + '<span>Crear cuestionario</span>',
              onclick: function () { App.go('configuracion'); setTimeout(function () { Builder.open(null); }, 30); }
            }),
            el('button', {
              class: 'btn btn--ghost', html: ico('play', 17) + '<span>Realizar visita</span>',
              onclick: function () { App.go('cuestionarios'); }
            })
          ])))));
      return;
    }

    view.appendChild(renderFilters());
    view.appendChild(renderKPIs(visits, devs));

    var grid1 = el('div', { class: 'dash-grid' });
    grid1.appendChild(cardEvolution(visits, devs));
    grid1.appendChild(cardCompliance(visits));
    view.appendChild(grid1);

    var grid2 = el('div', { class: 'dash-grid' });
    grid2.appendChild(cardByForm(visits, devs));
    grid2.appendChild(cardActions());
    view.appendChild(grid2);

    var grid3 = el('div', { class: 'dash-grid' });
    grid3.appendChild(cardTopQuestions(devs));
    grid3.appendChild(cardBreakdown(devs));
    view.appendChild(grid3);
  }

  /* ---------- Filtros ---------- */

  function renderFilters() {
    var box = el('div', { class: 'filters' });

    var periodSel = UI.selectFrom([
      { value: '1m', label: 'Último mes' },
      { value: '3m', label: 'Últimos 3 meses' },
      { value: '6m', label: 'Últimos 6 meses' },
      { value: '12m', label: 'Último año' },
      { value: 'all', label: 'Todo el histórico' },
      { value: 'custom', label: 'Rango personalizado' }
    ], filters.period, { class: 'select select--sm' });
    periodSel.addEventListener('change', function () { filters.period = periodSel.value; render(); });
    box.appendChild(UI.field('Periodo', periodSel));

    if (filters.period === 'custom') {
      var f1 = el('input', { class: 'input input--sm', type: 'date', value: filters.from });
      f1.addEventListener('change', function () { filters.from = f1.value; render(); });
      box.appendChild(UI.field('Desde', f1));
      var f2 = el('input', { class: 'input input--sm', type: 'date', value: filters.to });
      f2.addEventListener('change', function () { filters.to = f2.value; render(); });
      box.appendChild(UI.field('Hasta', f2));
    }

    box.appendChild(UI.field('Cuestionario', filterSelect('formId',
      Store.all('forms').map(function (f) { return { value: f.id, label: f.name }; }), 'Todos')));

    box.appendChild(UI.field('Centro', filterSelect('centerId',
      Store.catalog('center').map(function (c) { return { value: c.id, label: c.name }; }), 'Todos')));

    // El área se encadena al centro: con un centro elegido, ofrecer las áreas
    // de los demás solo produce filtros que no devuelven nada.
    var areaList = Store.listBySystem('area');
    var areaItems = areaList
      ? (filters.centerId ? Store.listItems(areaList.id, filters.centerId) : Store.listItems(areaList.id))
      : [];
    box.appendChild(UI.field(
      'Área',
      filterSelect('areaId', areaItems.map(function (c) { return { value: c.id, label: c.name }; }), 'Todas'),
      filters.centerId && !areaItems.length ? 'Este centro no tiene áreas registradas.' : null
    ));

    box.appendChild(UI.field('Gravedad', filterSelect('severityId',
      Store.catalog('severity').map(function (c) { return { value: c.id, label: c.name }; }), 'Todas')));

    box.appendChild(UI.field('Categoría', filterSelect('categoryId',
      Store.catalog('category').map(function (c) { return { value: c.id, label: c.name }; }), 'Todas')));

    // Tipologías propias marcadas como dimensión de análisis, encadenadas a su
    // madre igual que el área lo está al centro
    extraDimensions().forEach(function (l) {
      var parent = Store.parentListOf(l.id);
      var parentPick = parent
        ? (parent.system === 'center' ? filters.centerId : dimFilters[parent.id])
        : null;

      var items = parent && parentPick
        ? Store.listItems(l.id, parentPick)
        : Store.listItems(l.id);
      if (!items.length && !parentPick) return;

      if (dimFilters[l.id] && !items.some(function (c) { return c.id === dimFilters[l.id]; })) {
        dimFilters[l.id] = '';
      }

      var sel = UI.selectFrom(
        [{ value: '', label: 'Todos' }].concat(items.map(function (c) { return { value: c.id, label: c.name }; })),
        dimFilters[l.id] || '', { class: 'select select--sm' });
      sel.addEventListener('change', function () { dimFilters[l.id] = sel.value; render(); });
      box.appendChild(UI.field(l.name, sel));
    });

    var active = ['formId', 'centerId', 'areaId', 'severityId', 'categoryId'].some(function (k) { return filters[k]; })
      || activeDims().length;
    if (active || filters.period !== '6m') {
      box.appendChild(el('div', { class: 'filters__end' }, el('button', {
        class: 'btn btn--quiet btn--sm', html: ico('refresh', 15) + '<span>Limpiar</span>',
        onclick: function () {
          filters = { from: '', to: '', formId: '', centerId: '', areaId: '', severityId: '', categoryId: '', period: '6m' };
          dimFilters = {};
          render();
        }
      })));
    }

    return box;
  }

  function filterSelect(key, options, allLabel) {
    // Si el valor guardado ya no está entre las opciones (porque ha cambiado
    // el filtro del que depende), se descarta en lugar de dejar una selección
    // invisible que vacía el panel sin explicación.
    var valid = options.some(function (o) { return o.value === filters[key]; });
    if (filters[key] && !valid) filters[key] = '';

    var s = UI.selectFrom([{ value: '', label: allLabel }].concat(options), filters[key], { class: 'select select--sm' });
    s.addEventListener('change', function () { filters[key] = s.value; render(); });
    return s;
  }

  /* ---------- KPIs ---------- */

  function renderKPIs(visits, devs) {
    var openDevs = devs.filter(function (d) { return d.status !== 'closed'; }).length;
    var totals = visits.reduce(function (acc, v) {
      var s = v.score || {};
      acc.ok += s.ok || 0;
      acc.ko += s.ko || 0;
      return acc;
    }, { ok: 0, ko: 0 });
    var pct = (totals.ok + totals.ko) ? Math.round(totals.ok / (totals.ok + totals.ko) * 100) : 0;

    var overdue = openActions().filter(isOverdue).length;

    var box = el('div', { class: 'kpis' });
    box.appendChild(kpi('Visitas realizadas', UI.num(visits.length), 'clipboardList', null,
      trendText(visits), 'navy'));
    box.appendChild(kpi('Desviaciones detectadas', UI.num(devs.length), 'alert',
      devs.length && visits.length ? UI.dec(devs.length / visits.length, 1) + ' de media por visita' : 'Ninguna en el periodo', null, 'coral'));
    box.appendChild(kpi('Desviaciones abiertas', UI.num(openDevs), 'inbox',
      openDevs ? 'Pendientes de cierre' : 'Todo cerrado', null, openDevs ? 'warn' : 'ok'));
    box.appendChild(kpi('Conformidad media', UI.pct(pct), 'target',
      totals.ok + totals.ko ? UI.num(totals.ok) + ' de ' + UI.num(totals.ok + totals.ko) + ' puntos conformes' : 'Sin puntos evaluados',
      null, pct >= 90 ? 'ok' : pct >= 70 ? 'warn' : 'coral'));
    if (overdue) {
      box.appendChild(kpi('Acciones vencidas', UI.num(overdue), 'clock', 'Han superado la fecha límite', null, 'coral'));
    }
    return box;
  }

  function kpi(label, value, icon, foot, footNode, kind) {
    return el('div', { class: 'kpi kpi--' + (kind || 'navy') }, [
      el('div', { class: 'kpi__label' }, [el('span', { html: ico(icon, 14) }), el('span', { text: label })]),
      el('div', { class: 'kpi__value', text: String(value) }),
      footNode || (foot ? el('div', { class: 'kpi__foot', text: foot }) : null)
    ]);
  }

  function trendText(visits) {
    if (!visits.length) return 'Sin visitas en el periodo';
    var byMonth = {};
    visits.forEach(function (v) {
      var k = UI.monthKey(v.date);
      byMonth[k] = (byMonth[k] || 0) + 1;
    });
    var keys = Object.keys(byMonth).sort();
    if (keys.length < 2) return keys.length ? 'Todas en ' + UI.monthLabelLong(keys[0]) : '';
    var last = byMonth[keys[keys.length - 1]], prev = byMonth[keys[keys.length - 2]];
    var diff = last - prev;
    return diff === 0 ? 'Mismo ritmo que el mes anterior'
      : (diff > 0 ? '+' : '') + diff + ' respecto al mes anterior';
  }

  /* ---------- Evolución mensual ---------- */

  function cardEvolution(visits, devs) {
    var card = wrapCard('Evolución mensual', 'Visitas realizadas y desviaciones detectadas', 'trendUp');
    var body = el('div', { class: 'card__body' });

    var months = monthRange(visits, devs);
    if (months.length < 1) {
      body.appendChild(el('div', { class: 'hint', style: { textAlign: 'center', padding: '30px 0' }, text: 'Sin datos en el periodo seleccionado.' }));
      card.appendChild(body);
      return card;
    }

    var vCounts = months.map(function (m) {
      return visits.filter(function (v) { return UI.monthKey(v.date) === m; }).length;
    });
    var dCounts = months.map(function (m) {
      return devs.filter(function (d) { return UI.monthKey(d.date) === m; }).length;
    });

    body.appendChild(lineChart(months.map(UI.monthLabel), [
      { name: 'Visitas', values: vCounts, color: '#4356AE' },
      { name: 'Desviaciones', values: dCounts, color: '#F16B6B' }
    ]));

    card.appendChild(body);
    return card;
  }

  function monthRange(visits, devs) {
    var set = {};
    visits.forEach(function (v) { if (v.date) set[UI.monthKey(v.date)] = true; });
    devs.forEach(function (d) { if (d.date) set[UI.monthKey(d.date)] = true; });
    var keys = Object.keys(set).filter(Boolean).sort();
    if (!keys.length) return [];
    // Rellena los meses intermedios sin actividad para que la línea no mienta
    var out = [], cur = keys[0], end = keys[keys.length - 1], guard = 0;
    while (cur <= end && guard++ < 60) {
      out.push(cur);
      var p = cur.split('-');
      var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10), 1);
      cur = d.getFullYear() + '-' + UI.pad(d.getMonth() + 1);
    }
    return out.slice(-14);
  }

  function lineChart(labels, series) {
    var W = 640, H = 220, pad = { t: 14, r: 14, b: 30, l: 34 };
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    var max = Math.max(1, series.reduce(function (m, s) {
      return Math.max(m, Math.max.apply(null, s.values.concat([0])));
    }, 0));
    max = niceMax(max);

    var n = labels.length;
    function x(i) { return pad.l + (n === 1 ? iw / 2 : i * iw / (n - 1)); }
    function yv(v) { return pad.t + ih - (v / max) * ih; }

    var parts = [];

    // Rejilla horizontal
    for (var g = 0; g <= 4; g++) {
      var gy = pad.t + ih - (g / 4) * ih;
      parts.push('<line x1="' + pad.l + '" y1="' + gy + '" x2="' + (W - pad.r) + '" y2="' + gy +
        '" stroke="#EDEFF6" stroke-width="1"/>');
      parts.push('<text x="' + (pad.l - 7) + '" y="' + (gy + 3.5) + '" text-anchor="end" font-size="10" fill="#7A83A3">' +
        Math.round(max * g / 4) + '</text>');
    }

    // Etiquetas del eje X (se aligeran si hay muchos meses)
    var step = n > 8 ? Math.ceil(n / 7) : 1;
    labels.forEach(function (l, i) {
      if (i % step !== 0 && i !== n - 1) return;
      parts.push('<text x="' + x(i) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="10" fill="#7A83A3">' + esc(l) + '</text>');
    });

    series.forEach(function (s, si) {
      var pts = s.values.map(function (v, i) { return x(i) + ',' + yv(v); });
      if (n > 1) {
        parts.push('<polygon points="' + pad.l + ',' + (pad.t + ih) + ' ' + pts.join(' ') + ' ' + (W - pad.r) + ',' + (pad.t + ih) +
          '" fill="' + s.color + '" opacity="' + (si === 0 ? '.1' : '.08') + '"/>');
        parts.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + s.color +
          '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>');
      }
      s.values.forEach(function (v, i) {
        parts.push('<circle cx="' + x(i) + '" cy="' + yv(v) + '" r="3.6" fill="#fff" stroke="' + s.color + '" stroke-width="2.2"><title>' +
          esc(labels[i]) + ' · ' + esc(s.name) + ': ' + v + '</title></circle>');
      });
    });

    var svg = el('div', {
      class: 'chart',
      html: '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;overflow:visible" role="img" ' +
        'aria-label="Evolución mensual">' + parts.join('') + '</svg>'
    });

    var legend = el('div', { class: 'chart-legend' });
    series.forEach(function (s) {
      var total = s.values.reduce(function (a, b) { return a + b; }, 0);
      legend.appendChild(el('div', { class: 'chart-legend__item' }, [
        el('span', { class: 'chart-legend__dot', style: { background: s.color } }),
        el('span', { text: s.name + ' (' + UI.num(total) + ')' })
      ]));
    });

    return el('div', {}, [svg, legend]);
  }

  function niceMax(v) {
    if (v <= 5) return 5;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil(v / (mag / 2)) * (mag / 2);
  }

  /* ---------- Conformidad global ---------- */

  function cardCompliance(visits) {
    var card = wrapCard('Nivel de conformidad', 'Puntos de inspección evaluados', 'target');
    var body = el('div', { class: 'card__body' });

    var t = visits.reduce(function (acc, v) {
      var s = v.score || {};
      acc.ok += s.ok || 0; acc.ko += s.ko || 0; acc.na += s.na || 0;
      return acc;
    }, { ok: 0, ko: 0, na: 0 });
    var base = t.ok + t.ko;
    var pct = base ? Math.round(t.ok / base * 100) : 0;

    if (!base && !t.na) {
      body.appendChild(el('div', { class: 'hint', style: { textAlign: 'center', padding: '30px 0' }, text: 'Los cuestionarios del periodo no incluyen puntos de inspección.' }));
      card.appendChild(body);
      return card;
    }

    var wrap = el('div', { class: 'ring-wrap' });
    wrap.appendChild(ring(pct, t));
    var legend = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '11px', minWidth: '150px' } });
    [
      ['Conformes', t.ok, '#178A6B'],
      ['Desviaciones', t.ko, '#F16B6B'],
      ['No aplica', t.na, '#C4C9DE']
    ].forEach(function (r) {
      legend.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', gap: '9px' } }, [
        el('span', { style: { width: '10px', height: '10px', borderRadius: '3px', background: r[2], flex: 'none' } }),
        el('span', { style: { fontSize: '13.5px', color: 'var(--ink-2)', flex: '1' }, text: r[0] }),
        el('strong', { style: { fontSize: '14px' }, text: String(r[1]) })
      ]));
    });
    wrap.appendChild(legend);
    body.appendChild(wrap);
    card.appendChild(body);
    return card;
  }

  function ring(pct, t) {
    var r = 62, c = 2 * Math.PI * r;
    var base = t.ok + t.ko + t.na || 1;
    var segs = [
      { v: t.ok, color: '#178A6B' },
      { v: t.ko, color: '#F16B6B' },
      { v: t.na, color: '#C4C9DE' }
    ];
    var offset = 0;
    var circles = segs.filter(function (s) { return s.v > 0; }).map(function (s) {
      var len = s.v / base * c;
      var dash = '<circle cx="79" cy="79" r="' + r + '" fill="none" stroke="' + s.color +
        '" stroke-width="15" stroke-linecap="butt" stroke-dasharray="' + len + ' ' + (c - len) +
        '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 79 79)"/>';
      offset += len;
      return dash;
    }).join('');

    var color = pct >= 90 ? 'var(--ok)' : pct >= 70 ? 'var(--warn)' : 'var(--coral-dark)';
    return el('div', { class: 'ring' }, [
      el('div', {
        html: '<svg viewBox="0 0 158 158" width="158" height="158">' +
          '<circle cx="79" cy="79" r="' + r + '" fill="none" stroke="#F3F4F8" stroke-width="15"/>' + circles + '</svg>'
      }),
      el('div', { class: 'ring__center' }, [
        el('div', { class: 'ring__value', style: { color: color }, text: UI.pct(pct) }),
        el('div', { class: 'ring__label', text: 'conforme' })
      ])
    ]);
  }

  /* ---------- Desglose por cuestionario ---------- */

  function cardByForm(visits, devs) {
    var card = wrapCard('Desglose por cuestionario', 'Dónde se concentran las desviaciones', 'clipboardList');
    var body = el('div', { class: 'card__body' });

    var map = {};
    visits.forEach(function (v) {
      var k = v.formId || 'sin';
      map[k] = map[k] || { name: v.formName || 'Sin nombre', visits: 0, devs: 0, ok: 0, ko: 0 };
      map[k].visits++;
      map[k].ok += (v.score || {}).ok || 0;
      map[k].ko += (v.score || {}).ko || 0;
    });
    devs.forEach(function (d) {
      var k = d.formId || 'sin';
      if (map[k]) map[k].devs++;
    });

    var rows = Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.devs - a.devs || b.visits - a.visits; });

    if (!rows.length) {
      body.appendChild(el('div', { class: 'hint', style: { textAlign: 'center', padding: '26px 0' }, text: 'Sin visitas en el periodo.' }));
      card.appendChild(body);
      return card;
    }

    var maxDev = Math.max.apply(null, rows.map(function (r) { return r.devs; }).concat([1]));
    var list = el('div', { class: 'bar-list' });
    rows.slice(0, 8).forEach(function (r) {
      var base = r.ok + r.ko;
      var pct = base ? Math.round(r.ok / base * 100) : null;
      list.appendChild(el('div', { class: 'bar-item' }, [
        el('div', { class: 'bar-item__top' }, [
          el('span', { class: 'bar-item__name', text: r.name }),
          el('span', {
            class: 'bar-item__val',
            text: UI.num(r.devs) + ' ' + UI.plural(r.devs, 'desv.', 'desv.') + ' · ' + UI.num(r.visits) + ' ' + UI.plural(r.visits, 'visita') +
              (pct !== null ? ' · ' + UI.pct(pct) : '')
          })
        ]),
        el('div', { class: 'bar-item__track' },
          el('div', {
            class: 'bar-item__fill',
            style: {
              width: (r.devs / maxDev * 100) + '%',
              background: r.devs ? 'linear-gradient(90deg,#F16B6B,#E05C5C)' : '#DDE1EF',
              minWidth: r.devs ? '4px' : '0'
            }
          }))
      ]));
    });

    body.appendChild(list);
    card.appendChild(body);
    return card;
  }

  /* ---------- Preguntas que más fallan ---------- */

  function cardTopQuestions(devs) {
    var card = wrapCard('Puntos que más fallan', 'Preguntas con más desviaciones registradas', 'alert');
    var body = el('div', { class: 'card__body' });

    var map = {};
    devs.forEach(function (d) {
      var k = d.formId + '::' + d.question;
      map[k] = map[k] || { question: d.question, form: d.formName, n: 0 };
      map[k].n++;
    });
    var rows = Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 7);

    if (!rows.length) {
      body.appendChild(el('div', { class: 'hint', style: { textAlign: 'center', padding: '26px 0' }, text: 'Ninguna desviación registrada en el periodo. Buena señal.' }));
      card.appendChild(body);
      return card;
    }

    var max = rows[0].n;
    var list = el('div', { class: 'bar-list' });
    rows.forEach(function (r) {
      list.appendChild(el('div', { class: 'bar-item' }, [
        el('div', { class: 'bar-item__top' }, [
          el('span', { class: 'bar-item__name', title: r.question, text: r.question }),
          el('span', { class: 'bar-item__val', text: UI.num(r.n) + '×' })
        ]),
        el('div', { class: 'bar-item__track' },
          el('div', { class: 'bar-item__fill', style: { width: (r.n / max * 100) + '%', background: '#4356AE' } })),
        el('div', { style: { fontSize: '11.5px', color: 'var(--ink-3)', marginTop: '3px' }, text: r.form || '' })
      ]));
    });
    body.appendChild(list);
    card.appendChild(body);
    return card;
  }

  /* ---------- Distribución por tipología ---------- */

  function cardBreakdown(devs) {
    var card = wrapCard('Tipología de las desviaciones', 'Reparto por gravedad y categoría de riesgo', 'layers');
    var body = el('div', { class: 'card__body' });

    var sev = groupBy(devs, 'severityId');
    var cat = groupBy(devs, 'categoryId');

    if (!devs.length) {
      body.appendChild(el('div', { class: 'hint', style: { textAlign: 'center', padding: '26px 0' }, text: 'Sin desviaciones en el periodo.' }));
      card.appendChild(body);
      return card;
    }

    var hasCatalogs = Store.catalog('severity').length || Store.catalog('category').length;
    if (!hasCatalogs) {
      body.appendChild(el('div', { style: { textAlign: 'center', padding: '18px 0' } }, [
        el('div', { class: 'hint', style: { marginBottom: '12px' }, text: 'Aún no has definido niveles de gravedad ni categorías de riesgo. Créalos para poder analizar las desviaciones por tipología.' }),
        el('button', {
          class: 'btn btn--ghost btn--sm', html: ico('sliders', 15) + '<span>Definir tipologías</span>',
          onclick: function () { App.go('ajustes'); }
        })
      ]));
      card.appendChild(body);
      return card;
    }

    if (sev.length) {
      body.appendChild(el('div', { style: { fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-3)', marginBottom: '10px' }, text: 'Por gravedad' }));
      body.appendChild(stackedBar(sev, devs.length));
    }
    if (cat.length) {
      body.appendChild(el('div', { style: { fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-3)', margin: '20px 0 10px' }, text: 'Por categoría de riesgo' }));
      body.appendChild(stackedBar(cat, devs.length));
    }

    card.appendChild(body);
    return card;
  }

  function groupBy(devs, key) {
    var map = {};
    devs.forEach(function (d) {
      var id = d[key] || '';
      map[id] = (map[id] || 0) + 1;
    });
    return Object.keys(map).map(function (id) {
      return {
        id: id,
        name: id ? Store.catalogName(id) : 'Sin clasificar',
        color: id ? Store.catalogColor(id) : '#C4C9DE',
        n: map[id]
      };
    }).sort(function (a, b) { return b.n - a.n; });
  }

  function stackedBar(groups, total) {
    var bar = el('div', {
      style: { display: 'flex', height: '13px', borderRadius: '7px', overflow: 'hidden', background: 'var(--surface)' }
    });
    groups.forEach(function (g) {
      bar.appendChild(el('div', {
        style: { width: (g.n / total * 100) + '%', background: g.color },
        title: g.name + ': ' + g.n
      }));
    });
    var legend = el('div', { class: 'chart-legend', style: { justifyContent: 'flex-start', marginTop: '11px' } });
    groups.forEach(function (g) {
      legend.appendChild(el('div', { class: 'chart-legend__item' }, [
        el('span', { class: 'chart-legend__dot', style: { background: g.color } }),
        el('span', { text: g.name + ' · ' + UI.num(g.n) + ' (' + UI.pct(Math.round(g.n / total * 100)) + ')' })
      ]));
    });
    return el('div', {}, [bar, legend]);
  }

  /* ---------- Control de acciones ---------- */

  function openActions() {
    return Store.all('actions').filter(function (a) { return a.status !== 'done'; });
  }

  function isOverdue(a) {
    if (!a.dueDate || a.status === 'done') return false;
    return UI.relativeDays(a.dueDate) < 0;
  }

  function cardActions() {
    var card = wrapCard('Control del plan de acción', 'Estado de las acciones correctoras', 'target');
    var body = el('div', { class: 'card__body' });

    var all = Store.all('actions');
    if (!all.length) {
      body.appendChild(el('div', { class: 'hint', style: { textAlign: 'center', padding: '30px 0' }, text: 'Todavía no hay acciones correctoras. Se crean automáticamente al registrar una desviación con acción asociada.' }));
      card.appendChild(body);
      return card;
    }

    var open = all.filter(function (a) { return a.status === 'open'; }).length;
    var prog = all.filter(function (a) { return a.status === 'progress'; }).length;
    var done = all.filter(function (a) { return a.status === 'done'; }).length;
    var over = all.filter(isOverdue).length;

    var grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px', marginBottom: '16px' } });
    [
      ['Abiertas', open, 'var(--coral-dark)'],
      ['En curso', prog, 'var(--warn)'],
      ['Cerradas', done, 'var(--ok)'],
      ['Vencidas', over, over ? 'var(--coral-dark)' : 'var(--ink-3)']
    ].forEach(function (r) {
      grid.appendChild(el('div', {
        style: { background: 'var(--surface)', borderRadius: '12px', padding: '13px 15px' }
      }, [
        el('div', { style: { fontSize: '23px', fontWeight: '700', color: r[2], letterSpacing: '-.03em' }, text: UI.num(r[1]) }),
        el('div', { style: { fontSize: '12px', color: 'var(--ink-3)', fontWeight: '600' }, text: r[0] })
      ]));
    });
    body.appendChild(grid);

    var pct = all.length ? Math.round(done / all.length * 100) : 0;
    body.appendChild(el('div', { class: 'bar-item' }, [
      el('div', { class: 'bar-item__top' }, [
        el('span', { class: 'bar-item__name', text: 'Grado de cierre' }),
        el('span', { class: 'bar-item__val', text: UI.num(done) + ' de ' + UI.num(all.length) + ' (' + UI.pct(pct) + ')' })
      ]),
      el('div', { class: 'bar-item__track' },
        el('div', { class: 'bar-item__fill', style: { width: pct + '%', background: 'linear-gradient(90deg,#4356AE,#178A6B)' } }))
    ]));

    var next = all.filter(function (a) { return a.status !== 'done' && a.dueDate; })
      .sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; }).slice(0, 4);

    if (next.length) {
      body.appendChild(el('div', {
        style: { fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-3)', margin: '20px 0 9px' },
        text: 'Próximos vencimientos'
      }));
      next.forEach(function (a) {
        var days = UI.relativeDays(a.dueDate);
        body.appendChild(el('div', {
          style: { display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }
        }, [
          el('span', {
            style: { width: '7px', height: '7px', borderRadius: '50%', flex: 'none', background: days < 0 ? 'var(--coral)' : days <= 7 ? 'var(--warn)' : 'var(--navy-soft)' }
          }),
          el('span', {
            style: { fontSize: '13.5px', flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            title: a.title, text: a.title
          }),
          el('span', {
            class: 'tag ' + (days < 0 ? 'tag--danger' : days <= 7 ? 'tag--warn' : ''),
            text: days < 0 ? 'Vencida ' + Math.abs(days) + 'd' : days === 0 ? 'Hoy' : 'En ' + days + 'd'
          })
        ]));
      });
    }

    body.appendChild(el('button', {
      class: 'btn btn--ghost btn--sm btn--block', style: { marginTop: '14px' },
      html: ico('arrowRight', 15) + '<span>Ir al plan de acción</span>',
      onclick: function () { App.go('acciones'); }
    }));

    card.appendChild(body);
    return card;
  }

  /* ---------- Utilidades ---------- */

  function wrapCard(title, sub, icon) {
    return el('div', { class: 'card' }, el('div', { class: 'card__head' }, [
      el('span', {
        style: { width: '30px', height: '30px', borderRadius: '9px', background: 'var(--navy-wash)', color: 'var(--navy)', display: 'grid', placeItems: 'center', flex: 'none' },
        html: ico(icon, 16)
      }),
      el('div', {}, [
        el('div', { class: 'card__title', text: title }),
        sub ? el('div', { class: 'card__sub', text: sub }) : null
      ])
    ]));
  }

  /* ---------- Informe del dashboard en PDF ----------
     Recoge, tal cual se ve en pantalla, todos los bloques del dashboard:
     KPIs, evolución mensual, conformidad, desglose por cuestionario, puntos
     que más fallan, tipología de las desviaciones y control del plan de
     acción. Pensado para poder adjuntarlo a un correo, no para sustituir el
     detalle del CSV. Se maqueta con las mismas primitivas jsPDF que
     js/pdf.js usa para el informe de una visita, pero de forma
     independiente: cada informe tiene su propia paginación y necesidades.
     ========================================================================== */

  var PDF_NAVY = [30, 43, 111];
  var PDF_CORAL = [224, 92, 92];
  var PDF_GREEN = [23, 138, 107];
  var PDF_AMBER = [199, 122, 16];
  var PDF_INK = [20, 27, 61];
  var PDF_INK2 = [74, 83, 120];
  var PDF_INK3 = [122, 131, 163];
  var PDF_LINE = [226, 229, 240];
  var PDF_SURFACE = [243, 244, 248];

  function pdfAvailable() { return !!(global.jspdf && global.jspdf.jsPDF); }

  // En el PDF no hay reflujo de línea, así que basta un espacio normal: el
  // espacio duro de UI.pct() no siempre está bien mapeado en las fuentes
  // base de jsPDF (mismo motivo que fmtPct() en js/pdf.js).
  function fmtPctPdf(n) { return UI.num(n) + ' %'; }

  function periodLabel() {
    if (filters.period === 'custom') {
      return (filters.from ? UI.fmtDate(filters.from) : '…') + ' – ' + (filters.to ? UI.fmtDate(filters.to) : '…');
    }
    var labels = { '1m': 'Último mes', '3m': 'Últimos 3 meses', '6m': 'Últimos 6 meses', '12m': 'Último año', all: 'Todo el histórico' };
    return labels[filters.period] || 'Periodo seleccionado';
  }

  function activeFilterLabels() {
    var out = [];
    if (filters.formId) { var f = Store.get('forms', filters.formId); if (f) out.push('Cuestionario: ' + f.name); }
    if (filters.centerId) out.push('Centro: ' + Store.catalogName(filters.centerId));
    if (filters.areaId) out.push('Área: ' + Store.catalogName(filters.areaId));
    if (filters.severityId) out.push('Gravedad: ' + Store.catalogName(filters.severityId));
    if (filters.categoryId) out.push('Categoría: ' + Store.catalogName(filters.categoryId));
    activeDims().forEach(function (listId) {
      var l = Store.get('lists', listId);
      if (l) out.push(l.name + ': ' + Store.catalogName(dimFilters[listId]));
    });
    return out;
  }

  function hexToRgbLocal(hex) {
    var c = String(hex || '#4356AE').replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return isNaN(r) ? [67, 86, 174] : [r, g, b];
  }

  function buildDashboardPDF(visits, devs) {
    var doc = new global.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    var settings = Store.settings();
    var M = 15, W = 210, H = 297, CW = W - M * 2;
    var y = 0;
    var fontState = { size: 10, style: 'normal', color: PDF_INK };

    function applyFont() {
      doc.setFont('helvetica', fontState.style);
      doc.setFontSize(fontState.size);
      doc.setTextColor.apply(doc, fontState.color);
    }
    function setFont(size, style, color) { fontState = { size: size, style: style || 'normal', color: color || PDF_INK }; applyFont(); }
    function newPage() { doc.addPage(); y = M + 12; runningHeader(); }
    function ensure(h) { if (y + h > H - 20) newPage(); }

    function runningHeader() {
      var saved = fontState;
      doc.setDrawColor.apply(doc, PDF_LINE);
      doc.setLineWidth(0.3);
      doc.line(M, M + 4, W - M, M + 4);
      setFont(8, 'normal', PDF_INK3);
      doc.text(settings.appName || 'Safety Rounds', M, M + 1);
      doc.text('Dashboard de control', W - M, M + 1, { align: 'right' });
      fontState = saved;
      applyFont();
    }

    function text(str, size, style, color, x, maxW) {
      setFont(size, style, color);
      var lines = doc.splitTextToSize(String(str == null ? '' : str), maxW || CW);
      var lh = size * 0.4;
      lines.forEach(function (ln) { ensure(lh + 1); doc.text(ln, x === undefined ? M : x, y); y += lh; });
      return lines.length;
    }
    function gap(n) { y += n; }

    function sectionTitle(t) {
      ensure(14);
      doc.setFillColor.apply(doc, PDF_NAVY);
      doc.roundedRect(M, y, CW, 8, 1.8, 1.8, 'F');
      setFont(9, 'bold', [255, 255, 255]);
      doc.text(String(t).toUpperCase(), M + 4, y + 5.4);
      y += 13;
    }

    function drawMiniBar(frac, color) {
      ensure(4);
      var barH = 3, w = CW * Math.max(0.01, Math.min(1, frac));
      doc.setFillColor.apply(doc, PDF_SURFACE);
      doc.roundedRect(M, y, CW, barH, 1.2, 1.2, 'F');
      doc.setFillColor.apply(doc, color);
      doc.roundedRect(M, y, w, barH, 1.2, 1.2, 'F');
      y += barH + 3;
    }

    function drawStackedBar(segs) {
      var total = segs.reduce(function (a, s) { return a + s.v; }, 0) || 1;
      ensure(16);
      var barH = 7, x = M;
      doc.setFillColor.apply(doc, PDF_SURFACE);
      doc.roundedRect(M, y, CW, barH, 2, 2, 'F');
      segs.forEach(function (s) {
        if (!s.v) return;
        var w = s.v / total * CW;
        doc.setFillColor.apply(doc, s.color);
        doc.rect(x, y, w, barH, 'F');
        x += w;
      });
      y += barH + 5;
      var legend = segs.filter(function (s) { return s.v; }).map(function (s) {
        return s.label + ': ' + UI.num(s.v) + ' (' + fmtPctPdf(Math.round(s.v / total * 100)) + ')';
      }).join('    ·    ');
      setFont(7.5, 'normal', PDF_INK2);
      doc.text(doc.splitTextToSize(legend, CW), M, y);
      y += 8;
    }

    function drawBarChart(labels, series) {
      var chartH = 50, top = y;
      var max = Math.max(1, series.reduce(function (m, s) { return Math.max(m, Math.max.apply(null, s.values.concat([0]))); }, 0));
      max = niceMax(max);
      var n = labels.length;
      var groupW = CW / n;
      var barW = Math.min(6, groupW / (series.length + 1.5));

      doc.setDrawColor.apply(doc, PDF_LINE);
      doc.setLineWidth(0.2);
      for (var g = 0; g <= 4; g++) {
        var gy = top + chartH - (g / 4) * chartH;
        doc.line(M, gy, M + CW, gy);
        setFont(6.5, 'normal', PDF_INK3);
        doc.text(String(Math.round(max * g / 4)), M - 2, gy + 1, { align: 'right' });
      }

      var step = n > 10 ? Math.ceil(n / 8) : 1;
      labels.forEach(function (lab, i) {
        var gx = M + i * groupW + groupW / 2 - (series.length * barW) / 2;
        series.forEach(function (s, si) {
          var v = s.values[i];
          var bh = (v / max) * chartH;
          doc.setFillColor.apply(doc, s.color);
          doc.rect(gx + si * barW, top + chartH - bh, barW - 0.6, bh, 'F');
        });
        if (i % step === 0 || i === n - 1) {
          setFont(6, 'normal', PDF_INK3);
          doc.text(lab, M + i * groupW + groupW / 2, top + chartH + 5, { align: 'center' });
        }
      });

      y = top + chartH + 10;
      var legend = series.map(function (s) {
        return s.name + ' (' + UI.num(s.values.reduce(function (a, b) { return a + b; }, 0)) + ')';
      }).join('    ·    ');
      setFont(7.5, 'normal', PDF_INK2);
      doc.text(legend, W / 2, y, { align: 'center' });
      y += 8;
    }

    /* ---- Portada ---- */
    doc.setFillColor.apply(doc, PDF_NAVY);
    doc.rect(0, 0, W, 40, 'F');
    doc.setFillColor.apply(doc, PDF_CORAL);
    doc.rect(0, 40, W, 1.6, 'F');
    setFont(9, 'bold', [241, 107, 107]);
    doc.text((settings.company || settings.department || 'SAFETY & HEALTH').toUpperCase(), M, 15);
    setFont(19, 'bold', [255, 255, 255]);
    doc.text('Dashboard de control', M, 25);
    setFont(9, 'normal', [200, 206, 235]);
    doc.text(periodLabel(), M, 32);
    setFont(8, 'normal', [200, 206, 235]);
    doc.text(UI.fmtDateTime(new Date()), W - M, 24, { align: 'right' });
    y = 52;

    var activeFilters = activeFilterLabels();
    if (activeFilters.length) {
      text('Filtros activos: ' + activeFilters.join('  ·  '), 8.5, 'italic', PDF_INK3);
      gap(4);
    }

    /* ---- KPIs ---- */
    var openDevsN = devs.filter(function (d) { return d.status !== 'closed'; }).length;
    var totalsK = visits.reduce(function (acc, v) { var s = v.score || {}; acc.ok += s.ok || 0; acc.ko += s.ko || 0; return acc; }, { ok: 0, ko: 0 });
    var pctK = (totalsK.ok + totalsK.ko) ? Math.round(totalsK.ok / (totalsK.ok + totalsK.ko) * 100) : 0;
    var overdueK = openActions().filter(isOverdue).length;

    var kpis = [
      { label: 'VISITAS', value: UI.num(visits.length), color: PDF_NAVY },
      { label: 'DESVIACIONES', value: UI.num(devs.length), color: PDF_CORAL },
      { label: 'ABIERTAS', value: UI.num(openDevsN), color: openDevsN ? PDF_AMBER : PDF_GREEN },
      { label: '% CONFORMIDAD', value: fmtPctPdf(pctK), color: pctK >= 90 ? PDF_GREEN : pctK >= 70 ? PDF_AMBER : PDF_CORAL }
    ];
    if (overdueK) kpis.push({ label: 'VENCIDAS', value: UI.num(overdueK), color: PDF_CORAL });

    var kn = kpis.length, kw = (CW - (kn - 1) * 3) / kn;
    ensure(24);
    kpis.forEach(function (c, i) {
      var x = M + i * (kw + 3);
      doc.setDrawColor.apply(doc, PDF_LINE);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, kw, 20, 2.5, 2.5, 'S');
      doc.setFillColor.apply(doc, c.color);
      doc.roundedRect(x, y, 1.6, 20, 0.8, 0.8, 'F');
      setFont(14, 'bold', c.color);
      doc.text(String(c.value), x + 4, y + 10);
      setFont(6, 'bold', PDF_INK3);
      doc.text(doc.splitTextToSize(c.label, kw - 6), x + 4, y + 15.5);
    });
    y += 28;

    /* ---- Evolución mensual ---- */
    var months = monthRange(visits, devs);
    if (months.length) {
      sectionTitle('Evolución mensual');
      var vCounts = months.map(function (m) { return visits.filter(function (v) { return UI.monthKey(v.date) === m; }).length; });
      var dCounts = months.map(function (m) { return devs.filter(function (d) { return UI.monthKey(d.date) === m; }).length; });
      ensure(65);
      drawBarChart(months.map(UI.monthLabel), [
        { name: 'Visitas', values: vCounts, color: PDF_NAVY },
        { name: 'Desviaciones', values: dCounts, color: PDF_CORAL }
      ]);
    }

    /* ---- Conformidad ---- */
    var tC = visits.reduce(function (acc, v) { var s = v.score || {}; acc.ok += s.ok || 0; acc.ko += s.ko || 0; acc.na += s.na || 0; return acc; }, { ok: 0, ko: 0, na: 0 });
    var baseC = tC.ok + tC.ko;
    if (baseC || tC.na) {
      sectionTitle('Nivel de conformidad');
      var pctC = baseC ? Math.round(tC.ok / baseC * 100) : 0;
      text('Conformidad global: ' + fmtPctPdf(pctC) + ' (' + UI.num(tC.ok) + ' de ' + UI.num(baseC) + ' puntos evaluados)', 10, 'bold', PDF_INK);
      gap(3);
      drawStackedBar([
        { label: 'Conformes', v: tC.ok, color: PDF_GREEN },
        { label: 'Desviaciones', v: tC.ko, color: PDF_CORAL },
        { label: 'No aplica', v: tC.na, color: PDF_INK3 }
      ]);
    }

    /* ---- Desglose por cuestionario ---- */
    var byForm = {};
    visits.forEach(function (v) {
      var k = v.formId || 'sin';
      byForm[k] = byForm[k] || { name: v.formName || 'Sin nombre', visits: 0, devs: 0, ok: 0, ko: 0 };
      byForm[k].visits++;
      byForm[k].ok += (v.score || {}).ok || 0;
      byForm[k].ko += (v.score || {}).ko || 0;
    });
    devs.forEach(function (d) { var k = d.formId || 'sin'; if (byForm[k]) byForm[k].devs++; });
    var formRows = Object.keys(byForm).map(function (k) { return byForm[k]; })
      .sort(function (a, b) { return b.devs - a.devs || b.visits - a.visits; });

    if (formRows.length) {
      sectionTitle('Desglose por cuestionario');
      var maxDev = Math.max.apply(null, formRows.map(function (r) { return r.devs; }).concat([1]));
      formRows.slice(0, 8).forEach(function (r) {
        ensure(13);
        var baseR = r.ok + r.ko;
        var pR = baseR ? Math.round(r.ok / baseR * 100) : null;
        var rowY = y + 3.5;
        setFont(9, 'bold', PDF_INK);
        doc.text(doc.splitTextToSize(r.name, CW - 70)[0], M, rowY);
        setFont(8, 'normal', PDF_INK3);
        doc.text(UI.num(r.devs) + ' desv. · ' + UI.num(r.visits) + ' visitas' + (pR !== null ? ' · ' + fmtPctPdf(pR) : ''), W - M, rowY, { align: 'right' });
        y = rowY + 3;
        drawMiniBar(r.devs / maxDev, r.devs ? PDF_CORAL : PDF_LINE);
        gap(2);
      });
    }

    /* ---- Puntos que más fallan ---- */
    var qMap = {};
    devs.forEach(function (d) {
      var k = d.formId + '::' + d.question;
      qMap[k] = qMap[k] || { question: d.question, form: d.formName, n: 0 };
      qMap[k].n++;
    });
    var qRows = Object.keys(qMap).map(function (k) { return qMap[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 7);
    if (qRows.length) {
      sectionTitle('Puntos que más fallan');
      qRows.forEach(function (r) {
        ensure(11);
        var rowY = y + 3.5;
        setFont(9, 'normal', PDF_INK);
        doc.text(doc.splitTextToSize(r.question, CW - 25)[0], M, rowY);
        setFont(8.5, 'bold', PDF_CORAL);
        doc.text(UI.num(r.n) + '×', W - M, rowY, { align: 'right' });
        setFont(7.5, 'normal', PDF_INK3);
        doc.text(doc.splitTextToSize(r.form || '', CW - 25)[0], M, rowY + 4);
        y = rowY + 8;
      });
    }

    /* ---- Tipología de las desviaciones ---- */
    var sevGroups = groupBy(devs, 'severityId');
    var catGroups = groupBy(devs, 'categoryId');
    if (devs.length && (sevGroups.length || catGroups.length)) {
      sectionTitle('Tipología de las desviaciones');
      if (sevGroups.length) {
        text('Por gravedad', 8, 'bold', PDF_INK3);
        gap(1);
        drawStackedBar(sevGroups.map(function (g) { return { label: g.name, v: g.n, color: hexToRgbLocal(g.color) }; }));
      }
      if (catGroups.length) {
        text('Por categoría de riesgo', 8, 'bold', PDF_INK3);
        gap(1);
        drawStackedBar(catGroups.map(function (g) { return { label: g.name, v: g.n, color: hexToRgbLocal(g.color) }; }));
      }
    }

    /* ---- Control del plan de acción ---- */
    var allActions = Store.all('actions');
    if (allActions.length) {
      sectionTitle('Control del plan de acción');
      var openA = allActions.filter(function (a) { return a.status === 'open'; }).length;
      var progA = allActions.filter(function (a) { return a.status === 'progress'; }).length;
      var doneA = allActions.filter(function (a) { return a.status === 'done'; }).length;
      var overA = allActions.filter(isOverdue).length;
      var aStats = [
        { label: 'ABIERTAS', v: openA, color: PDF_CORAL },
        { label: 'EN CURSO', v: progA, color: PDF_AMBER },
        { label: 'CERRADAS', v: doneA, color: PDF_GREEN },
        { label: 'VENCIDAS', v: overA, color: overA ? PDF_CORAL : PDF_INK3 }
      ];
      var aw = (CW - 3 * 3) / 4;
      ensure(20);
      aStats.forEach(function (s, i) {
        var x = M + i * (aw + 3);
        setFont(15, 'bold', s.color);
        doc.text(String(s.v), x, y + 8);
        setFont(6.5, 'bold', PDF_INK3);
        doc.text(s.label, x, y + 13);
      });
      y += 20;

      var nextDue = allActions.filter(function (a) { return a.status !== 'done' && a.dueDate; })
        .sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; }).slice(0, 6);
      if (nextDue.length) {
        text('Próximos vencimientos', 8, 'bold', PDF_INK3);
        gap(2);
        nextDue.forEach(function (a) {
          ensure(6);
          var days = UI.relativeDays(a.dueDate);
          var rowY = y + 3;
          setFont(8.5, 'normal', PDF_INK);
          doc.text(doc.splitTextToSize(a.title, CW - 35)[0], M, rowY);
          setFont(7.5, 'bold', days < 0 ? PDF_CORAL : days <= 7 ? PDF_AMBER : PDF_INK3);
          doc.text(days < 0 ? 'Vencida ' + Math.abs(days) + 'd' : days === 0 ? 'Hoy' : 'En ' + days + 'd', W - M, rowY, { align: 'right' });
          y = rowY + 4.5;
        });
      }
    }

    /* ---- Pie con paginación ---- */
    var totalPages = doc.internal.getNumberOfPages();
    for (var p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setDrawColor.apply(doc, PDF_LINE);
      doc.setLineWidth(0.3);
      doc.line(M, H - 14, W - M, H - 14);
      setFont(7.5, 'normal', PDF_INK3);
      doc.text(settings.company || settings.department || '', M, H - 9.5);
      doc.text('Página ' + p + ' de ' + totalPages, W - M, H - 9.5, { align: 'right' });
      setFont(6.5, 'normal', [180, 186, 210]);
      doc.text('Generado con ' + (settings.appName || 'Safety Rounds') + ' · ' + UI.fmtDateTime(new Date()), M, H - 5.5);
    }

    return doc;
  }

  function exportDashboardPDF(visits, devs) {
    if (!pdfAvailable()) {
      UI.toast('El generador de PDF no está disponible en este navegador.', 'err');
      return;
    }
    var doc;
    try {
      doc = buildDashboardPDF(visits, devs);
    } catch (e) {
      console.error(e);
      UI.toast('No se ha podido generar el PDF: ' + e.message, 'err');
      return;
    }
    doc.save('dashboard-' + UI.fmtDateInput(new Date()) + '.pdf');
    UI.toast('Dashboard descargado en PDF.');
  }

  /* ---------- Exportación ---------- */

  function exportMenu(visits, devs) {
    UI.modal({
      title: 'Exportar datos',
      subtitle: 'Se exporta lo que muestran los filtros activos, en CSV compatible con Excel.',
      icon: 'table',
      body: el('div', { style: { paddingBottom: '6px' } }, [
        exportRow('Visitas realizadas', visits.length + ' registros', function () { exportVisits(visits); }),
        exportRow('Desviaciones detectadas', devs.length + ' registros', function () { exportDeviations(devs); }),
        exportRow('Plan de acción', Store.all('actions').length + ' registros', function () { exportActions(); }),
        exportRow('Resumen por cuestionario', 'Indicadores agregados', function () { exportSummary(visits, devs); })
      ]),
      buttons: [{ label: 'Cerrar', kind: 'quiet' }]
    });
  }

  function exportRow(title, sub, onClick) {
    return el('button', {
      style: {
        display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left',
        padding: '13px 14px', border: '1px solid var(--line)', borderRadius: '12px', marginBottom: '9px', background: '#fff'
      },
      onclick: onClick
    }, [
      el('span', { style: { color: 'var(--navy)' }, html: ico('download', 18) }),
      el('span', { style: { flex: '1' } }, [
        el('div', { style: { fontWeight: '650', fontSize: '14px' }, text: title }),
        el('div', { style: { fontSize: '12.5px', color: 'var(--ink-3)' }, text: sub })
      ]),
      el('span', { style: { color: 'var(--ink-3)' }, html: ico('chevronRight', 16) })
    ]);
  }

  /** Nombres de los elementos que una visita tiene en una tipología dada. */
  function dimNames(rec, listId) {
    return ((rec.dimensions || {})[listId] || [])
      .map(function (id) { return Store.catalogName(id, ''); })
      .filter(Boolean).join(' / ');
  }

  function exportVisits(visits) {
    var dims = extraDimensions();
    var rows = [['Referencia', 'Fecha', 'Cuestionario', 'Inspector', 'Centro', 'Área']
      .concat(dims.map(function (l) { return l.name; }))
      .concat(['Conformes', 'Desviaciones', 'No aplica', '% conformidad', 'Estado'])];

    visits.forEach(function (v) {
      var s = v.score || {};
      rows.push([v.code, v.date, v.formName, v.inspector,
        v.centerId ? Store.catalogName(v.centerId) : '', v.areaId ? Store.catalogName(v.areaId) : '']
        .concat(dims.map(function (l) { return dimNames(v, l.id); }))
        .concat([s.ok || 0, s.ko || 0, s.na || 0, (s.pct || 0),
          v.status === 'completed' ? 'Finalizada' : 'Borrador']));
    });
    UI.downloadCSV('visitas-' + UI.fmtDateInput(new Date()) + '.csv', rows);
  }

  function exportDeviations(devs) {
    var dims = extraDimensions();
    var rows = [['Visita', 'Fecha', 'Cuestionario', 'Punto de inspección', 'Descripción', 'Gravedad', 'Categoría', 'Centro', 'Área']
      .concat(dims.map(function (l) { return l.name; }))
      .concat(['Inspector', 'Estado', 'Fotos'])];

    devs.forEach(function (d) {
      rows.push([d.visitCode, d.date, d.formName, d.question, d.description,
        d.severityId ? Store.catalogName(d.severityId) : '', d.categoryId ? Store.catalogName(d.categoryId) : '',
        d.centerId ? Store.catalogName(d.centerId) : '', d.areaId ? Store.catalogName(d.areaId) : '']
        .concat(dims.map(function (l) { return dimNames(d, l.id); }))
        .concat([d.inspector, statusLabel(d.status), (d.photos || []).length]));
    });
    UI.downloadCSV('desviaciones-' + UI.fmtDateInput(new Date()) + '.csv', rows);
  }

  function exportActions() {
    var rows = [['Visita', 'Acción', 'Descripción de la desviación', 'Responsable', 'Fecha límite', 'Estado', 'Días de retraso', 'Notas']];
    Store.all('actions').forEach(function (a) {
      var d = a.dueDate ? UI.relativeDays(a.dueDate) : null;
      rows.push([a.visitCode, a.title, a.description, a.responsible, a.dueDate,
        statusLabel(a.status), (d !== null && d < 0 && a.status !== 'done') ? Math.abs(d) : '', a.notes || '']);
    });
    UI.downloadCSV('plan-de-accion-' + UI.fmtDateInput(new Date()) + '.csv', rows);
  }

  function exportSummary(visits, devs) {
    var map = {};
    visits.forEach(function (v) {
      var k = v.formId;
      map[k] = map[k] || { name: v.formName, visits: 0, ok: 0, ko: 0, na: 0, devs: 0 };
      map[k].visits++;
      map[k].ok += (v.score || {}).ok || 0;
      map[k].ko += (v.score || {}).ko || 0;
      map[k].na += (v.score || {}).na || 0;
    });
    devs.forEach(function (d) { if (map[d.formId]) map[d.formId].devs++; });

    var rows = [['Cuestionario', 'Visitas', 'Puntos conformes', 'Desviaciones', 'No aplica', '% conformidad', 'Desviaciones por visita']];
    Object.keys(map).forEach(function (k) {
      var r = map[k];
      var base = r.ok + r.ko;
      // Decimal con coma: el CSV se separa por «;» y Excel en español lo
      // interpreta como número, no como texto.
      rows.push([r.name, r.visits, r.ok, r.ko, r.na,
        (base ? Math.round(r.ok / base * 100) : 0),
        r.visits ? UI.dec(r.devs / r.visits, 2) : '0']);
    });
    UI.downloadCSV('resumen-cuestionarios-' + UI.fmtDateInput(new Date()) + '.csv', rows);
  }

  function statusLabel(s) {
    return s === 'done' || s === 'closed' ? 'Cerrada' : s === 'progress' ? 'En curso' : 'Abierta';
  }

  /* ---------- Exposición ---------- */

  global.Dashboard = {
    render: render,
    isOverdue: isOverdue,
    statusLabel: statusLabel,
    exportVisits: exportVisits,
    exportDeviations: exportDeviations,
    exportActions: exportActions
  };
})(window);
