/* ==========================================================================
   Safety Rounds — Utilidades de interfaz
   DOM, modales, toasts, formato y exportaciones.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------- DOM ---------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      });
    }
    (Array.isArray(children) ? children : children != null ? [children] : []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return node;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- Toasts ---------- */

  function toast(msg, kind) {
    var root = $('#toasts');
    if (!root) return;
    var icon = kind === 'err' ? 'alertCircle' : kind === 'info' ? 'info' : 'checkCircle';
    var t = el('div', { class: 'toast toast--' + (kind || 'ok') }, [
      el('span', { html: ico(icon, 18) }),
      el('span', { text: msg })
    ]);
    root.appendChild(t);
    setTimeout(function () {
      t.classList.add('is-out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 240);
    }, kind === 'err' ? 5200 : 3000);
  }

  /* ---------- Modales ---------- */

  var openModals = [];

  function modal(opts) {
    var overlay = el('div', { class: 'overlay' });
    var box = el('div', { class: 'modal' + (opts.size ? ' modal--' + opts.size : '') });

    var head = el('div', { class: 'modal__head' });
    if (opts.icon) {
      head.appendChild(el('div', {
        class: 'modal__icon modal__icon--' + (opts.iconKind || 'navy'),
        html: ico(opts.icon, 21)
      }));
    }
    head.appendChild(el('div', {}, [
      el('div', { class: 'modal__title', text: opts.title || '' }),
      opts.subtitle ? el('div', { class: 'modal__sub', text: opts.subtitle }) : null
    ]));
    head.appendChild(el('button', {
      class: 'modal__close', 'aria-label': 'Cerrar', html: ico('x', 18),
      onclick: function () { close(); }
    }));
    box.appendChild(head);

    var body = el('div', { class: 'modal__body' });
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    box.appendChild(body);

    var foot = el('div', { class: 'modal__foot' + (opts.footSplit ? ' modal__foot--split' : '') });
    (opts.buttons || []).forEach(function (b) {
      if (!b) return;
      foot.appendChild(el('button', {
        class: 'btn btn--' + (b.kind || 'ghost'),
        html: (b.icon ? ico(b.icon, 17) : '') + '<span>' + esc(b.label) + '</span>',
        onclick: function () { if (!b.onClick || b.onClick(api) !== false) close(); }
      }));
    });
    if (foot.childNodes.length) box.appendChild(foot);

    overlay.appendChild(box);
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay && opts.dismissible !== false) close();
    });
    $('#modalRoot').appendChild(overlay);
    openModals.push(close);

    function close() {
      if (!overlay.parentNode) return;
      overlay.parentNode.removeChild(overlay);
      openModals = openModals.filter(function (f) { return f !== close; });
      if (opts.onClose) opts.onClose();
    }

    var api = { close: close, body: body, overlay: overlay, foot: foot };

    // Foco en el primer control útil
    setTimeout(function () {
      var f = box.querySelector('input:not([type=hidden]), textarea, select');
      if (f && !('ontouchstart' in window)) f.focus();
    }, 60);

    return api;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openModals.length) openModals[openModals.length - 1]();
  });

  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var settled = false;
      modal({
        title: opts.title,
        subtitle: opts.text,
        icon: opts.icon || 'alert',
        iconKind: opts.danger === false ? 'navy' : 'danger',
        buttons: [
          { label: opts.cancelLabel || 'Cancelar', kind: 'quiet', onClick: function () { settled = true; resolve(false); } },
          {
            label: opts.confirmLabel || 'Eliminar',
            kind: opts.danger === false ? 'navy' : 'primary',
            icon: opts.confirmIcon,
            onClick: function () { settled = true; resolve(true); }
          }
        ],
        onClose: function () { if (!settled) resolve(false); }
      });
    });
  }

  function promptDialog(opts) {
    return new Promise(function (resolve) {
      var settled = false;
      var input = el('input', {
        class: 'input', value: opts.value || '', placeholder: opts.placeholder || '',
        maxlength: opts.maxlength || 120
      });
      var body = el('div', { class: 'field', style: { paddingBottom: '4px' } }, [
        opts.label ? el('label', { class: 'label', text: opts.label }) : null,
        input
      ]);
      var m = modal({
        title: opts.title,
        subtitle: opts.text,
        body: body,
        buttons: [
          { label: 'Cancelar', kind: 'quiet', onClick: function () { settled = true; resolve(null); } },
          {
            label: opts.confirmLabel || 'Guardar', kind: 'primary',
            onClick: function () {
              var v = input.value.trim();
              if (!v) { input.focus(); return false; }
              settled = true; resolve(v);
            }
          }
        ],
        onClose: function () { if (!settled) resolve(null); }
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var v = input.value.trim();
          if (v) { settled = true; resolve(v); m.close(); }
        }
      });
    });
  }

  /* ---------- Formato ---------- */

  var MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function toDate(v) {
    if (!v) return null;
    var d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtDate(v) {
    var d = toDate(v);
    if (!d) return '—';
    return pad(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function fmtDateTime(v) {
    var d = toDate(v);
    if (!d) return '—';
    return fmtDate(d) + ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function fmtDateInput(v) {
    var d = toDate(v) || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function monthKey(v) {
    var d = toDate(v);
    if (!d) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  function monthLabel(key) {
    var p = key.split('-');
    return MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0].slice(2);
  }

  function monthLabelLong(key) {
    var p = key.split('-');
    return MONTHS_LONG[parseInt(p[1], 10) - 1] + ' de ' + p[0];
  }

  function relativeDays(v) {
    var d = toDate(v);
    if (!d) return null;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var target = new Date(d); target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }

  /* ======================================================================
     Formato numérico (es-ES)
     ----------------------------------------------------------------------
     Los números se guardan siempre en crudo y solo se formatean al pintarlos.
     Punto para los millares, coma para los decimales, y espacio duro entre la
     cifra y el símbolo para que nunca se separen al final de una línea.
     ====================================================================== */

  var NBSP = ' ';
  var LOCALE = 'es-ES';

  var nf0, nf1;
  try {
    nf0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
    nf1 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  } catch (e) {
    nf0 = { format: function (n) { return String(Math.round(n)); } };
    nf1 = { format: function (n) { return String(n); } };
  }

  /** Entero con separador de millares: 1.234 */
  function num(n) {
    n = Number(n);
    if (!isFinite(n)) return '0';
    return nf0.format(n);
  }

  /** Número con los decimales indicados: dec(2.5, 1) → "2,5" */
  function dec(n, digits) {
    n = Number(n);
    if (!isFinite(n)) return '0';
    if (digits === 1) return nf1.format(n);
    try {
      return new Intl.NumberFormat(LOCALE, {
        minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0
      }).format(n);
    } catch (e) { return String(n); }
  }

  /** Porcentaje con espacio duro: 74 % */
  function pct(n, digits) {
    return (digits ? dec(n, digits) : num(n)) + NBSP + '%';
  }

  /** Cifra + unidad con espacio duro: 82 dB */
  function unit(n, symbol, digits) {
    var v = digits ? dec(n, digits) : num(n);
    return symbol ? v + NBSP + symbol : v;
  }

  /* ---------- Descargas ---------- */

  function download(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 800);
  }

  function downloadText(filename, text, type) {
    download(filename, new Blob(['﻿' + text], { type: (type || 'text/plain') + ';charset=utf-8' }));
  }

  /** CSV con separador ';' — el que espera Excel en configuración regional española. */
  function toCSV(rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        var s = c === null || c === undefined ? '' : String(c);
        return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(';');
    }).join('\r\n');
  }

  function downloadCSV(filename, rows) {
    downloadText(filename, toCSV(rows), 'text/csv');
    toast('Archivo ' + filename + ' descargado.');
  }

  function slug(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'archivo';
  }

  /* ---------- Color ---------- */

  function contrastOn(hex) {
    var c = String(hex || '').replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    if (isNaN(r)) return '#fff';
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#141B3D' : '#FFFFFF';
  }

  function withAlpha(hex, a) {
    var c = String(hex || '#4356AE').replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    if (isNaN(r)) return 'rgba(67,86,174,' + a + ')';
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function scoreColor(pct) {
    if (pct >= 90) return { bg: 'var(--ok-wash)', fg: 'var(--ok)' };
    if (pct >= 70) return { bg: 'var(--warn-wash)', fg: 'var(--warn)' };
    return { bg: 'var(--coral-wash)', fg: 'var(--coral-dark)' };
  }

  /* ---------- Estado vacío ---------- */

  function empty(icon, title, text, action) {
    return el('div', { class: 'empty' }, [
      el('div', { class: 'empty__icon', html: ico(icon, 28) }),
      el('div', { class: 'empty__title', text: title }),
      el('div', { class: 'empty__text', text: text }),
      action || null
    ]);
  }

  function field(labelText, control, hint, required) {
    return el('div', { class: 'field' }, [
      labelText ? el('label', { class: 'label', html: esc(labelText) + (required ? '<span class="req">*</span>' : '') }) : null,
      control,
      hint ? el('div', { class: 'hint', text: hint }) : null
    ]);
  }

  function selectFrom(options, value, attrs) {
    var s = el('select', Object.assign({ class: 'select' }, attrs || {}));
    options.forEach(function (o) {
      s.appendChild(el('option', { value: o.value, selected: String(o.value) === String(value) }, o.label));
    });
    return s;
  }

  /* ---------- Exposición ---------- */

  global.UI = {
    $: $, $$: $$, el: el, esc: esc, clear: clear,
    toast: toast, modal: modal, confirm: confirmDialog, prompt: promptDialog,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime, fmtDateInput: fmtDateInput,
    monthKey: monthKey, monthLabel: monthLabel, monthLabelLong: monthLabelLong,
    relativeDays: relativeDays, toDate: toDate, plural: plural, pad: pad,
    download: download, downloadText: downloadText, downloadCSV: downloadCSV, toCSV: toCSV, slug: slug,
    num: num, dec: dec, pct: pct, unit: unit, NBSP: NBSP,
    contrastOn: contrastOn, withAlpha: withAlpha, scoreColor: scoreColor,
    empty: empty, field: field, selectFrom: selectFrom,
    MONTHS: MONTHS
  };
})(window);
