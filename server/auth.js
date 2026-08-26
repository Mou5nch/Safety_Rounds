/* ==========================================================================
   Safety Rounds — Autenticación y sesiones
   Sesión opaca guardada en Postgres (no JWT): la cookie solo lleva un token
   aleatorio, y cada petición protegida lo resuelve contra la tabla
   `sessions`. Esto permite cerrar sesiones desde el panel de administración
   y calcular el tiempo de conexión real (login_at → last_seen_at/logout_at).
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

const COOKIE_NAME = 'sr_session';
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function newToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/'
  };
}

async function createSession(userId, req, res) {
  const token = newToken();
  await pool.query(
    `INSERT INTO sessions (id, user_id, ip, user_agent) VALUES ($1, $2, $3, $4)`,
    [token, userId, req.ip || null, req.get('user-agent') || null]
  );
  res.cookie(COOKIE_NAME, token, cookieOptions());
  return token;
}

async function endSession(token) {
  if (!token) return;
  await pool.query(`UPDATE sessions SET logout_at = now(), last_seen_at = now() WHERE id = $1 AND logout_at IS NULL`, [token]);
}

async function touchSession(token) {
  if (!token) return null;
  const { rows } = await pool.query(
    `UPDATE sessions SET last_seen_at = now() WHERE id = $1 AND logout_at IS NULL RETURNING user_id`,
    [token]
  );
  return rows[0] || null;
}

/** Adjunta req.user (y req.sessionToken) si la cookie de sesión es válida. No bloquea si no lo es. */
async function attachUser(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  req.sessionToken = token || null;
  req.user = null;
  if (!token) return next();
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.name, u.role
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = $1 AND s.logout_at IS NULL`,
      [token]
    );
    req.user = rows[0] || null;
  } catch (e) {
    console.error('[auth] error al resolver la sesión', e);
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No has iniciado sesión.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No has iniciado sesión.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Necesitas permisos de administración.' });
  next();
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  createSession,
  endSession,
  touchSession,
  attachUser,
  requireAuth,
  requireAdmin
};
