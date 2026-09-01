/* ==========================================================================
   Safety Rounds — Seguimiento de navegación
   Cada vez que alguien deja una pantalla del menú, el cliente manda cuánto
   tiempo estuvo en ella. Se agrega por usuario para el mapa de calor de
   actividad del panel de accesos (server/routes/admin.js).
   ========================================================================== */
'use strict';

const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// Mismas rutas que el menú principal (js/app.js ROUTES): una lista cerrada
// evita que lleguen valores arbitrarios a la base de datos.
const KNOWN_ROUTES = ['dashboard', 'cuestionarios', 'historico', 'desviaciones', 'acciones', 'configuracion', 'ajustes'];
const MAX_SECONDS = 3600; // una permanencia más larga se recorta, no se descarta

router.post('/nav', requireAuth, async function (req, res) {
  const route = String((req.body && req.body.route) || '');
  const seconds = Math.round(Number(req.body && req.body.seconds));

  if (KNOWN_ROUTES.indexOf(route) === -1 || !isFinite(seconds) || seconds < 1) {
    return res.status(204).end();
  }

  try {
    await pool.query(
      `INSERT INTO nav_events (user_id, route, seconds) VALUES ($1, $2, $3)`,
      [req.user.id, route, Math.min(seconds, MAX_SECONDS)]
    );
  } catch (e) {
    console.error('[track] error al registrar navegación', e);
  }
  res.status(204).end();
});

module.exports = router;
