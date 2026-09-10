/* ==========================================================================
   Safety Rounds — Periodicidad de cuestionarios
   Cálculo de la «próxima visita» de un cuestionario recurrente, centro a
   centro, a partir de la última visita completada (o de hoy, si nunca se
   ha realizado). Lo usan el constructor (configuración), el Dashboard (KPI)
   y el Calendario (vista mensual y agenda).
   ========================================================================== */
(function (global) {
  'use strict';

  var FREQUENCIES = [
    { value: 'daily', label: 'Diaria', unit: 'day', amount: 1 },
    { value: 'weekly', label: 'Semanal', unit: 'day', amount: 7 },
    { value: 'biweekly', label: 'Quincenal', unit: 'day', amount: 14 },
    { value: 'monthly', label: 'Mensual', unit: 'month', amount: 1 },
    { value: 'quarterly', label: 'Trimestral', unit: 'month', amount: 3 },
    { value: 'semiannual', label: 'Semestral', unit: 'month', amount: 6 },
    { value: 'annual', label: 'Anual', unit: 'month', amount: 12 },
    { value: 'custom', label: 'Personalizada (cada X días)', unit: 'day', amount: null }
  ];

  function freqDef(value) {
    return FREQUENCIES.filter(function (f) { return f.value === value; })[0] || FREQUENCIES[3];
  }

  function freqLabel(rec) {
    if (!rec) return '';
    if (rec.freq === 'custom') return 'Cada ' + (rec.customDays || 30) + ' días';
    return freqDef(rec.freq).label;
  }

  function defaultRecurrence() {
    return { enabled: false, freq: 'monthly', customDays: 30, centerIds: [] };
  }

  /* ---------- Aritmética de fechas ---------- */

  function addDays(d, n) {
    var r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function addMonths(d, n) {
    var r = new Date(d);
    r.setMonth(r.getMonth() + n);
    return r;
  }

  /** Siguiente fecha (YYYY-MM-DD) a partir de una fecha base y la periodicidad de un cuestionario. */
  function nextDate(fromDateStr, rec) {
    var def = freqDef(rec.freq);
    var base = UI.toDate(fromDateStr) || new Date();
    var amount = def.value === 'custom' ? Math.max(1, parseInt(rec.customDays, 10) || 30) : def.amount;
    var next = def.unit === 'month' ? addMonths(base, amount) : addDays(base, amount);
    return UI.fmtDateInput(next);
  }

  /** «Vencida 3d» · «Hoy» · «En 5d» — mismo formato que ya usa el plan de acción. */
  function dueLabel(daysUntil) {
    if (daysUntil < 0) return 'Vencida ' + Math.abs(daysUntil) + 'd';
    if (daysUntil === 0) return 'Hoy';
    return 'En ' + daysUntil + 'd';
  }

  /* ---------- Selección de datos ---------- */

  function recurringForms() {
    return Store.all('forms').filter(function (f) {
      return !f.archived && f.recurrence && f.recurrence.enabled && (f.recurrence.centerIds || []).length;
    });
  }

  /** Fecha (YYYY-MM-DD) de la última visita completada de ese cuestionario en ese centro, o null. */
  function lastVisitDate(formId, centerId) {
    var best = null;
    Store.all('visits').forEach(function (v) {
      if (v.formId !== formId || v.centerId !== centerId || v.status !== 'completed' || !v.date) return;
      if (!best || v.date > best) best = v.date;
    });
    return best;
  }

  /**
   * Una fila por cada combinación cuestionario+centro recurrente, con su
   * próxima fecha calculada. Si nunca se ha hecho, se considera pendiente
   * desde hoy. Ordenado por fecha, la más próxima primero.
   */
  function upcoming() {
    var out = [];
    recurringForms().forEach(function (f) {
      (f.recurrence.centerIds || []).forEach(function (centerId) {
        var center = Store.get('catalogs', centerId);
        if (!center) return; // el centro se eliminó después de activar la periodicidad
        var last = lastVisitDate(f.id, centerId);
        var date = last ? nextDate(last, f.recurrence) : UI.fmtDateInput(new Date());
        var daysUntil = UI.relativeDays(date);
        out.push({
          formId: f.id, formName: f.name, formColor: f.color || '#1E2B6F', formIcon: f.icon || 'clipboard',
          centerId: centerId, centerName: center.name,
          freqLabel: freqLabel(f.recurrence),
          lastDate: last, date: date, daysUntil: daysUntil,
          overdue: daysUntil < 0, isFirst: !last
        });
      });
    });
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return out;
  }

  /* ---------- Exposición ---------- */

  global.Recurrence = {
    FREQUENCIES: FREQUENCIES,
    freqDef: freqDef,
    freqLabel: freqLabel,
    defaultRecurrence: defaultRecurrence,
    nextDate: nextDate,
    dueLabel: dueLabel,
    recurringForms: recurringForms,
    lastVisitDate: lastVisitDate,
    upcoming: upcoming
  };
})(window);
