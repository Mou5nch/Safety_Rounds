/* ==========================================================================
   Safety Rounds — API de autenticación
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const express = require('express');
const { pool } = require('../db');
const {
  COOKIE_NAME, verifyPassword, hashPassword, createSession, endSession, touchSession
} = require('../auth');
const mail = require('../mail');

const router = express.Router();

// Límite de intentos muy simple en memoria, reutilizado por login y por la
// petición de recuperación (con su propio "cajón" por prefijo de clave): el
// login queda expuesto en internet, así que conviene frenar la fuerza bruta
// aunque las cuentas sean de prueba, y evitar que alguien use el formulario
// de recuperación para bombardear un correo. Basta con esto porque el
// proceso no se reinicia entre intentos (si Railway lo reinicia, el
// contador vuelve a cero: no es grave).
var LIMITS = {
  login: { max: 10, windowMs: 5 * 60 * 1000 },
  forgot: { max: 5, windowMs: 15 * 60 * 1000 },
  register: { max: 8, windowMs: 15 * 60 * 1000 }
};
var attempts = new Map();

function tooManyAttempts(bucket, key) {
  var cfg = LIMITS[bucket];
  var mapKey = bucket + ':' + key;
  var now = Date.now();
  var entry = attempts.get(mapKey);
  if (!entry || now - entry.since > cfg.windowMs) {
    entry = { count: 0, since: now };
    attempts.set(mapKey, entry);
  }
  return entry.count >= cfg.max ? entry : null;
}

function registerFailure(bucket, key) {
  var entry = attempts.get(bucket + ':' + key);
  if (entry) entry.count++;
}

function clearAttempts(bucket, key) {
  attempts.delete(bucket + ':' + key);
}

router.post('/login', async function (req, res) {
  const key = req.ip || 'unknown';
  if (tooManyAttempts('login', key)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' });
  }

  const username = String((req.body && req.body.username) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');
  if (!username || !password) {
    return res.status(400).json({ error: 'Indica usuario y contraseña.' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      registerFailure('login', key);
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }
    clearAttempts('login', key);
    await createSession(user.id, req, res);
    res.json({ username: user.username, name: user.name, role: user.role });
  } catch (e) {
    console.error('[auth] error en login', e);
    res.status(500).json({ error: 'No se ha podido iniciar sesión. Inténtalo de nuevo.' });
  }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Alta pública: siempre con rol 'usuario' (cuenta de demostración), nunca
// el que venga en el cuerpo de la petición. El correo hace de usuario para
// entrar, así no hay que pedir un nombre de usuario aparte.
router.post('/register', async function (req, res) {
  const key = req.ip || 'unknown';
  if (tooManyAttempts('register', key)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' });
  }

  const name = String((req.body && req.body.name) || '').trim();
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');

  if (!name || !email || !password) {
    registerFailure('register', key);
    return res.status(400).json({ error: 'Indica tu nombre, correo y contraseña.' });
  }
  if (!EMAIL_RE.test(email)) {
    registerFailure('register', key);
    return res.status(400).json({ error: 'Indica un correo válido.' });
  }
  if (password.length < 8) {
    registerFailure('register', key);
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const hash = await hashPassword(password);
    const { rows } = await pool.query(
      `INSERT INTO users (username, name, role, password_hash, fictitious, email)
       VALUES ($1, $2, 'usuario', $3, TRUE, $1) RETURNING id, username, name, role`,
      [email, name, hash]
    );
    clearAttempts('register', key);
    await createSession(rows[0].id, req, res);
    res.status(201).json({ username: rows[0].username, name: rows[0].name, role: rows[0].role });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    registerFailure('register', key);
    console.error('[auth] error en register', e);
    res.status(500).json({ error: 'No se ha podido crear la cuenta.' });
  }
});

router.post('/logout', async function (req, res) {
  try {
    await endSession(req.sessionToken);
  } catch (e) {
    console.error('[auth] error en logout', e);
  }
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

router.post('/heartbeat', async function (req, res) {
  if (!req.sessionToken) return res.status(401).json({ error: 'No hay sesión.' });
  try {
    const row = await touchSession(req.sessionToken);
    if (!row) return res.status(401).json({ error: 'La sesión ha caducado.' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[auth] error en heartbeat', e);
    res.status(500).json({ error: 'Error al actualizar la sesión.' });
  }
});

router.get('/me', function (req, res) {
  if (!req.user) return res.status(401).json({ error: 'No has iniciado sesión.' });
  res.json(req.user);
});

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

// Siempre responde con el mismo mensaje exista o no la cuenta: si no, se
// filtraría qué usuarios están dados de alta con solo probar direcciones.
router.post('/forgot-password', async function (req, res) {
  const key = req.ip || 'unknown';
  if (tooManyAttempts('forgot', key)) {
    return res.status(429).json({ error: 'Demasiadas peticiones. Espera unos minutos y vuelve a intentarlo.' });
  }
  registerFailure('forgot', key);

  const username = String((req.body && req.body.username) || '').trim().toLowerCase();
  const generic = { ok: true, message: 'Si esa cuenta existe y tiene un correo asociado, te hemos enviado un enlace para restablecer la contraseña.' };
  if (!username) return res.status(400).json({ error: 'Indica tu usuario o correo.' });

  try {
    const { rows } = await pool.query('SELECT id, email, name FROM users WHERE username = $1 OR email = $1', [username]);
    const user = rows[0];
    if (!user || !user.email) return res.json(generic);

    await pool.query('DELETE FROM password_resets WHERE user_id = $1', [user.id]);
    const token = crypto.randomBytes(32).toString('base64url');
    await pool.query(
      `INSERT INTO password_resets (token, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
      [token, user.id]
    );

    const resetUrl = req.protocol + '://' + req.get('host') + '/reset-password.html?token=' + token;
    mail.sendPasswordResetEmail(user.email, resetUrl).catch(function (e) {
      console.error('[auth] error al enviar el correo de recuperación', e);
    });

    res.json(generic);
  } catch (e) {
    console.error('[auth] error en forgot-password', e);
    res.status(500).json({ error: 'No se ha podido procesar la petición.' });
  }
});

router.post('/reset-password', async function (req, res) {
  const token = String((req.body && req.body.token) || '');
  const password = String((req.body && req.body.password) || '');
  if (!token || !password) return res.status(400).json({ error: 'Faltan datos.' });
  if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });

  try {
    const { rows } = await pool.query(
      `SELECT user_id FROM password_resets WHERE token = $1 AND expires_at > now()`,
      [token]
    );
    if (!rows.length) return res.status(400).json({ error: 'El enlace no es válido o ha caducado. Pide uno nuevo.' });

    const hash = await hashPassword(password);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, rows[0].user_id]);
    await pool.query('DELETE FROM password_resets WHERE user_id = $1', [rows[0].user_id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[auth] error en reset-password', e);
    res.status(500).json({ error: 'No se ha podido restablecer la contraseña.' });
  }
});

module.exports = router;
