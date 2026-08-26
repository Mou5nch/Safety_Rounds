/* ==========================================================================
   Safety Rounds — Envío de correo
   Un único uso por ahora: el enlace de recuperación de contraseña. Se
   configura con las variables SMTP habituales; con Gmail, usa una
   "contraseña de aplicación" (myaccount.google.com/apppasswords), no la
   contraseña normal de la cuenta.
   ========================================================================== */
'use strict';

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  nodemailer = null;
}

function configured() {
  return !!(nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;
function getTransporter() {
  if (!configured()) return null;
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

async function sendPasswordResetEmail(to, resetUrl, appName) {
  const t = getTransporter();
  if (!t) {
    console.warn('[mail] SMTP no configurado (SMTP_HOST/SMTP_USER/SMTP_PASS): no se ha enviado el correo a ' + to);
    console.warn('[mail] Enlace que se habría enviado: ' + resetUrl);
    return false;
  }

  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const name = appName || 'Safety Rounds';

  await t.sendMail({
    from: '"' + name + '" <' + from + '>',
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

module.exports = { configured, sendPasswordResetEmail };
