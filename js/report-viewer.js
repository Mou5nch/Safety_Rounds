/* ==========================================================================
   Safety Rounds — Visor de informes compartidos (/r/:id)
   Página pública de solo lectura: pinta la instantánea que guardó el
   servidor en /api/share/:id. No usa IndexedDB porque quien la abre no
   tiene los datos del dispositivo que generó la visita.
   ========================================================================== */
(function () {
  'use strict';

  var el = UI.el, esc = UI.esc;
  var STRUCTURAL = { title: true, subtitle: true, paragraph: true, divider: true };

  function shareId() {
    var m = /\/r\/([^/?#]+)/.exec(location.pathname);
    return m ? m[1] : null;
  }

  function load() {
    var id = shareId();
    var wrap = UI.$('#reportWrap');
    if (!id) return showError(wrap, 'Enlace incompleto', 'Falta el identificador del informe en la URL.');

    fetch('/api/share/' + encodeURIComponent(id))
      .then(function (res) {
        if (res.status === 404) throw new Error('notfound');
        if (!res.ok) throw new Error('http');
        return res.json();
      })
      .then(function (data) { render(wrap, data); })
      .catch(function (e) {
        if (e && e.message === 'notfound') {
          showError(wrap, 'Informe no disponible', 'Este enlace no existe o ha sido revocado por quien lo compartió.');
        } else {
          showError(wrap, 'No se ha podido cargar', 'Comprueba tu conexión e inténtalo de nuevo.');
        }
      });
  }

  function showError(wrap, title, text) {
    UI.clear(wrap);
    wrap.appendChild(el('div', { class: 'report-error' }, [
      el('div', { html: ico('alertCircle', 34) }),
      el('h1', { text: title }),
      el('p', { text: text })
    ]));
  }

  function render(wrap, data) {
    if (data.type === 'visit') return renderVisit(wrap, data);
    showError(wrap, 'Tipo de informe no soportado', 'Este enlace apunta a un contenido que esta versión no sabe mostrar.');
  }

  function renderVisit(wrap, data) {
    var p = data.payload || {};
    var v = p.visit || {};
    var form = p.form || { fields: [] };
    var answers = p.answers || {};
    var branding = p.branding || {};
    var s = v.score || { ok: 0, ko: 0, pct: 0, total: 0 };
    var col = UI.scoreColor(s.pct);

    UI.clear(wrap);
    document.title = (v.code || 'Informe') + ' — ' + (branding.appName || 'Safety Rounds');

    wrap.appendChild(el('header', { class: 'report-head' }, [
      el('div', { class: 'report-head__brand' }, [
        el('div', { class: 'report-head__app', text: branding.appName || 'Safety Rounds' }),
        branding.company ? el('div', { class: 'report-head__company', text: branding.company }) : null
      ]),
      el('button', {
        class: 'btn btn--ghost btn--sm', html: ico('print', 16) + '<span>Imprimir</span>',
        onclick: function () { window.print(); }
      })
    ]));

    var card = el('div', { class: 'card report-card' });
    var body = el('div', { class: 'card__body' });

    body.appendChild(el('div', { class: 'report-title-row' }, [
      el('div', {}, [
        el('h1', { class: 'report-title', text: (v.code || '') + ' · ' + (form.name || 'Cuestionario') }),
        el('div', { class: 'report-meta' }, metaChips(v))
      ]),
      s.total ? el('div', {
        class: 'report-score', style: { background: col.bg, color: col.fg }, text: UI.pct(s.pct)
      }) : null
    ]));

    if (s.total) {
      body.appendChild(el('div', { class: 'report-summary' }, [
        summaryStat('Puntos evaluados', UI.num(s.total)),
        summaryStat('Correctos', UI.num(s.total - s.ko)),
        summaryStat('Desviaciones', UI.num(s.ko))
      ]));
    }

    card.appendChild(body);
    wrap.appendChild(card);

    var answersCard = el('div', { class: 'card report-card' });
    var answersBody = el('div', { class: 'card__body report-answers' });
    (form.fields || []).forEach(function (f) {
      answersBody.appendChild(renderField(f, answers[f.id]));
    });
    answersCard.appendChild(answersBody);
    wrap.appendChild(answersCard);

    wrap.appendChild(el('footer', { class: 'report-foot' }, [
      el('span', { text: 'Generado con ' + (branding.appName || 'Safety Rounds') + (data.created_at ? ' · ' + UI.fmtDateTime(data.created_at) : '') })
    ]));
  }

  function metaChips(v) {
    var parts = [
      v.date ? [ico('calendar', 13), UI.fmtDate(v.date)] : null,
      v.inspector ? [ico('user', 13), v.inspector] : null,
      v.centerName ? [ico('building', 13), v.centerName] : null,
      v.areaName ? [ico('mapPin', 13), v.areaName] : null
    ].filter(Boolean);
    return parts.map(function (p) {
      return el('span', { class: 'report-meta__item', html: p[0] + '<span>' + esc(p[1]) + '</span>' });
    });
  }

  function summaryStat(label, value) {
    return el('div', { class: 'report-stat' }, [
      el('div', { class: 'report-stat__value', text: value }),
      el('div', { class: 'report-stat__label', text: label })
    ]);
  }

  /* ---------- Campos ---------- */

  function renderField(f, a) {
    if (STRUCTURAL[f.type]) return renderStructural(f);

    var block = el('div', { class: 'report-field' });
    block.appendChild(el('div', { class: 'report-field__label', text: f.label || '' }));
    block.appendChild(renderAnswer(f, a));
    return block;
  }

  function renderStructural(f) {
    if (f.type === 'divider') return el('hr', { class: 'report-divider' });
    if (f.type === 'paragraph') return el('p', { class: 'report-paragraph', text: f.label || '' });
    var tag = f.type === 'title' ? 'h2' : 'h3';
    return el(tag, { class: 'report-section-' + f.type, text: f.label || '' });
  }

  function empty(text) {
    return el('div', { class: 'report-empty', text: text || 'Sin contestar' });
  }

  function renderAnswer(f, a) {
    if (f.type === 'checkitem') return renderCheckitem(a);
    if (f.type === 'listpick') return renderListpick(a);
    if (f.type === 'signature') return renderSignature(a);
    if (f.type === 'photo' || f.type === 'file') return renderMedia(a);

    if (a === undefined || a === null || a === '') return empty();
    if (Array.isArray(a)) {
      if (!a.length) return empty();
      var ul = el('ul', { class: 'report-list' });
      a.forEach(function (v) { ul.appendChild(el('li', { text: String(v) })); });
      return ul;
    }
    if (f.type === 'date') return el('div', { class: 'report-value', text: UI.fmtDate(a) });
    return el('div', { class: 'report-value', text: String(a) + (f.unit ? ' ' + f.unit : '') });
  }

  function renderCheckitem(a) {
    var wrapEl = el('div');
    if (!a || !a.value) { wrapEl.appendChild(empty()); return wrapEl; }
    var MAP = {
      ok: { label: 'CORRECTO', cls: 'tag--ok' },
      ko: { label: 'NO CORRECTO', cls: 'tag--danger' },
      na: { label: 'NO APLICA', cls: 'tag' }
    };
    var m = MAP[a.value] || MAP.na;
    wrapEl.appendChild(el('span', { class: 'tag ' + m.cls, text: m.label }));
    if (a.value === 'ko' && a.deviation) wrapEl.appendChild(renderDeviation(a.deviation));
    return wrapEl;
  }

  function renderDeviation(d) {
    var box = el('div', { class: 'report-deviation' });
    box.appendChild(el('div', { class: 'report-deviation__title', html: ico('alert', 14) + '<span>Desviación detectada</span>' }));
    if (d.description) box.appendChild(el('p', { class: 'report-deviation__desc', text: d.description }));

    var tags = el('div', { class: 'report-deviation__tags' });
    if (d.severityName) tags.appendChild(el('span', {
      class: 'tag', style: { background: (d.severityColor || '#E05C5C') + '22', color: d.severityColor || '#E05C5C' }, text: d.severityName
    }));
    if (d.categoryName) tags.appendChild(el('span', { class: 'tag tag--navy', text: d.categoryName }));
    if (tags.childNodes.length) box.appendChild(tags);

    if (d.action && (d.action.title || d.action.responsible || d.action.dueDate)) {
      var act = el('div', { class: 'report-action' });
      act.appendChild(el('div', { class: 'report-action__title', html: ico('flag', 13) + '<span>Acción correctora</span>' }));
      if (d.action.title) act.appendChild(el('div', { text: d.action.title }));
      var meta = [];
      if (d.action.responsible) meta.push('Responsable: ' + d.action.responsible);
      if (d.action.dueDate) meta.push('Fecha límite: ' + UI.fmtDate(d.action.dueDate));
      if (meta.length) act.appendChild(el('div', { class: 'report-action__meta', text: meta.join('   ·   ') }));
      box.appendChild(act);
    }

    var photos = (d.photos || []).filter(function (p) { return p && (p.kind === 'image' || p.data || typeof p === 'string'); });
    if (photos.length) box.appendChild(photoGrid(photos));

    return box;
  }

  function renderListpick(a) {
    if (!a || !a.items || !a.items.length) return empty();
    var box = el('div');
    a.items.forEach(function (it) {
      var extra = [it.role, it.email, it.phone].filter(Boolean).join(' · ');
      box.appendChild(el('div', { class: 'report-listpick-item' }, [
        el('div', { text: it.name }),
        extra ? el('div', { class: 'report-listpick-item__extra', text: extra }) : null
      ]));
    });
    if (a.childName) box.appendChild(el('div', { class: 'report-listpick-item__extra', text: 'Subtipología: ' + a.childName }));
    return box;
  }

  function renderSignature(a) {
    if (!a) return empty('Sin firma');
    return el('img', { class: 'report-signature', src: a, alt: 'Firma' });
  }

  function renderMedia(a) {
    var items = Array.isArray(a) ? a : [];
    if (!items.length) return empty('Sin evidencias');
    return photoGrid(items);
  }

  function photoGrid(items) {
    var grid = el('div', { class: 'report-photo-grid' });
    items.forEach(function (p) {
      var src = typeof p === 'string' ? p : p.data;
      var isImage = typeof p === 'string' ? p.indexOf('data:image') === 0 : (p.kind === 'image' || (p.data || '').indexOf('data:image') === 0);
      if (isImage && src) {
        grid.appendChild(el('img', { class: 'report-photo', src: src, alt: '' }));
      } else {
        grid.appendChild(el('div', { class: 'report-file-chip', html: ico('paperclip', 14) + '<span>' + esc((p && p.name) || 'adjunto') + '</span>' }));
      }
    });
    return grid;
  }

  load();
})();
