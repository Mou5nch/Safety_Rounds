/* ==========================================================================
   Safety Rounds — API de autenticación
   ========================================================================== */
'use strict';

const express = require('express');
const { pool } = require('../db');
const {
  COOKIE_NAME, verifyPassword, createSession, endSession, touchSession
} = require('../auth');

const router = express.Router();

// Límite de intentos muy simple en memoria: el login queda expuesto en
// internet, así que conviene frenar la fuerza bruta aunque las cuentas sean
// de prueba. Basta con esto porque el proceso no se reinicia entre intentos
// (si Railway lo reinicia, el contador vuelve a cero: no es grave).
var LOGIN_LIMIT = 10;
var LOGIN_WINDOW_MS = 5 * 60 * 1000;
var attempts = new Map();

function tooManyAttempts(key) {
  var now = Date.now();
  var entry = attempts.get(key);
  if (!entry || now - entry.since > LOGIN_WINDOW_MS) {
    entry = { count: 0, since: now };
    attempts.set(key, entry);
  }
  return entry.count >= LOGIN_LIMIT ? entry : null;
}

function registerFailure(key) {
  var entry = attempts.get(key);
  if (entry) entry.count++;
}

function clearAttempts(key) {
  attempts.delete(key);
}

router.post('/login', async function (req, res) {
  const key = req.ip || 'unknown';
  if (tooManyAttempts(key)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' });
  }

  const username = String((req.body && req.body.username) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');
  if (!username || !password) {
    return res.status(400).json({ error: 'Indica usuario y contraseña.' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      registerFailure(key);
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }
    clearAttempts(key);
    await createSession(user.id, req, res);
    res.json({ username: user.username, name: user.name, role: user.role });
  } catch (e) {
    console.error('[auth] error en login', e);
    res.status(500).json({ error: 'No se ha podido iniciar sesión. Inténtalo de nuevo.' });
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

module.exports = router;
