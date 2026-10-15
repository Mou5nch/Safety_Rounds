/* ==========================================================================
   Safety Rounds — Envío de correo
   Dos usos: el enlace de recuperación de contraseña y el informe PDF de una
   visita (WebApp de campo y APP principal).

   Hay dos proveedores posibles y se elige solo según las variables definidas:
   · RESEND_API_KEY (+ MAIL_FROM): API HTTP de Resend. Es la opción pensada
     para Railway, que bloquea el SMTP saliente en los planes Free/Hobby.
   · SMTP_HOST/SMTP_USER/SMTP_PASS: SMTP clásico con nodemailer. Con Gmail,
     usa una "contraseña de aplicación" (myaccount.google.com/apppasswords),
     no la contraseña normal de la cuenta.
   Si hay Resend configurado, tiene prioridad.
   ========================================================================== */
'use strict';

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  nodemailer = null;
}

function resendConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

function smtpConfigured() {
  return !!(nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function configured() {
  return resendConfigured() || smtpConfigured();
}

function provider() {
  return resendConfigured() ? 'resend' : smtpConfigured() ? 'smtp' : null;
}

let transporter = null;
function getTransporter() {
  if (!smtpConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transporter;
}

/**
 * Envío genérico. `attachments`: [{ filename, content (Buffer), contentType }].
 * Lanza un Error con code 'NOT_CONFIGURED' si no hay ningún proveedor.
 */
async function send(msg) {
  const which = provider();
  if (!which) {
    const e = new Error('El servidor no tiene configurado el envío de correo.');
    e.code = 'NOT_CONFIGURED';
    throw e;
  }

  // MAIL_FROM puede venir como «correo@dominio» o ya con nombre: «Nombre <correo@dominio>».
  const fromAddr = process.env.MAIL_FROM || process.env.SMTP_USER;
  const from = (fromAddr.indexOf('<') === -1 && msg.fromName)
    ? '"' + String(msg.fromName).replace(/"/g, '') + '" <' + fromAddr + '>'
    : fromAddr;

  if (which === 'resend') {
    const res = await fetch(process.env.RESEND_API_URL || 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
        reply_to: msg.replyTo || undefined,
        attachments: (msg.attachments || []).map(function (a) {
          return { filename: a.filename, content: a.content.toString('base64') };
        })
      })
    });
    const body = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      const e = new Error(body.message || body.error || ('Resend respondió ' + res.status));
      e.code = 'PROVIDER_ERROR';
      throw e;
    }
    return { provider: 'resend', id: body.id || null };
  }

  const info = await getTransporter().sendMail({
    from: from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html,
    replyTo: msg.replyTo || undefined,
    attachments: (msg.attachments || []).map(function (a) {
      return { filename: a.filename, content: a.content, contentType: a.contentType };
    })
  });
  return { provider: 'smtp', id: info.messageId || null };
}

async function sendPasswordResetEmail(to, resetUrl, appName) {
  if (!configured()) {
    console.warn('[mail] Correo no configurado (RESEND_API_KEY+MAIL_FROM o SMTP_HOST/SMTP_USER/SMTP_PASS): no se ha enviado el correo a ' + to);
    console.warn('[mail] Enlace que se habría enviado: ' + resetUrl);
    return false;
  }

  const name = appName || 'Safety Rounds';

  await send({
    fromName: name,
    to: to,
    subject: 'Recuperar contraseña — ' + name,
    text:
      'Has pedido restablecer tu contraseña en ' + name + '.\n\n' +
      'Abre este enlace para elegir una nueva (caduca en 1 hora):\n' + resetUrl + '\n\n' +
      'Si no has sido tú, puedes ignorar este correo.',
    html:
      '<p>Has pedido restablecer tu contraseña en <strong>' + name + '</strong>.</p>' +
      '<p><a href="' + resetUrl + '">Elegir una nueva contraseña</a> (el enlace caduca en 1 hora).</p>' +
      '<p style="color:#7A83A3;font-size:13px">Si no has sido tú, puedes ignorar este correo.</p>'
  });
  return true;
}

module.exports = { configured, provider, send, sendPasswordResetEmail };
