/* ==========================================================================
   Safety Rounds · Campo — Núcleo
   Filtro de planta, hojas inferiores, visor de fotos y utilidades comunes a
   todas las pantallas de la WebApp de campo.
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el, esc = UI.esc;

  /* ======================================================================
     Planta (centro de trabajo) — filtro global
     ====================================================================== */

  var PLANT_KEY = 'sr:campo:plant';
  var plantId = '';
  try { plantId = localStorage.getItem(PLANT_KEY) || ''; } catch (e) {}
  var plantFns = [];

  function centers() { return Store.catalog('center'); }

  /** Planta elegida ('' = todas). Si la planta se eliminó, vuelve a «todas». */
  function plant() {
    if (plantId && !Store.get('catalogs', plantId)) plantId = '';
    return plantId;
  }

  function setPlant(id) {
    plantId = id || '';
    try { localStorage.setItem(PLANT_KEY, plantId); } catch (e) {}
    plantFns.forEach(function (fn) { try { fn(plantId); } catch (e) {} });
  }

  function onPlant(fn) { plantFns.push(fn); }

  function plantName() {
    var p = plant();
    return p ? Store.catalogName(p) : 'Todas las plantas';
  }

  /** ¿Entra un registro con este centro en el filtro actual? */
  function inPlant(centerId) {
    var p = plant();
    return !p || centerId === p;
  }

  /** Cifras de una planta (o del conjunto si centerId = '') para la hoja de selección. */
  function plantStats(centerId) {
    var match = function (c) { return !centerId || c === centerId; };
    var devs = Store.query('deviations', function (d) { return d.status !== 'closed' && match(d.centerId); }).length;
    var over = Store.query('actions', function (a) {
      return a.status !== 'done' && a.dueDate && UI.relativeDays(a.dueDate) < 0 && match(a.centerId);
    }).length;
    var visits = Recurrence.upcoming().filter(function (u) { return match(u.centerId) && u.daysUntil <= 0; }).length;
    return { deviations: devs, overdueActions: over, dueVisits: visits };
  }

  /* ======================================================================
     Hoja inferior (en tablet, panel lateral)
     ====================================================================== */

  var sheets = [];

  /* El botón «atrás» del móvil cierra la hoja en lugar de salir de la app. Para
     ello se añade UNA entrada de historial mientras haya alguna hoja abierta
     (compartida por todas): si se cerrara una y se abriera otra al instante —por
     ejemplo, de una acción a su desviación—, cada una con su propia entrada, el
     retroceso pendiente de la primera cerraría la segunda nada más abrirla. */
  function hasEntry() { try { return !!(history.state && history.state.srSheet); } catch (e) { return false; } }
  function pushEntry() { try { history.pushState({ srSheet: true }, ''); } catch (e) {} }

  window.addEventListener('popstate', function () {
    if (!sheets.length) return;               // retroceso provocado por nosotros al cerrar la última
    sheets[sheets.length - 1].requestClose(true);
  });

  /**
   * opts: { title, subtitle, body (Node), footer ([Node]), onClose, beforeClose, sticky }
   *   beforeClose() → true (cerrar) | false (no cerrar) | Promise<boolean>. Sirve para
   *                   preguntar «¿descartar los cambios?» antes de perder lo escrito.
   *   sticky        → un toque fuera de la hoja no la cierra (solo la ✕, Esc o «atrás»).
   * Devuelve { close, body, setFooter, setTitle }.
   */
  function sheet(opts) {
    var root = UI.$('#sheetRoot');
    var scrim = el('div', { class: 'sheet-root' });
    var panel = el('div', { class: 'sheet' + (opts.tall ? ' sheet--tall' : ''), role: 'dialog', 'aria-modal': 'true' });

    panel.appendChild(el('div', { class: 'sheet__grab' }));
    var head = el('div', { class: 'sheet__head' }, [
      el('div', { class: 'sheet__titles' }, [
        el('div', { class: 'sheet__title', text: opts.title || '' }),
        opts.subtitle ? el('div', { class: 'sheet__sub', text: opts.subtitle }) : null
      ]),
      el('button', { class: 'f-iconbtn f-iconbtn--dark', 'aria-label': 'Cerrar', html: ico('x', 20), onclick: function () { requestClose(false); } })
    ]);
    panel.appendChild(head);

    var body = el('div', { class: 'sheet__body' });
    if (opts.body) body.appendChild(opts.body);
    panel.appendChild(body);

    var foot = el('div', { class: 'sheet__foot' });
    panel.appendChild(foot);
    function setFooter(nodes) {
      UI.clear(foot);
      (nodes || []).forEach(function (n) { if (n) foot.appendChild(n); });
      foot.hidden = !foot.childNodes.length;
    }
    setFooter(opts.footer);

    scrim.appendChild(panel);
    scrim.addEventListener('mousedown', function (e) { if (e.target === scrim && !opts.sticky) requestClose(false); });
    root.appendChild(scrim);
    document.body.classList.add('has-sheet');

    if (!hasEntry()) pushEntry();
    var closed = false;
    var api = { close: close, requestClose: requestClose, body: body, panel: panel, setFooter: setFooter, setTitle: function (t) { head.querySelector('.sheet__title').textContent = t; } };

    function requestClose(fromPop) {
      if (closed) return;
      if (opts.beforeClose) {
        var r = opts.beforeClose();
        if (r === false || (r && typeof r.then === 'function')) {
          // El «atrás» ya consumió la entrada de historial: se repone para seguir abiertos
          if (fromPop === true) pushEntry();
          if (r && typeof r.then === 'function') r.then(function (ok) { if (ok) close(false); });
          return;
        }
      }
      close(fromPop);
    }
    function close(fromPop) {
      if (closed) return;
      closed = true;
      scrim.classList.add('is-out');
      setTimeout(function () { if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }, 180);
      sheets = sheets.filter(function (s) { return s !== api; });
      if (!sheets.length) document.body.classList.remove('has-sheet');

      if (fromPop === true) {
        // Cerrada con «atrás»: la entrada ya se gastó; si quedan hojas debajo, se repone
        if (sheets.length) pushEntry();
      } else {
        // Cerrada desde la pantalla: la entrada se retira solo cuando ya no queda
        // ninguna hoja. Se espera un instante por si otra se abre a continuación.
        setTimeout(function () {
          if (!sheets.length && hasEntry()) { try { history.back(); } catch (e) {} }
        }, 40);
      }
      if (opts.onClose) opts.onClose();
    }

    sheets.push(api);
    return api;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sheets.length) sheets[sheets.length - 1].requestClose(false);
  });

  /* ======================================================================
     Visor de fotos
     ====================================================================== */

  function lightbox(srcList, start) {
    var list = Array.isArray(srcList) ? srcList : [srcList];
    var i = start || 0;
    var img = el('img', { class: 'lightbox__img', alt: 'Evidencia' });
    var count = el('div', { class: 'lightbox__count' });
    var wrap = el('div', { class: 'lightbox' }, [
      img,
      el('button', { class: 'lightbox__close', 'aria-label': 'Cerrar', html: ico('x', 22), onclick: close }),
      list.length > 1 ? el('button', { class: 'lightbox__nav lightbox__nav--prev', 'aria-label': 'Anterior', html: ico('chevronLeft', 26), onclick: function (e) { e.stopPropagation(); go(-1); } }) : null,
      list.length > 1 ? el('button', { class: 'lightbox__nav lightbox__nav--next', 'aria-label': 'Siguiente', html: ico('chevronRight', 26), onclick: function (e) { e.stopPropagation(); go(1); } }) : null,
      count
    ]);
    function paint() { img.src = list[i]; count.textContent = list.length > 1 ? (i + 1) + ' / ' + list.length : ''; }
    function go(d) { i = (i + d + list.length) % list.length; paint(); }
    function close() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); }
    wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target === img) close(); });
    document.addEventListener('keydown', key);
    paint();
    document.body.appendChild(wrap);
  }

  /* ======================================================================
     Utilidades de presentación
     ====================================================================== */

  function tag(text, kind, icon) {
    return el('span', { class: 'tag' + (kind ? ' tag--' + kind : ''), html: (icon ? ico(icon, 12) : '') + esc(text) });
  }

  function colorTag(id) {
    if (!id) return null;
    var c = Store.catalogColor(id);
    return el('span', { class: 'tag', style: { background: UI.withAlpha(c, .14), color: c }, text: Store.catalogName(id) });
  }

  /** Estado de un plazo: { label, kind } con kind = danger | warn | '' */
  function dueInfo(dateStr, done) {
    if (!dateStr) return { label: 'Sin fecha límite', kind: '' };
    if (done) return { label: UI.fmtDate(dateStr), kind: '' };
    var d = UI.relativeDays(dateStr);
    if (d < 0) return { label: 'Vencida hace ' + Math.abs(d) + (Math.abs(d) === 1 ? ' día' : ' días'), kind: 'danger' };
    if (d === 0) return { label: 'Vence hoy', kind: 'warn' };
    if (d === 1) return { label: 'Vence mañana', kind: 'warn' };
    if (d <= 7) return { label: 'Vence en ' + d + ' días', kind: 'warn' };
    return { label: 'Vence el ' + UI.fmtDate(dateStr), kind: '' };
  }

  function metaLine(items) {
    return el('div', { class: 'f-meta' }, items.filter(Boolean).map(function (it) {
      return el('span', { class: 'f-meta__item', html: ico(it[0], 13) + '<span>' + esc(it[1]) + '</span>' });
    }));
  }

  function empty(icon, title, text, action) {
    return el('div', { class: 'f-empty' }, [
      el('div', { class: 'f-empty__icon', html: ico(icon, 30) }),
      el('div', { class: 'f-empty__title', text: title }),
      text ? el('div', { class: 'f-empty__text', text: text }) : null,
      action || null
    ]);
  }

  /** Segmentado (pestañas pequeñas): items = [{ value, label, count }] */
  function segmented(items, value, onChange) {
    var box = el('div', { class: 'f-seg', role: 'tablist' });
    items.forEach(function (it) {
      box.appendChild(el('button', {
        class: 'f-seg__btn' + (it.value === value ? ' is-on' : ''), type: 'button', role: 'tab',
        'aria-selected': it.value === value ? 'true' : 'false',
        onclick: function () { onChange(it.value); }
      }, [
        el('span', { text: it.label }),
        it.count != null && it.count !== '' ? el('span', { class: 'f-seg__count', text: String(it.count) }) : null
      ]));
    });
    return box;
  }

  /** Chips de filtro desplazables en horizontal. */
  function chips(items, value, onChange) {
    var box = el('div', { class: 'f-chips' });
    items.forEach(function (it) {
      box.appendChild(el('button', {
        class: 'f-chip' + (it.value === value ? ' is-on' : ''), type: 'button',
        onclick: function () { onChange(it.value); }
      }, [
        it.color ? el('span', { class: 'f-chip__dot', style: { background: it.color } }) : null,
        el('span', { text: it.label })
      ]));
    });
    return box;
  }

  function searchBox(value, placeholder, onChange) {
    var input = el('input', {
      class: 'input f-search__input', type: 'search', value: value || '', placeholder: placeholder || 'Buscar…',
      enterkeyhint: 'search', autocomplete: 'off', autocapitalize: 'off'
    });
    var timer;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var v = input.value;
      timer = setTimeout(function () { onChange(v); }, 260);
    });
    return el('div', { class: 'f-search' }, [el('span', { class: 'f-search__icon', html: ico('search', 18) }), input]);
  }

  /* ======================================================================
     Tarjetas o lista
     ----------------------------------------------------------------------
     Cada apartado con tarjetas puede verse también en lista. La elección se
     recuerda por apartado en este dispositivo. En una pantalla ancha la lista
     es una tabla con cabecera; en el móvil son filas compactas de dos líneas.
     ====================================================================== */

  function viewMode(key) {
    try { return localStorage.getItem('sr:campo:view:' + key) === 'list' ? 'list' : 'cards'; } catch (e) { return 'cards'; }
  }

  function setViewMode(key, mode) {
    try { localStorage.setItem('sr:campo:view:' + key, mode); } catch (e) {}
  }

  function viewToggle(key) {
    var cur = viewMode(key);
    function btn(mode, icon, label) {
      return el('button', {
        class: 'f-viewtoggle__btn' + (cur === mode ? ' is-on' : ''), type: 'button',
        'aria-label': label, 'aria-pressed': cur === mode ? 'true' : 'false', title: label,
        html: ico(icon, 20),
        onclick: function () { if (cur !== mode) { setViewMode(key, mode); Shell.render(); } }
      });
    }
    return el('div', { class: 'f-viewtoggle', role: 'group', 'aria-label': 'Forma de mostrar' }, [
      btn('cards', 'grid', 'Ver en tarjetas'), btn('list', 'list', 'Ver en lista')
    ]);
  }

  /** Fila con el buscador (si se indica) y el conmutador tarjetas/lista. */
  function filterRow(key, search) {
    return el('div', { class: 'f-filterrow' + (search ? '' : ' f-filterrow--end') }, [search || null, viewToggle(key)]);
  }

  /**
   * Contenedor de lista. cols: plantilla de columnas para pantalla ancha
   * (lead · principal · …celdas… · acciones); labels: cabecera de esas columnas.
   */
  function listBox(cols, labels) {
    var box = el('div', { class: 'f-table' });
    box.style.setProperty('--cols', cols);    // UI.el no sabe asignar variables CSS
    box.appendChild(el('div', { class: 'f-table__head', 'aria-hidden': 'true' }, labels.map(function (l) { return el('span', { text: l }); })));
    return box;
  }

  /**
   * Fila de lista.
   *   color   color de la franja lateral
   *   title, sub   texto principal y secundario (una línea cada uno)
   *   meta    [Node|string] — se ve debajo del título en el móvil
   *   cells   [Node|string] — columnas de la tabla en pantalla ancha
   *   end     [Node] — acciones rápidas (los clics no abren la ficha)
   */
  function listRow(o) {
    var row = el('div', {
      class: 'f-lrow' + (o.cls ? ' ' + o.cls : ''), role: 'button', tabindex: '0'
    });
    if (o.color) row.style.setProperty('--lead', o.color);
    row.addEventListener('click', function () { if (o.onclick) o.onclick(); });
    row.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === row) { e.preventDefault(); if (o.onclick) o.onclick(); }
    });

    row.appendChild(el('span', { class: 'f-lrow__lead' }));
    row.appendChild(el('div', { class: 'f-lrow__main' }, [
      el('span', { class: 'f-lrow__title', text: o.title || '' }),
      o.sub ? el('span', { class: 'f-lrow__sub', text: o.sub }) : null,
      (o.meta && o.meta.length) ? el('span', { class: 'f-lrow__meta' }, o.meta.filter(Boolean).map(function (m) {
        // Un nodo del DOM solo puede tener un padre: el mismo avance (p. ej. la etiqueta
        // de estado) se usa en la línea del móvil y en la columna de la tabla, así que
        // aquí va una copia.
        return typeof m === 'string' ? el('span', { class: 'f-lrow__m', text: m }) : m.cloneNode(true);
      })) : null
    ]));
    (o.cells || []).forEach(function (c) {
      row.appendChild(el('div', { class: 'f-lrow__cell' }, c === null || c === undefined || c === '' ? '—' : (typeof c === 'string' ? document.createTextNode(c) : c)));
    });
    var end = el('div', { class: 'f-lrow__end' }, (o.end || []).filter(Boolean));
    end.addEventListener('click', function (e) { e.stopPropagation(); });
    row.appendChild(end);
    return row;
  }

  /** Botón redondo de una fila (cerrar, reabrir, borrar…). */
  function rowButton(icon, label, onclick, kind) {
    return el('button', {
      class: 'f-rowbtn' + (kind ? ' f-rowbtn--' + kind : ''), type: 'button', 'aria-label': label, title: label,
      html: ico(icon, 20), onclick: function (e) { e.stopPropagation(); onclick(e); }
    });
  }

  /** Botón de añadir foto (cámara en móvil) → onAdd(dataURL) */
  function photoButton(onAdd, label) {
    var input = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    input.setAttribute('capture', 'environment');
    input.addEventListener('change', function () {
      var f = input.files[0];
      input.value = '';
      if (!f) return;
      Store.compressImage(f).then(onAdd).catch(function () { UI.toast('No se ha podido leer la foto.', 'err'); });
    });
    return el('div', { style: { display: 'contents' } }, [
      input,
      el('button', {
        class: 'media-add', type: 'button', onclick: function () { input.click(); },
        html: ico('camera', 22) + '<span>' + (label || 'Foto') + '</span>'
      })
    ]);
  }

  /** Iniciales para el avatar. */
  function initials(name) {
    var parts = String(name || '?').replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
    return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function auth() {
    try { return JSON.parse(localStorage.getItem('sr:auth') || 'null') || {}; } catch (e) { return {}; }
  }

  global.Campo = {
    plant: plant, setPlant: setPlant, onPlant: onPlant, plantName: plantName,
    inPlant: inPlant, plantStats: plantStats, centers: centers,
    sheet: sheet, lightbox: lightbox,
    tag: tag, colorTag: colorTag, dueInfo: dueInfo, metaLine: metaLine, empty: empty,
    segmented: segmented, chips: chips, searchBox: searchBox, photoButton: photoButton,
    viewMode: viewMode, viewToggle: viewToggle, filterRow: filterRow,
    listBox: listBox, listRow: listRow, rowButton: rowButton,
    initials: initials, auth: auth
  };
})(window);
