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
const { requireAdmin, accessFrom } = require('../auth');

const router = express.Router();

// Una sesión sin cierre explícito se considera "activa" mientras haya
// habido un latido (heartbeat) en los últimos 3 minutos; pasado ese tiempo
// se entiende que la pestaña se cerró sin avisar.
const ACTIVE_WINDOW = "interval '3 minutes'";

router.get('/users', requireAdmin, async function (req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.username, u.name, u.role, u.fictitious, u.email, u.created_at,
             u.access_desk, u.access_go,
             COUNT(s.id)::int AS session_count,
             MAX(s.last_seen_at) AS last_seen_at,
             COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(s.logout_at, s.last_seen_at) - s.login_at))), 0)::float AS total_seconds
        FROM users u
        LEFT JOIN sessions s ON s.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at ASC
    `);
    res.json(rows.map(function (r) {
      r.access = accessFrom(r);
      delete r.access_desk; delete r.access_go;
      return r;
    }));
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
  const role = ['admin', 'supervisor', 'inspector', 'usuario'].indexOf(req.body && req.body.role) !== -1
    ? req.body.role : 'inspector';
  const password = String((req.body && req.body.password) || '');
  const email = String((req.body && req.body.email) || '').trim().toLowerCase() || null;

  if (!username || !name || !password) {
    return res.status(400).json({ error: 'Indica usuario, nombre y contraseña.' });
  }

  // Acceso a Safety Desk / Safety Go: si no se indica, el valor por defecto del rol
  const acc = req.body && req.body.access;
  const wants = acc && typeof acc === 'object'
    ? { desk: acc.desk !== false, go: acc.go !== false } : null;
  const finalAccess = wants ? accessFrom({ role: role, access_desk: wants.desk, access_go: wants.go }) : null;
  if (wants && !wants.desk && !wants.go) {
    return res.status(400).json({ error: 'Cada usuario necesita acceso al menos a Safety Desk o a Safety Go.' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (username, name, role, password_hash, fictitious, email, access_desk, access_go)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7)
       RETURNING id, username, name, role, fictitious, email, created_at, access_desk, access_go`,
      [username, name, role, hash, email, finalAccess ? finalAccess.desk : null, finalAccess ? finalAccess.go : null]
    );
    rows[0].access = accessFrom(rows[0]);
    delete rows[0].access_desk; delete rows[0].access_go;
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ese usuario ya existe.' });
    console.error('[admin] error al crear usuario', e);
    res.status(500).json({ error: 'No se ha podido crear el usuario.' });
  }
});

// Quién puede usar Safety Desk (gestión) y Safety Go (campo).
router.patch('/users/:id/access', requireAdmin, async function (req, res) {
  const desk = req.body && req.body.desk;
  const go = req.body && req.body.go;
  if (typeof desk !== 'boolean' || typeof go !== 'boolean') {
    return res.status(400).json({ error: 'Indica el acceso a Safety Desk y a Safety Go.' });
  }
  if (!desk && !go) {
    return res.status(400).json({ error: 'Cada usuario necesita acceso al menos a Safety Desk o a Safety Go.' });
  }
  try {
    const cur = await pool.query('SELECT id, role FROM users WHERE id = $1', [req.params.id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Ese usuario no existe.' });
    if (cur.rows[0].role === 'admin' && !desk) {
      return res.status(400).json({ error: 'La administración siempre mantiene el acceso a Safety Desk: es desde donde se gestionan los accesos.' });
    }
    const { rows } = await pool.query(
      'UPDATE users SET access_desk = $2, access_go = $3 WHERE id = $1 RETURNING role, access_desk, access_go',
      [req.params.id, desk, go]
    );
    res.json({ access: accessFrom(rows[0]) });
  } catch (e) {
    console.error('[admin] error al cambiar el acceso', e);
    res.status(500).json({ error: 'No se ha podido cambiar el acceso.' });
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

// Tiempo y número de veces que un usuario ha estado en cada pantalla del
// menú, para el mapa de calor de actividad del panel de accesos.
router.get('/users/:id/activity', requireAdmin, async function (req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT route, COUNT(*)::int AS visits, COALESCE(SUM(seconds), 0)::int AS seconds
         FROM nav_events
        WHERE user_id = $1
        GROUP BY route`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    console.error('[admin] error al cargar la actividad del usuario', e);
    res.status(500).json({ error: 'No se ha podido cargar la actividad.' });
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
