/* ==========================================================================
   Safety Rounds — Envío de informes por correo
   El cliente genera el PDF de la visita (js/pdf.js) y lo manda aquí en
   base64; el servidor lo adjunta y lo envía. Así funciona igual desde el
   móvil que desde el escritorio, y queda constancia de qué se envió y a quién.
   ========================================================================== */
'use strict';

const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../auth');
const mail = require('../mail');

const router = express.Router();

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const MAX_RECIPIENTS = 10;
const MAX_PDF_BYTES = 12 * 1024 * 1024;
const HOURLY_LIMIT = 40;        // por usuario: frena un bucle del cliente o un abuso

// Aviso rápido para que la interfaz sepa, antes de intentarlo, si el servidor
// puede enviar correo (y por tanto si ofrece «Enviar» o solo «Compartir»).
router.get('/status', requireAuth, function (req, res) {
  res.json({ configured: mail.configured(), provider: mail.provider() });
});

router.post('/report', requireAuth, async function (req, res) {
  if (req.user.role === 'usuario') {
    return res.status(403).json({ error: 'Las cuentas de demostración no pueden enviar correo desde el servidor.', code: 'demo' });
  }
  if (!mail.configured()) {
    return res.status(503).json({ error: 'El servidor no tiene configurado el envío de correo.', code: 'not_configured' });
  }

  const body = req.body || {};
  const to = (Array.isArray(body.to) ? body.to : String(body.to || '').split(/[,;\s]+/))
    .map(function (s) { return String(s).trim().toLowerCase(); })
    .filter(Boolean);
  const unique = to.filter(function (m, i) { return to.indexOf(m) === i; });

  if (!unique.length) return res.status(400).json({ error: 'Indica al menos un destinatario.' });
  if (unique.length > MAX_RECIPIENTS) return res.status(400).json({ error: 'Máximo ' + MAX_RECIPIENTS + ' destinatarios por envío.' });
  const bad = unique.filter(function (m) { return !EMAIL_RE.test(m); });
  if (bad.length) return res.status(400).json({ error: 'Dirección no válida: ' + bad[0] });

  const pdfB64 = String(body.pdfBase64 || '').replace(/^data:application\/pdf;base64,/, '');
  if (!pdfB64) return res.status(400).json({ error: 'Falta el PDF del informe.' });
  const pdf = Buffer.from(pdfB64, 'base64');
  if (!pdf.length || pdf.slice(0, 4).toString() !== '%PDF') return res.status(400).json({ error: 'El archivo adjunto no es un PDF.' });
  if (pdf.length > MAX_PDF_BYTES) return res.status(413).json({ error: 'El PDF es demasiado grande para enviarlo por correo.' });

  const subject = String(body.subject || 'Informe de inspección').slice(0, 200);
  const text = String(body.text || '').slice(0, 5000);
  const filename = String(body.filename || 'informe.pdf').replace(/[^\w.\- ]+/g, '_').slice(0, 100);
  const visitId = body.visitId ? String(body.visitId).slice(0, 120) : null;

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM email_log WHERE user_id = $1 AND status = 'sent' AND created_at > now() - interval '1 hour'`,
      [req.user.id]
    );
    if (rows[0].n >= HOURLY_LIMIT) {
      return res.status(429).json({ error: 'Has alcanzado el límite de envíos por hora. Inténtalo más tarde.' });
    }
  } catch (e) { /* si no se puede contar, se deja pasar */ }

  try {
    const r = await mail.send({
      fromName: body.fromName ? String(body.fromName).slice(0, 80) : 'Safety Rounds',
      to: unique,
      subject: subject,
      text: text,
      replyTo: undefined,
      attachments: [{ filename: filename, content: pdf, contentType: 'application/pdf' }]
    });
    await pool.query(
      `INSERT INTO email_log (user_id, visit_id, recipients, subject, status, provider) VALUES ($1, $2, $3, $4, 'sent', $5)`,
      [req.user.id, visitId, unique.join(', '), subject, r.provider]
    ).catch(function () {});
    res.json({ ok: true, provider: r.provider, to: unique });
  } catch (e) {
    console.error('[email] error al enviar informe', e.message);
    await pool.query(
      `INSERT INTO email_log (user_id, visit_id, recipients, subject, status, provider, error) VALUES ($1, $2, $3, $4, 'error', $5, $6)`,
      [req.user.id, visitId, unique.join(', '), subject, mail.provider(), String(e.message).slice(0, 500)]
    ).catch(function () {});
    const status = e.code === 'NOT_CONFIGURED' ? 503 : 502;
    res.status(status).json({
      error: e.code === 'NOT_CONFIGURED' ? e.message : 'El proveedor de correo ha rechazado el envío: ' + e.message,
      code: e.code === 'NOT_CONFIGURED' ? 'not_configured' : 'provider'
    });
  }
});

module.exports = router;
