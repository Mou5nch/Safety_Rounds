/* ==========================================================================
   Safety Rounds — Informe PDF
   Maquetación propia sobre jsPDF: portada, datos de la visita, respuestas,
   desviaciones con fotografías, plan de acción y firmas.
   ========================================================================== */
(function (global) {
  'use strict';

  var NAVY = [30, 43, 111];
  var NAVY_MID = [46, 61, 138];
  var CORAL = [224, 92, 92];
  var GREEN = [23, 138, 107];
  var AMBER = [199, 122, 16];
  var INK = [20, 27, 61];
  var INK2 = [74, 83, 120];
  var INK3 = [122, 131, 163];
  var LINE = [226, 229, 240];
  var SURFACE = [243, 244, 248];

  var M = 15;            // margen
  var W = 210, H = 297;  // A4
  var CW = W - M * 2;    // ancho útil

  function available() {
    return !!(global.jspdf && global.jspdf.jsPDF);
  }

  // En el PDF no hay reflujo de línea, así que basta un espacio normal: el
  // espacio duro no siempre está bien mapeado en las fuentes base de jsPDF.
  function fmtPct(n) { return UI.num(n) + ' %'; }
  function fmtNum(n) { return UI.num(n); }

  /**
   * jsPDF necesita saber el formato del bitmap. Las fotos se comprimen a JPEG,
   * pero las firmas son PNG y un adjunto puede venir en otro formato, así que
   * se deduce del propio data URI en lugar de asumirlo.
   */
  function imgFormat(src) {
    var m = /^data:image\/([a-z+]+)/i.exec(String(src || ''));
    var t = m ? m[1].toUpperCase() : 'JPEG';
    if (t === 'JPG') t = 'JPEG';
    return t === 'PNG' || t === 'JPEG' || t === 'WEBP' ? t : 'JPEG';
  }

  /* ======================================================================
     Construcción del documento
     ====================================================================== */

  function build(visit) {
    var doc = new global.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    var settings = Store.settings();
    var form = visit.formSnapshot || Store.get('forms', visit.formId) || { fields: [], name: visit.formName };
    var y = 0;
    var page = 1;

    /* ---------- Primitivas ---------- */

    // El estado tipográfico se guarda aparte porque al insertar una página se
    // pinta la cabecera, que cambia fuente y color a mitad de un bloque.
    var fontState = { size: 10, style: 'normal', color: INK };

    function applyFont() {
      doc.setFont('helvetica', fontState.style);
      doc.setFontSize(fontState.size);
      doc.setTextColor.apply(doc, fontState.color);
    }

    function setFont(size, style, color) {
      fontState = { size: size, style: style || 'normal', color: color || INK };
      applyFont();
    }

    function pageNo() {
      return doc.internal.getCurrentPageInfo().pageNumber;
    }

    function newPage() {
      doc.addPage();
      page++;
      y = M + 14;
      runningHeader();
    }

    function ensure(h) {
      if (y + h > H - 20) newPage();
    }

    function runningHeader() {
      var saved = fontState;
      doc.setDrawColor.apply(doc, LINE);
      doc.setLineWidth(0.3);
      doc.line(M, M + 6, W - M, M + 6);
      setFont(8, 'normal', INK3);
      doc.text(settings.appName || 'Safety Rounds', M, M + 3);
      doc.text(doc.splitTextToSize(visit.code + ' · ' + (form.name || ''), CW - 40)[0], W - M, M + 3, { align: 'right' });
      fontState = saved;
      applyFont();
    }

    function text(str, size, style, color, x, maxW) {
      setFont(size, style, color);
      var lines = doc.splitTextToSize(String(str == null ? '' : str), maxW || CW);
      var lh = size * 0.38;
      lines.forEach(function (ln) {
        ensure(lh + 1);
        doc.text(ln, x === undefined ? M : x, y);
        y += lh;
      });
      return lines.length;
    }

    function gap(n) { y += n; }

    function rule(color) {
      ensure(3);
      doc.setDrawColor.apply(doc, color || LINE);
      doc.setLineWidth(0.3);
      doc.line(M, y, W - M, y);
      y += 3;
    }

    // Ancho real de la etiqueta: hay que fijar la fuente ANTES de medir,
    // o el texto se corta.
    function chipWidth(label) {
      setFont(7.5, 'bold', INK);
      return doc.getTextWidth(label) + 5.5;
    }

    function chip(label, x, yy, color, textColor) {
      var w = chipWidth(label);
      doc.setFillColor.apply(doc, color);
      doc.roundedRect(x, yy - 3.5, w, 5.4, 1.3, 1.3, 'F');
      setFont(7.5, 'bold', textColor || [255, 255, 255]);
      doc.text(label, x + 2.75, yy);
      return w;
    }

    /* ---------- Portada / cabecera ---------- */

    function cover() {
      // Banda superior
      doc.setFillColor.apply(doc, NAVY);
      doc.rect(0, 0, W, 40, 'F');
      doc.setFillColor.apply(doc, CORAL);
      doc.rect(0, 40, W, 1.6, 'F');

      var textX = M;
      if (settings.logo) {
        try {
          doc.addImage(settings.logo, imgFormat(settings.logo), M, 9, 22, 22, undefined, 'FAST');
          textX = M + 27;
        } catch (e) { /* logo no válido: se ignora */ }
      }

      setFont(9, 'bold', [241, 107, 107]);
      doc.text(doc.splitTextToSize((settings.company || settings.department || 'SAFETY & HEALTH').toUpperCase(), CW - (textX - M) - 42)[0], textX, 15);

      // El título se reduce hasta caber en una línea antes que recortarse
      var titleW = CW - (textX - M) - 42;
      var size = 19;
      setFont(size, 'bold', [255, 255, 255]);
      while (size > 11 && doc.getTextWidth(form.name || '') > titleW) {
        size -= 0.5;
        setFont(size, 'bold', [255, 255, 255]);
      }
      doc.text(doc.splitTextToSize(form.name || 'Informe de inspección', titleW)[0], textX, 24);

      setFont(9, 'normal', [200, 206, 235]);
      doc.text('Informe de inspección · ' + visit.code, textX, 31);

      setFont(8, 'normal', [200, 206, 235]);
      doc.text(UI.fmtDate(visit.date), W - M, 24, { align: 'right' });
      setFont(7.5, 'normal', [160, 170, 215]);
      doc.text(visit.status === 'completed' ? 'FINALIZADA' : 'BORRADOR', W - M, 30, { align: 'right' });

      y = 52;
    }

    /* ---------- Ficha de datos ---------- */

    function metaBlock() {
      var rows = [
        ['Cuestionario', form.name || '—'],
        ['Referencia', visit.code],
        ['Fecha de la visita', UI.fmtDate(visit.date)],
        ['Inspector', visit.inspector || '—'],
        ['Centro / Instalación', visit.centerId ? Store.catalogName(visit.centerId) : '—'],
        ['Área / Zona', visit.areaId ? Store.catalogName(visit.areaId) : '—']
      ];

      var rowH = 12;
      var lines = Math.ceil(rows.length / 2);
      var boxH = lines * rowH + 3;
      doc.setFillColor.apply(doc, SURFACE);
      doc.roundedRect(M, y, CW, boxH, 2.5, 2.5, 'F');

      var startY = y + 7;
      rows.forEach(function (r, i) {
        var col = i % 2;
        var line = Math.floor(i / 2);
        var x = M + 6 + col * (CW / 2);
        setFont(6.8, 'bold', INK3);
        doc.text(r[0].toUpperCase(), x, startY + line * rowH);
        setFont(9.5, 'normal', INK);
        doc.text(doc.splitTextToSize(String(r[1]), CW / 2 - 12)[0], x, startY + line * rowH + 4.6);
      });
      y += boxH + 8;
    }

    /* ---------- Resumen de resultados ---------- */

    function summary() {
      var s = visit.score || { ok: 0, ko: 0, na: 0, pct: 0, total: 0 };
      if (!s.total && !s.na) return;

      var cards = [
        { label: 'CONFORMES', value: fmtNum(s.ok), color: GREEN },
        { label: 'DESVIACIONES', value: fmtNum(s.ko), color: CORAL },
        { label: 'NO APLICA', value: fmtNum(s.na), color: INK3 },
        { label: '% CONFORMIDAD', value: fmtPct(s.pct), color: s.pct >= 90 ? GREEN : s.pct >= 70 ? AMBER : CORAL }
      ];
      var cw = (CW - 3 * 3) / 4;
      ensure(24);
      cards.forEach(function (c, i) {
        var x = M + i * (cw + 3);
        doc.setDrawColor.apply(doc, LINE);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, cw, 19, 2.5, 2.5, 'S');
        doc.setFillColor.apply(doc, c.color);
        doc.roundedRect(x, y, 1.6, 19, 0.8, 0.8, 'F');
        setFont(15, 'bold', c.color);
        doc.text(c.value, x + 5, y + 9.5);
        setFont(6.5, 'bold', INK3);
        doc.text(c.label, x + 5, y + 14.5);
      });
      y += 26;
    }

    /* ---------- Respuestas ---------- */

    function sectionTitle(t) {
      ensure(14);
      doc.setFillColor.apply(doc, NAVY);
      doc.roundedRect(M, y, CW, 8, 1.8, 1.8, 'F');
      setFont(9, 'bold', [255, 255, 255]);
      doc.text(String(t).toUpperCase(), M + 4, y + 5.4);
      y += 13;
    }

    function answers() {
      sectionTitle('Detalle de la inspección');

      var visible = (form.fields || []).filter(function (f) {
        return Builder.isVisible(f, visit.answers || {}) && Builder.FIELD_TYPES[f.type];
      });

      visible.forEach(function (f, i) {
        var t = Builder.FIELD_TYPES[f.type];

        if (t.structural) {
          if (f.type === 'divider') { gap(2); rule(); return; }
          // Un epígrafe no debe quedarse solo al pie: se reserva sitio para él
          // y para lo primero que viene debajo.
          if (f.type === 'title' || f.type === 'subtitle') {
            ensure(10 + nextReserve(visible, i));
            gap(f.type === 'title' ? 3 : 2);
            text(f.label, f.type === 'title' ? 13 : 10.5, 'bold', f.type === 'title' ? NAVY : NAVY_MID);
            gap(f.type === 'title' ? 2 : 1.5);
            return;
          }
          if (f.type === 'paragraph') { text(f.label, 8.5, 'italic', INK2); gap(2); return; }
          return;
        }

        // Se reserva sitio para pregunta y respuesta juntas: un enunciado
        // suelto al pie de página sin su desviación debajo no se entiende.
        ensure(reserveFor(f));
        var startY = y;
        text(f.label, 9.5, 'bold', INK);
        gap(0.6);
        renderAnswer(f, startY);
        gap(4);
      });
    }

    /** Espacio que pide el primer contenido no estructural tras el índice i. */
    function nextReserve(visible, i) {
      for (var k = i + 1; k < visible.length; k++) {
        var t = Builder.FIELD_TYPES[visible[k].type];
        if (t && t.structural) continue;
        return reserveFor(visible[k]);
      }
      return 0;
    }

    function reserveFor(f) {
      var a = (visit.answers || {})[f.id];
      if (f.type === 'checkitem' && a && a.value === 'ko' && a.deviation) {
        var d = a.deviation;
        var h = 34;
        h += Math.ceil(String(d.description || '').length / 105) * 4;
        if (d.action && (d.action.title || d.action.responsible)) h += 12;
        if ((d.photos || []).length) h += 34;
        return Math.min(h, 110);
      }
      if (f.type === 'signature') return a ? 34 : 14;
      if (f.type === 'photo' || f.type === 'file') return (Array.isArray(a) && a.length) ? 42 : 14;
      return 16;
    }

    function renderAnswer(f, startY) {
      var a = (visit.answers || {})[f.id];

      if (f.type === 'checkitem') {
        var v = (a || {}).value;
        var map = {
          ok: { label: 'CORRECTO', color: GREEN },
          ko: { label: 'NO CORRECTO', color: CORAL },
          na: { label: 'NO APLICA', color: [122, 131, 163] }
        };
        var m = map[v];
        if (!m) { text('Sin contestar', 9, 'italic', INK3); return; }
        chip(m.label, M, y + 1.5, m.color);
        y += 4.5;
        if (v === 'ko' && a.deviation) deviationBlock(a.deviation);
        return;
      }

      if (f.type === 'signature') {
        if (!a) { text('Sin firma', 9, 'italic', INK3); return; }
        ensure(30);
        try {
          // Se respeta la proporción original del trazo: una firma estirada
          // deja de parecerse a la del firmante.
          var boxW = 70, boxH = 26, iw = 66, ih = 22;
          var props = doc.getImageProperties(a);
          if (props && props.width && props.height) {
            var s = Math.min(66 / props.width, 22 / props.height);
            iw = props.width * s;
            ih = props.height * s;
            boxW = iw + 4;
            boxH = ih + 4;
          }
          doc.setDrawColor.apply(doc, LINE);
          doc.setLineWidth(0.3);
          doc.roundedRect(M, y, boxW, boxH, 2, 2, 'S');
          doc.addImage(a, imgFormat(a), M + 2, y + 2, iw, ih, undefined, 'FAST');
          y += boxH + 3;
        } catch (e) { text('[firma no legible]', 9, 'italic', INK3); }
        return;
      }

      if (f.type === 'listpick') {
        if (!a || !a.ids || !a.ids.length) { text('Sin contestar', 9, 'italic', INK3); return; }
        var picked = a.ids.map(function (id) { return Store.catalogName(id, ''); }).filter(Boolean);
        text(picked.join(', '), 9, 'normal', INK2);

        // Cargo y correo, cuando el elemento los tenga registrados
        a.ids.forEach(function (id) {
          var c = Store.get('catalogs', id);
          if (!c) return;
          var extra = [c.role, c.email, c.phone].filter(Boolean).join('  ·  ');
          if (extra) text(extra, 8, 'normal', INK3, M + 2);
        });

        if (a.childId) {
          var kid = Store.get('catalogs', a.childId);
          if (kid) {
            var lst = f.listId ? Store.list(f.listId) : null;
            var childList = lst && lst.childListId ? Store.list(lst.childListId) : null;
            text((f.childLabel || (childList ? childList.name : 'Subtipología')) + ': ' + kid.name,
              8.5, 'normal', INK2, M + 2);
          }
        }
        return;
      }

      if (f.type === 'photo' || f.type === 'file') {
        var items = Array.isArray(a) ? a : [];
        if (!items.length) { text('Sin evidencias', 9, 'italic', INK3); return; }
        photoStrip(items);
        return;
      }

      if (Array.isArray(a)) {
        if (!a.length) { text('Sin contestar', 9, 'italic', INK3); return; }
        a.forEach(function (v) { text('•  ' + v, 9, 'normal', INK2, M + 2); });
        return;
      }

      if (a === undefined || a === null || a === '') { text('Sin contestar', 9, 'italic', INK3); return; }
      if (f.type === 'date') { text(UI.fmtDate(a), 9, 'normal', INK2); return; }
      text(String(a) + (f.unit ? ' ' + f.unit : ''), 9, 'normal', INK2);
    }

    function deviationBlock(d) {
      var sev = d.severityId ? Store.catalogName(d.severityId) : '';
      var cat = d.categoryId ? Store.catalogName(d.categoryId) : '';

      // El origen del recuadro se fija DESPUÉS de reservar sitio: si ensure()
      // provoca un salto de página, boxTop debe referirse a la página nueva.
      ensure(30);
      var startPage = pageNo();
      var boxTop = y + 1;
      var innerX = M + 4;
      var innerW = CW - 8;

      y = boxTop + 5;
      setFont(7, 'bold', CORAL);
      doc.text('DESVIACIÓN DETECTADA', innerX, y);
      y += 4;

      setFont(9, 'normal', INK);
      var lines = doc.splitTextToSize(d.description || '(sin descripción)', innerW);
      lines.forEach(function (ln) {
        ensure(4.5);
        doc.text(ln, innerX, y);
        y += 3.9;
      });

      if (sev || cat) {
        y += 2;
        ensure(6);
        var x = innerX;
        if (sev) x += chip(sev.toUpperCase(), x, y, hexToRgb(Store.catalogColor(d.severityId, '#E05C5C'))) + 2.5;
        if (cat) drawOutlineChip(x, y, cat.toUpperCase());
        y += 4;
      }

      if (d.action && (d.action.title || d.action.responsible || d.action.dueDate)) {
        y += 2.5;
        ensure(9);
        setFont(7, 'bold', NAVY);
        doc.text('ACCIÓN CORRECTORA', innerX, y);
        y += 4;
        setFont(8.5, 'normal', INK2);
        var parts = [];
        if (d.action.title) parts.push(d.action.title);
        var meta = [];
        if (d.action.responsible) meta.push('Responsable: ' + d.action.responsible);
        if (d.action.dueDate) meta.push('Fecha límite: ' + UI.fmtDate(d.action.dueDate));
        if (meta.length) parts.push(meta.join('   ·   '));
        parts.forEach(function (p) {
          doc.splitTextToSize(p, innerW).forEach(function (ln) {
            ensure(4);
            doc.text(ln, innerX, y);
            y += 3.7;
          });
        });
      }

      var photos = (d.photos || []).filter(function (p) { return p && p.kind === 'image'; });
      if (photos.length) {
        y += 2;
        photoStrip(photos, innerX);
      }

      y += 3;
      drawDeviationFrame(startPage, boxTop, pageNo(), y - 1);
      y += 3;
    }

    /**
     * Dibuja el marco de la desviación tramo a tramo: si el contenido ha
     * ocupado varias páginas, cada una recibe su propio segmento de recuadro.
     */
    function drawDeviationFrame(fromPage, fromY, toPage, toY) {
      var current = pageNo();
      var top = M + 10;
      var bottom = H - 18;

      for (var p = fromPage; p <= toPage; p++) {
        doc.setPage(p);
        var y1 = p === fromPage ? fromY : top;
        var y2 = p === toPage ? toY : bottom;
        var h = y2 - y1;
        if (h < 2) continue;
        doc.setDrawColor.apply(doc, [248, 212, 212]);
        doc.setLineWidth(0.4);
        doc.roundedRect(M, y1, CW, h, 2, 2, 'S');
        doc.setFillColor.apply(doc, CORAL);
        doc.roundedRect(M, y1, 1.4, h, 0.7, 0.7, 'F');
      }

      doc.setPage(current);
      applyFont();
    }

    function drawOutlineChip(x, yy, label) {
      var w = chipWidth(label);
      doc.setDrawColor.apply(doc, LINE);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, yy - 3.5, w, 5.4, 1.3, 1.3, 'S');
      setFont(7.5, 'bold', INK2);
      doc.text(label, x + 2.75, yy);
      return w;
    }

    function photoStrip(items, x0) {
      var imgs = items.filter(function (p) {
        return p && (p.kind === 'image' || (typeof p === 'string' && p.indexOf('data:image') === 0));
      });
      var files = items.filter(function (p) { return p && p.kind === 'file'; });

      if (imgs.length) {
        var perRow = 4;
        var gapX = 3;
        var x0v = x0 === undefined ? M : x0;
        var availW = (W - M) - x0v;
        var iw = (availW - gapX * (perRow - 1)) / perRow;
        var ih = iw * 0.72;

        for (var i = 0; i < imgs.length; i += perRow) {
          ensure(ih + 3);
          var rowY = y;
          for (var j = 0; j < perRow && i + j < imgs.length; j++) {
            var src = typeof imgs[i + j] === 'string' ? imgs[i + j] : imgs[i + j].data;
            try {
              doc.addImage(src, imgFormat(src), x0v + j * (iw + gapX), rowY, iw, ih, undefined, 'FAST');
              doc.setDrawColor.apply(doc, LINE);
              doc.setLineWidth(0.25);
              doc.roundedRect(x0v + j * (iw + gapX), rowY, iw, ih, 1.2, 1.2, 'S');
            } catch (e) { /* imagen corrupta */ }
          }
          y = rowY + ih + 3;
        }
      }

      if (files.length) {
        files.forEach(function (f) {
          ensure(4.5);
          setFont(8, 'normal', INK2);
          doc.text('📎 ' + (f.name || 'adjunto'), x0 === undefined ? M : x0, y);
          y += 4;
        });
      }
    }

    /* ---------- Pie con paginación ---------- */

    function footers() {
      var total = doc.internal.getNumberOfPages();
      for (var p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setDrawColor.apply(doc, LINE);
        doc.setLineWidth(0.3);
        doc.line(M, H - 14, W - M, H - 14);
        setFont(7.5, 'normal', INK3);
        var left = (settings.company ? settings.company + ' · ' : '') + (settings.pdfFooter || settings.department || '');
        doc.text(doc.splitTextToSize(left, CW - 30)[0] || '', M, H - 9.5);
        doc.text('Página ' + p + ' de ' + total, W - M, H - 9.5, { align: 'right' });
        setFont(6.5, 'normal', [180, 186, 210]);
        doc.text('Generado con ' + (settings.appName || 'Safety Rounds') + ' · ' + UI.fmtDateTime(new Date()), M, H - 5.5);
      }
    }

    /* ---------- Ensamblado ---------- */

    cover();
    metaBlock();
    summary();
    answers();
    footers();
    return doc;
  }

  function hexToRgb(hex) {
    var c = String(hex || '#4356AE').replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return isNaN(r) ? [67, 86, 174] : [r, g, b];
  }

  /* ======================================================================
     API pública
     ====================================================================== */

  function filenameFor(visit) {
    return UI.slug(visit.code + '-' + (visit.formName || 'inspeccion')) + '.pdf';
  }

  function generate(visitId, opts) {
    opts = opts || {};
    var visit = Store.get('visits', visitId);
    if (!visit) { UI.toast('La visita ya no existe.', 'err'); return null; }

    if (!available()) {
      UI.toast('El generador de PDF no está disponible. Usa «Imprimir» como alternativa.', 'err');
      return null;
    }

    var doc;
    try {
      doc = build(visit);
    } catch (e) {
      console.error(e);
      UI.toast('No se ha podido generar el PDF: ' + e.message, 'err');
      return null;
    }

    if (opts.download !== false) {
      doc.save(filenameFor(visit));
      UI.toast('Informe ' + visit.code + ' descargado.');
    }
    return doc;
  }

  function blobFor(visitId) {
    var visit = Store.get('visits', visitId);
    if (!visit || !available()) return null;
    try {
      return build(visit).output('blob');
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  function open(visitId) {
    var doc = generate(visitId, { download: false });
    if (!doc) return;
    var url = doc.output('bloburl');
    var w = window.open(url, '_blank');
    if (!w) {
      // Bloqueo de ventanas emergentes: se descarga en su lugar
      var visit = Store.get('visits', visitId);
      doc.save(filenameFor(visit));
    }
  }

  /**
   * Envío del informe a los correos configurados en el cuestionario.
   * Sin backend no se puede enviar un adjunto de forma silenciosa, así que:
   *  · en móvil se usa la hoja de compartir nativa (adjunta el PDF de verdad);
   *  · en escritorio se descarga el PDF y se abre el correo ya redactado.
   */
  function sendByEmail(visitId) {
    var visit = Store.get('visits', visitId);
    if (!visit) return;
    var form = visit.formSnapshot || Store.get('forms', visit.formId) || {};
    // Destinatarios fijos del cuestionario + los que aportan los módulos de
    // tipología con envío automático (el correo del responsable elegido)
    var emails = (form.emails || []).slice();
    (visit.extraEmails || []).forEach(function (m) {
      if (emails.indexOf(m) === -1) emails.push(m);
    });

    askRecipients(emails, function (list) {
      if (!list.length) return;
      var blob = blobFor(visitId);
      var name = filenameFor(visit);
      var subject = '[' + (Store.settings().appName || 'Safety Rounds') + '] ' + (visit.formName || 'Inspección') + ' · ' + visit.code;
      var s = visit.score || { ok: 0, ko: 0, pct: 0 };
      var body = [
        'Adjunto el informe de la inspección realizada.',
        '',
        'Referencia: ' + visit.code,
        'Cuestionario: ' + (visit.formName || '—'),
        'Fecha: ' + UI.fmtDate(visit.date),
        'Inspector: ' + (visit.inspector || '—'),
        'Centro: ' + (visit.centerId ? Store.catalogName(visit.centerId) : '—'),
        'Área: ' + (visit.areaId ? Store.catalogName(visit.areaId) : '—'),
        '',
        'Resultado: ' + fmtPct(s.pct) + ' de conformidad · ' + fmtNum(s.ko) + ' desviaciones detectadas.',
        '',
        '--',
        (Store.settings().company || Store.settings().department || 'Departamento de Safety & Health')
      ].join('\n');

      // 1) Hoja de compartir nativa con el PDF adjunto (móvil / macOS)
      if (blob && navigator.canShare) {
        var file = new File([blob], name, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: subject, text: body })
            .then(function () { UI.toast('Informe compartido.'); })
            .catch(function () { mailtoFallback(); });
          return;
        }
      }
      mailtoFallback();

      function mailtoFallback() {
        if (blob) UI.download(name, blob);
        var href = 'mailto:' + encodeURIComponent(list.join(',')) +
          '?subject=' + encodeURIComponent(subject) +
          '&body=' + encodeURIComponent(body + '\n\n(El informe en PDF se ha descargado en tu dispositivo: adjúntalo a este correo.)');
        window.location.href = href;
        UI.toast('PDF descargado y correo preparado. Adjunta el archivo antes de enviar.', 'info');
      }
    });
  }

  function askRecipients(preset, cb) {
    var input = UI.el('textarea', {
      class: 'textarea', style: { minHeight: '80px' },
      placeholder: 'prevencion@empresa.com, direccion@empresa.com'
    });
    input.value = preset.join(', ');

    var body = UI.el('div', { style: { paddingBottom: '6px' } }, [
      UI.field('Destinatarios', input, 'Separa varias direcciones con comas.')
    ]);

    UI.modal({
      title: 'Enviar informe por correo',
      subtitle: 'Se adjuntará el PDF de la visita.',
      icon: 'mail',
      body: body,
      buttons: [
        { label: 'Cancelar', kind: 'quiet' },
        {
          label: 'Preparar envío', kind: 'primary', icon: 'send',
          onClick: function () {
            var list = input.value.split(/[,;\n]/).map(function (s) { return s.trim(); })
              .filter(function (s) { return s.indexOf('@') > 0; });
            if (!list.length) { UI.toast('Indica al menos un correo válido.', 'err'); return false; }
            cb(list);
          }
        }
      ]
    });
  }

  global.PDF = {
    generate: generate,
    open: open,
    blobFor: blobFor,
    sendByEmail: sendByEmail,
    filenameFor: filenameFor,
    available: available
  };
})(window);
