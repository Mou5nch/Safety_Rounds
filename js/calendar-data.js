/* ==========================================================================
   Safety Rounds — Datos del calendario
   Lo que se pone en el calendario y en el resumen «de un vistazo», común a
   Safety Desk (js/calendar.js) y Safety Go (campo/js/calendar.js), para que los
   dos cuenten lo mismo. Tres tipos de entrada:
     · plan    — ronda prevista de un cuestionario en una planta (periodicidad)
     · expiry  — fecha límite de una acción del plan de acción, con la
                 desviación a la que corrige (la «caducidad» de la desviación)
     · done    — visita ya realizada
   Y un grado de urgencia común: late (vencida) · soon (hoy y los 7 días
   siguientes) · later (más adelante) · done.
   ========================================================================== */
(function (global) {
  'use strict';

  var SOON_DAYS = 7;

  function urgency(days) {
    if (days === null || days === undefined) return 'later';
    return days < 0 ? 'late' : days <= SOON_DAYS ? 'soon' : 'later';
  }

  /* ---------- Plantas ---------- */

  function centers() { return Store.catalog('center'); }

  function strip(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }

  /**
   * Código corto de cada planta para las casillas del calendario: tres letras
   * de su nombre (BAR, TAR…), o las que hagan falta si dos plantas empiezan igual.
   */
  function plantCodes() {
    var list = centers(), out = {};
    list.forEach(function (c) {
      var base = strip(c.name) || '···', n = Math.min(3, base.length);
      function clash() {
        return list.some(function (o) { return o.id !== c.id && strip(o.name).slice(0, n) === base.slice(0, n); });
      }
      while (n < base.length && clash()) n++;
      out[c.id] = base.slice(0, n);
    });
    return out;
  }

  function plantColor(id) { return id ? Store.catalogColor(id, '#4356AE') : '#7A83A3'; }

  /* ---------- Vencimientos de las desviaciones ---------- */

  function expiryOf(a) {
    var dev = a.deviationId ? Store.get('deviations', a.deviationId) : null;
    var days = UI.relativeDays(a.dueDate);
    return {
      type: 'expiry', id: a.id, date: a.dueDate, daysUntil: days, urgency: urgency(days),
      centerId: a.centerId || (dev && dev.centerId) || '',
      title: a.title || 'Acción correctora', responsible: a.responsible || '',
      devId: dev ? dev.id : '', devTitle: dev ? (dev.question || 'Desviación') : '',
      severityId: dev ? dev.severityId : '', status: a.status, data: a
    };
  }

  /** Acciones del plan de acción sin cerrar y con fecha límite, la más próxima primero. */
  function expiries(plant) {
    return Store.query('actions', function (a) { return a.status !== 'done' && a.dueDate; })
      .map(expiryOf)
      .filter(function (e) { return !plant || e.centerId === plant; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  /**
   * Lo abierto que no tiene fecha: desviaciones sin ningún plan de acción y
   * acciones sin fecha límite. No caducan nunca, y por eso conviene verlas.
   */
  function undated(plant) {
    var out = [];
    Store.query('deviations', function (d) { return d.status !== 'closed' && (!plant || d.centerId === plant); }).forEach(function (d) {
      var has = Store.query('actions', function (a) { return a.deviationId === d.id; }).length;
      if (!has) out.push({ type: 'nodate', reason: 'noplan', centerId: d.centerId || '', title: d.question || 'Desviación', devId: d.id, severityId: d.severityId, date: '', data: d });
    });
    Store.query('actions', function (a) { return a.status !== 'done' && !a.dueDate; }).forEach(function (a) {
      var e = expiryOf(a);
      if (plant && e.centerId !== plant) return;
      out.push({ type: 'nodate', reason: 'nodate', centerId: e.centerId, title: e.title, devId: e.devId, devTitle: e.devTitle, severityId: e.severityId, responsible: e.responsible, date: '', id: a.id, data: a });
    });
    return out;
  }

  /* ---------- Rondas previstas ---------- */

  /** La próxima ronda de cada cuestionario en cada planta (una por cuestionario y planta). */
  function nextRounds(plant) {
    return Recurrence.upcoming().filter(function (u) { return !plant || u.centerId === plant; }).map(function (u) {
      return { type: 'plan', date: u.date, daysUntil: u.daysUntil, urgency: urgency(u.daysUntil), centerId: u.centerId, title: u.formName, data: u };
    });
  }

  /* ---------- Entradas entre dos fechas (cuadrícula del mes) ---------- */

  var RANK = { expiry: 0, plan: 1, done: 2 };

  /** opts: { plant: id | '', types: { plan, expiry, done } } — todo activado por defecto. */
  function entries(from, to, opts) {
    opts = opts || {};
    var plant = opts.plant || '';
    var types = opts.types || { plan: true, expiry: true, done: true };
    var out = [];

    if (types.plan) {
      Recurrence.occurrences(from, to).forEach(function (u) {
        if (plant && u.centerId !== plant) return;
        out.push({ type: 'plan', date: u.date, daysUntil: u.daysUntil, urgency: urgency(u.daysUntil), centerId: u.centerId, title: u.formName, data: u });
      });
    }
    if (types.expiry) {
      expiries(plant).forEach(function (e) { if (e.date >= from && e.date <= to) out.push(e); });
    }
    if (types.done) {
      Store.query('visits', function (v) {
        return v.status === 'completed' && v.date >= from && v.date <= to && (!plant || v.centerId === plant);
      }).forEach(function (v) {
        out.push({ type: 'done', date: v.date, daysUntil: UI.relativeDays(v.date), urgency: 'done', centerId: v.centerId || '', title: v.formName || 'Visita', data: v });
      });
    }
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : RANK[a.type] - RANK[b.type]; });
    return out;
  }

  /* ---------- Resumen «de un vistazo» ---------- */

  /**
   * Lo próximo, ya filtrado por planta:
   *   rounds   — la próxima ronda de cada cuestionario y planta
   *   expiries — vencimientos del plan de acción
   *   undated  — abierto y sin fecha (sin plan de acción o sin fecha límite)
   *   counts   — cuántas cosas hay vencidas, para esta semana y más adelante
   */
  function overview(plant) {
    plant = plant || '';
    var rounds = nextRounds(plant), ex = expiries(plant), nd = undated(plant);
    var counts = { late: 0, soon: 0, later: 0 };
    rounds.concat(ex).forEach(function (it) { counts[it.urgency]++; });
    return { rounds: rounds, expiries: ex, undated: nd, counts: counts };
  }

  /** Agrupa rondas por planta (todas las plantas, con o sin rondas), la más urgente primero. */
  function groupByPlant(rounds, plant) {
    var codes = plantCodes();
    var groups = {};
    rounds.forEach(function (r) { (groups[r.centerId] = groups[r.centerId] || []).push(r); });
    return centers().filter(function (c) { return !plant || c.id === plant; }).map(function (c) {
      return { centerId: c.id, name: c.name, color: plantColor(c.id), code: codes[c.id], items: groups[c.id] || [] };
    }).sort(function (a, b) {
      var da = a.items.length ? a.items[0].date : '9999', db = b.items.length ? b.items[0].date : '9999';
      return da < db ? -1 : da > db ? 1 : a.name.localeCompare(b.name);
    });
  }

  /** «Vencida hace 3 días» · «Hoy» · «Mañana» · «En 5 días» — para fechas límite y rondas. */
  function when(days) {
    if (days === null || days === undefined) return '';
    if (days < 0) return 'Hace ' + Math.abs(days) + (Math.abs(days) === 1 ? ' día' : ' días');
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Mañana';
    return 'En ' + days + ' días';
  }

  global.CalData = {
    SOON_DAYS: SOON_DAYS,
    urgency: urgency, when: when,
    centers: centers, plantCodes: plantCodes, plantColor: plantColor,
    entries: entries, overview: overview, expiries: expiries, undated: undated, nextRounds: nextRounds,
    groupByPlant: groupByPlant
  };
})(window);
