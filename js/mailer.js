/* ==========================================================================
   Safety Rounds — Envío de informes por correo desde el servidor
   --------------------------------------------------------------------------
   Genera el PDF de la visita en el dispositivo (js/pdf.js) y se lo manda al
   servidor, que lo adjunta y lo envía (server/routes/email.js). Si no hay
   cobertura, la petición queda en una cola persistente y sale sola al
   recuperarla. El resultado se anota en la propia visita (`emailLog`), de
   modo que se ve «Enviado» o «Error» tanto en la APP principal como en la
   WebApp de campo.
   ========================================================================== */
(function (global) {
  'use strict';

  var serverOk = null;      // null = sin comprobar; true/false = el servidor puede/no puede enviar
  var checkedAt = 0;
  var flushing = false;
  var MAX_ATTEMPTS = 4;
  var RECHECK_MS = 60 * 1000;

  function useServer() {
    // Si la última comprobación dijo «no configurado», se vuelve a mirar de vez
    // en cuando: el administrador puede haber añadido las variables de correo
    // al servidor con la app ya abierta.
    if (serverOk === false) checkServer();
    return !!(global.Sync && Sync.enabledForUser() && serverOk !== false);
  }

  function checkServer(force) {
    if (navigator.onLine === false) return;
    if (!force && Date.now() - checkedAt < RECHECK_MS && serverOk !== null) return;
    checkedAt = Date.now();
    fetch('/api/email/status', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) serverOk = !!j.configured; })
      .catch(function () { /* sin red: se vuelve a intentar más tarde */ });
  }

  /* ---------- Registro en la visita ---------- */

  function setLog(visitId, entryId, patch, create) {
    var v = Store.get('visits', visitId);
    if (!v) return;
    var log = (v.emailLog || []).slice();
    var idx = -1;
    log.forEach(function (e, i) { if (e.id === entryId) idx = i; });
    if (idx === -1) {
      if (!create) return;
      log.push(Object.assign({ id: entryId }, patch));
    } else {
      log[idx] = Object.assign({}, log[idx], patch);
    }
    v.emailLog = log;
    Store.put('visits', v);
  }

  /** Estado del último envío de una visita: { status, to, at, error } o null. */
  function lastStatus(visit) {
    var log = (visit && visit.emailLog) || [];
    return log.length ? log[log.length - 1] : null;
  }

  /* ---------- Cola ---------- */

  function queue(visitId, to, opts) {
    var id = 'mail_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    Store.meta.put({ id: 'm:' + id, entryId: id, visitId: visitId, to: to, attempts: 0, at: new Date().toISOString() });
    setLog(visitId, id, { to: to, at: new Date().toISOString(), status: 'queued', auto: !!(opts && opts.auto) }, true);

    if (!(opts && opts.quiet)) {
      UI.toast(navigator.onLine === false
        ? 'Sin conexión: el informe se enviará solo al recuperar la cobertura.'
        : 'Enviando informe a ' + to.join(', ') + '…', 'info');
    }
    return flush();
  }

  function pending() { return Store.meta.all('m:').length; }

  function toBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).replace(/^data:[^,]*,/, '')); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }

  function finish(entry, ok, info) {
    Store.meta.del('m:' + entry.entryId);
    setLog(entry.visitId, entry.entryId, ok
      ? { status: 'sent', sentAt: new Date().toISOString(), error: '' }
      : { status: 'error', error: info });
    try { window.dispatchEvent(new CustomEvent('sr:mail', { detail: { visitId: entry.visitId, ok: ok } })); } catch (e) {}
    if (ok) UI.toast('Informe enviado a ' + entry.to.join(', ') + '.');
    else UI.toast(info, 'err');
  }

  function sendOne(entry) {
    var visit = Store.get('visits', entry.visitId);
    if (!visit) { Store.meta.del('m:' + entry.entryId); return Promise.resolve(); }

    var blob = PDF.blobFor(entry.visitId);
    if (!blob) { finish(entry, false, 'No se ha podido generar el PDF del informe.'); return Promise.resolve(); }
    var c = PDF.emailContent(visit);

    return toBase64(blob).then(function (b64) {
      return fetch('/api/email/report', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitId: entry.visitId, to: entry.to, subject: c.subject, text: c.body,
          filename: c.filename, pdfBase64: b64,
          fromName: Store.settings().company || Store.settings().appName || 'Safety Rounds'
        })
      });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (res.ok) { finish(entry, true); return; }
        if (res.status === 401) { var e = new Error('auth'); e.auth = true; throw e; }
        if (body.code === 'not_configured') {
          serverOk = false;
          finish(entry, false, 'El servidor aún no tiene el correo configurado. Usa «Compartir PDF» para enviarlo desde tu móvil.');
          return;
        }
        if (res.status >= 500 && res.status !== 503 && entry.attempts + 1 < MAX_ATTEMPTS) {
          entry.attempts++; Store.meta.put(entry); return;    // se reintentará
        }
        finish(entry, false, body.error || 'No se ha podido enviar el informe.');
      });
    });
  }

  function flush() {
    if (flushing || !pending() || navigator.onLine === false) return Promise.resolve();
    flushing = true;
    var entries = Store.meta.all('m:').sort(function (a, b) { return a.at < b.at ? -1 : 1; });

    return entries.reduce(function (p, e) {
      return p.then(function () { return sendOne(e); });
    }, Promise.resolve()).catch(function () {
      /* sin red o sesión caducada: se deja en cola */
    }).then(function () { flushing = false; });
  }

  window.addEventListener('online', function () { setTimeout(flush, 800); });
  setTimeout(checkServer, 1500);

  global.Mailer = {
    useServer: useServer,
    queue: queue,
    flush: flush,
    pending: pending,
    lastStatus: lastStatus
  };
})(window);
