/* ==========================================================================
   Safety Rounds — Panel de administración
   Listado de usuarios ficticios y su historial de conexión, para el
   seguimiento de acceso y tiempo conectado a la aplicación.
   ========================================================================== */
'use strict';

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

// Una sesión sin cierre explícito se considera "activa" mientras haya
// habido un latido (heartbeat) en los últimos 3 minutos; pasado ese tiempo
// se entiende que la pestaña se cerró sin avisar.
const ACTIVE_WINDOW = "interval '3 minutes'";

router.get('/users', requireAdmin, async function (req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.username, u.name, u.role, u.fictitious, u.created_at,
             COUNT(s.id)::int AS session_count,
             MAX(s.last_seen_at) AS last_seen_at,
             COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(s.logout_at, s.last_seen_at) - s.login_at))), 0)::float AS total_seconds
        FROM users u
        LEFT JOIN sessions s ON s.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at ASC
    `);
    res.json(rows);
  } catch (e) {
    console.error('[admin] error al listar usuarios', e);
    res.status(500).json({ error: 'No se han podido cargar los usuarios.' });
  }
});

router.get('/sessions', requireAdmin, async function (req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.login_at, s.last_seen_at, s.logout_at, s.ip, s.user_agent,
             u.username, u.name, u.role,
             (s.logout_at IS NULL AND s.last_seen_at > now() - ${ACTIVE_WINDOW}) AS active,
             EXTRACT(EPOCH FROM (COALESCE(s.logout_at, s.last_seen_at) - s.login_at))::float AS duration_seconds
        FROM sessions s JOIN users u ON u.id = s.user_id
       ORDER BY s.login_at DESC
       LIMIT 200
    `);
    res.json(rows);
  } catch (e) {
    console.error('[admin] error al listar sesiones', e);
    res.status(500).json({ error: 'No se han podido cargar las sesiones.' });
  }
});

router.post('/users', requireAdmin, async function (req, res) {
  const username = String((req.body && req.body.username) || '').trim().toLowerCase();
  const name = String((req.body && req.body.name) || '').trim();
  const role = ['admin', 'supervisor', 'inspector'].indexOf(req.body && req.body.role) !== -1
    ? req.body.role : 'inspector';
  const password = String((req.body && req.body.password) || '');

  if (!username || !name || !password) {
    return res.status(400).json({ error: 'Indica usuario, nombre y contraseña.' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (username, name, role, password_hash, fictitious)
       VALUES ($1, $2, $3, $4, TRUE) RETURNING id, username, name, role, fictitious, created_at`,
      [username, name, role, hash]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ese usuario ya existe.' });
    console.error('[admin] error al crear usuario', e);
    res.status(500).json({ error: 'No se ha podido crear el usuario.' });
  }
});

// Recuperación de contraseña para cuentas que no son la tuya: no hay correo
// configurado, así que el administrador genera una contraseña nueva aquí y
// se la pasa a quien la necesite. Para el propio administrador, la vía es
// ADMIN_PASSWORD en las variables de entorno (ver server/seed.js).
router.post('/users/:id/reset-password', requireAdmin, async function (req, res) {
  try {
    const password = crypto.randomBytes(9).toString('base64url');
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING username, name`,
      [hash, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ese usuario no existe.' });
    res.json({ username: rows[0].username, name: rows[0].name, password: password });
  } catch (e) {
    console.error('[admin] error al restablecer contraseña', e);
    res.status(500).json({ error: 'No se ha podido restablecer la contraseña.' });
  }
});

router.delete('/users/:id', requireAdmin, async function (req, res) {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[admin] error al borrar usuario', e);
    res.status(500).json({ error: 'No se ha podido borrar el usuario.' });
  }
});

module.exports = router;
