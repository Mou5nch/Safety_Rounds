/* ==========================================================================
   Safety Rounds · Campo — Inicio
   Lo que importa al llegar a planta: qué toca hacer hoy, cuánto hay abierto
   y por dónde seguir.
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el, esc = UI.esc;
  var Views = global.Views = global.Views || {};

  var DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function greeting() {
    var h = new Date().getHours();
    return h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
  }

  function firstName() {
    var me = Campo.auth();
    return String(me.name || me.username || '').replace(/@.*$/, '').split(/[\s._-]+/)[0] || '';
  }

  function kpi(label, value, kind, icon, onclick) {
    return el('button', { class: 'f-kpi f-kpi--' + kind, type: 'button', onclick: onclick }, [
      el('span', { class: 'f-kpi__icon', html: ico(icon, 20) }),
      el('span', { class: 'f-kpi__value', text: UI.num(value) }),
      el('span', { class: 'f-kpi__label', text: label })
    ]);
  }

  function section(title, action) {
    return el('div', { class: 'f-section' }, [
      el('h2', { class: 'f-section__title', text: title }),
      action || null
    ]);
  }

  function link(text, onclick) {
    return el('button', { class: 'f-link', type: 'button', text: text, onclick: onclick });
  }

  /** Fila «ronda por hacer» con botón de iniciar. */
  function dueRow(u) {
    var info = u.overdue ? { label: 'Vencida hace ' + Math.abs(u.daysUntil) + (Math.abs(u.daysUntil) === 1 ? ' día' : ' días'), kind: 'danger' }
      : u.daysUntil === 0 ? { label: 'Hoy', kind: 'warn' }
      : u.daysUntil === 1 ? { label: 'Mañana', kind: 'warn' }
      : { label: 'En ' + u.daysUntil + ' días', kind: u.daysUntil <= 7 ? 'warn' : '' };

    return el('div', { class: 'f-item f-item--stack' }, [
      el('div', { class: 'f-item__badge f-item__badge--' + (info.kind || 'navy'), html: ico('clipboard', 22) }),
      el('div', { class: 'f-item__main' }, [
        el('div', { class: 'f-item__title', text: u.formName }),
        Campo.metaLine([['building', u.centerName], ['refresh', u.freqLabel]])
      ]),
      el('div', { class: 'f-item__side' }, [
        Campo.tag(info.label, info.kind),
        el('button', {
          class: 'btn btn--primary btn--sm f-btn-sm', type: 'button',
          html: ico('play', 16) + '<span>Iniciar</span>',
          onclick: function () { Views.forms.startFor(u.formId, u.centerId); }
        })
      ])
    ]);
  }

  function draftRow(v) {
    return el('button', {
      class: 'f-item f-item--tap', type: 'button',
      onclick: function () { Shell.runVisit(v.formId, v.id); }
    }, [
      el('div', { class: 'f-item__badge f-item__badge--warn', html: ico('edit', 22) }),
      el('div', { class: 'f-item__main' }, [
        el('div', { class: 'f-item__title', text: v.formName || 'Visita en curso' }),
        Campo.metaLine([['calendar', UI.fmtDate(v.date)], v.centerId ? ['building', Store.catalogName(v.centerId)] : null])
      ]),
      el('span', { class: 'f-item__chev', html: ico('chevronRight', 20) })
    ]);
  }

  function devRow(d) {
    var color = d.severityId ? Store.catalogColor(d.severityId) : 'var(--coral)';
    return el('button', {
      class: 'f-item f-item--tap', type: 'button',
      onclick: function () { Views.deviations.openDetail(d.id); }
    }, [
      el('div', { class: 'f-item__badge', style: { background: UI.withAlpha(color.charAt(0) === '#' ? color : '#E05C5C', .14), color: color.charAt(0) === '#' ? color : '#E05C5C' }, html: ico('alert', 22) }),
      el('div', { class: 'f-item__main' }, [
        el('div', { class: 'f-item__title f-clamp-2', text: d.question || 'Desviación' }),
        Campo.metaLine([
          d.centerId ? ['building', Store.catalogName(d.centerId)] : null,
          ['calendar', UI.fmtDate(d.date)]
        ])
      ]),
      el('span', { class: 'f-item__chev', html: ico('chevronRight', 20) })
    ]);
  }

  function render() {
    var view = UI.$('#view');
    var now = new Date();

    // Saludo
    view.appendChild(el('div', { class: 'f-hello' }, [
      el('div', { class: 'f-hello__date', text: DOW_LONG[now.getDay()][0].toUpperCase() + DOW_LONG[now.getDay()].slice(1) + ', ' + now.getDate() + ' de ' + MONTHS_LONG[now.getMonth()] }),
      el('h1', { class: 'f-hello__title', text: greeting() + (firstName() ? ', ' + firstName() : '') }),
      el('div', { class: 'f-hello__plant', html: ico('building', 15) + '<span>' + esc(Campo.plantName()) + '</span>' })
    ]));

    // Acción principal
    view.appendChild(el('button', {
      class: 'f-cta', type: 'button', onclick: function () { Shell.go('forms', { seg: 'new' }); }
    }, [
      el('span', { class: 'f-cta__icon', html: ico('play', 26) }),
      el('span', { class: 'f-cta__text' }, [
        el('strong', { text: 'Nueva visita' }),
        el('span', { text: 'Elige un cuestionario y empieza la ronda' })
      ]),
      el('span', { class: 'f-cta__chev', html: ico('chevronRight', 22) })
    ]));

    // Cifras
    var devs = Store.query('deviations', function (d) { return d.status !== 'closed' && Campo.inPlant(d.centerId); });
    var overdue = Store.query('actions', function (a) {
      return a.status !== 'done' && a.dueDate && UI.relativeDays(a.dueDate) < 0 && Campo.inPlant(a.centerId);
    });
    var pendingActions = Store.query('actions', function (a) { return a.status !== 'done' && Campo.inPlant(a.centerId); });
    var due = Recurrence.upcoming().filter(function (u) { return Campo.inPlant(u.centerId) && u.daysUntil <= 7; });
    var monthKey = UI.monthKey(now);
    var monthVisits = Store.query('visits', function (v) {
      return v.status === 'completed' && Campo.inPlant(v.centerId) && UI.monthKey(v.date) === monthKey;
    });

    view.appendChild(el('div', { class: 'f-kpis' }, [
      kpi('Desviaciones abiertas', devs.length, devs.length ? 'danger' : 'ok', 'alert', function () { Shell.go('deviations'); }),
      kpi('Acciones vencidas', overdue.length, overdue.length ? 'danger' : 'ok', 'target', function () { Shell.go('actions', { seg: 'overdue' }); }),
      kpi('Rondas pendientes', due.length, due.length ? 'warn' : 'ok', 'calendar', function () { Shell.go('calendar'); }),
      kpi('Visitas este mes', monthVisits.length, 'navy', 'checkCircle', function () { Shell.go('forms', { seg: 'done' }); })
    ]));

    // Rondas que tocan
    view.appendChild(section('Toca hacer', link('Ver calendario', function () { Shell.go('calendar'); })));
    var list = el('div', { class: 'f-list' });
    if (due.length) due.slice(0, 5).forEach(function (u) { list.appendChild(dueRow(u)); });
    else list.appendChild(el('div', { class: 'f-note' }, [
      el('span', { html: ico('checkCircle', 20) }),
      el('span', { text: Recurrence.recurringForms().length
        ? 'No hay rondas pendientes esta semana' + (Campo.plant() ? ' en ' + Campo.plantName() : '') + '.'
        : 'Aún no hay cuestionarios con periodicidad. Se configuran en la APP principal.' })
    ]));
    view.appendChild(list);

    // Borradores
    var drafts = Store.query('visits', function (v) {
      return v.status !== 'completed' && (!v.centerId || Campo.inPlant(v.centerId));
    }).sort(function (a, b) { return (b.updatedAt || '') < (a.updatedAt || '') ? -1 : 1; });
    if (drafts.length) {
      view.appendChild(section('Visitas sin terminar', link('Ver todas', function () { Shell.go('forms', { seg: 'drafts' }); })));
      var dl = el('div', { class: 'f-list' });
      drafts.slice(0, 3).forEach(function (v) { dl.appendChild(draftRow(v)); });
      view.appendChild(dl);
    }

    // Desviaciones recientes
    if (devs.length) {
      view.appendChild(section('Desviaciones abiertas', link('Ver todas', function () { Shell.go('deviations'); })));
      var rl = el('div', { class: 'f-list' });
      devs.sort(function (a, b) { return (b.createdAt || '') < (a.createdAt || '') ? -1 : 1; })
        .slice(0, 3).forEach(function (d) { rl.appendChild(devRow(d)); });
      view.appendChild(rl);
    }

    if (!Store.all('forms').length) {
      view.appendChild(Campo.empty('clipboard', 'Todavía no hay cuestionarios',
        Sync.status().status === 'offline'
          ? 'Conéctate a internet para descargar los cuestionarios del departamento.'
          : 'Los cuestionarios se crean en la APP principal y aparecen aquí al sincronizar.'));
    }
  }

  Views.home = { render: render };
})(window);
