/* ==========================================================================
   Safety Rounds — Enlaces compartidos
   Construye una instantánea autocontenida de la visita (con los nombres de
   tipología ya resueltos, porque quien abra el enlace no tiene esta
   IndexedDB) y la sube al servidor para obtener una URL pública de solo
   lectura.
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el;

  function resolveDeviation(d) {
    if (!d) return null;
    return {
      description: d.description || '',
      severityName: d.severityId ? Store.catalogName(d.severityId) : '',
      severityColor: d.severityId ? Store.catalogColor(d.severityId) : '',
      categoryName: d.categoryId ? Store.catalogName(d.categoryId) : '',
      photos: d.photos || [],
      action: d.action || null
    };
  }

  function resolveAnswer(f, raw) {
    if (raw === undefined || raw === null) return null;

    if (f.type === 'checkitem') {
      var out = { value: raw.value };
      if (raw.value === 'ko' && raw.deviation) out.deviation = resolveDeviation(raw.deviation);
      return out;
    }

    if (f.type === 'listpick') {
      var items = (raw.ids || []).map(function (id) {
        var c = Store.get('catalogs', id);
        return c ? { name: c.name, role: c.role || '', email: c.email || '', phone: c.phone || '' } : null;
      }).filter(Boolean);
      return { items: items, childName: raw.childId ? Store.catalogName(raw.childId) : null };
    }

    // signature (dataURL), photo/file (array), texto, número, fecha, opciones…
    return raw;
  }

  function buildVisitPayload(visit) {
    var form = visit.formSnapshot || Store.get('forms', visit.formId) || { fields: [], name: visit.formName };
    var settings = Store.settings();
    var answers = {};
    (form.fields || []).forEach(function (f) {
      answers[f.id] = resolveAnswer(f, (visit.answers || {})[f.id]);
    });

    return {
      visit: {
        code: visit.code,
        date: visit.date,
        inspector: visit.inspector || '',
        centerName: visit.centerId ? Store.catalogName(visit.centerId) : '',
        areaName: visit.areaId ? Store.catalogName(visit.areaId) : '',
        status: visit.status,
        score: visit.score || { ok: 0, ko: 0, pct: 0, total: 0 }
      },
      form: { name: form.name || visit.formName || 'Cuestionario', fields: form.fields || [] },
      answers: answers,
      branding: {
        appName: settings.appName || 'Safety Rounds',
        company: settings.company || '',
        department: settings.department || ''
      },
      generatedAt: Store.nowISO()
    };
  }

  function shareVisit(v) {
    if (!v || v.status !== 'completed') return;
    var payload = buildVisitPayload(v);
    var title = v.code + ' · ' + (v.formName || 'Inspección');

    fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type: 'visit', title: title, payload: payload })
    }).then(function (res) {
      if (res.status === 401) throw new Error('unauth');
      if (!res.ok) throw new Error('http');
      return res.json();
    }).then(function (data) {
      showLinkModal(title, location.origin + data.url);
    }).catch(function (e) {
      if (e && e.message === 'unauth') {
        UI.toast('Inicia sesión para generar enlaces compartidos.', 'err');
      } else {
        UI.toast('No se ha podido generar el enlace. Comprueba tu conexión.', 'err');
      }
    });
  }

  function showLinkModal(title, url) {
    var input = el('input', { class: 'input', value: url, readonly: true, onclick: function () { input.select(); } });
    var body = el('div', {}, [
      UI.field('Enlace del informe', input, 'Cualquiera con este enlace puede ver la visita, aunque no tenga la aplicación instalada.')
    ]);

    UI.modal({
      title: 'Enlace generado',
      subtitle: title,
      icon: 'send',
      body: body,
      buttons: [
        {
          label: 'Copiar enlace', icon: 'copy', kind: 'ghost',
          onClick: function () {
            copyToClipboard(url);
            UI.toast('Enlace copiado.');
            return false;
          }
        },
        {
          label: 'Abrir', icon: 'send', kind: 'primary',
          onClick: function () { window.open(url, '_blank'); return false; }
        }
      ]
    });
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { legacyCopy(text); });
    } else {
      legacyCopy(text);
    }
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* sin efecto */ }
    document.body.removeChild(ta);
  }

  global.Share = {
    visit: shareVisit,
    buildVisitPayload: buildVisitPayload
  };
})(window);
