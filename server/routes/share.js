/* ==========================================================================
   Safety Rounds — Enlaces compartidos
   Guarda una instantánea (visita, cuestionario…) ya resuelta en el
   dispositivo del inspector y expone un enlace público de solo lectura.
   ========================================================================== */
'use strict';

const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

var TYPES = ['visit', 'questionnaire', 'report'];

function shortId() {
  // Base62 de 10 caracteres: suficiente margen frente a colisiones para el
  // volumen de enlaces que genera un departamento de Safety & Health.
  var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var bytes = crypto.randomBytes(10);
  var out = '';
  for (var i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

router.post('/', requireAuth, async function (req, res) {
  const type = TYPES.indexOf(req.body && req.body.type) !== -1 ? req.body.type : 'visit';
  const title = String((req.body && req.body.title) || '').slice(0, 200);
  const payload = req.body && req.body.payload;

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Faltan los datos a compartir.' });
  }

  try {
    var id = shortId();
    await pool.query(
      `INSERT INTO shares (id, type, title, payload, created_by) VALUES ($1, $2, $3, $4, $5)`,
      [id, type, title, JSON.stringify(payload), req.user.id]
    );
    res.status(201).json({ id: id, url: '/r/' + id });
  } catch (e) {
    console.error('[share] error al crear enlace', e);
    res.status(500).json({ error: 'No se ha podido generar el enlace.' });
  }
});

router.get('/:id', async function (req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, type, title, payload, created_at, revoked FROM shares WHERE id = $1`,
      [req.params.id]
    );
    const row = rows[0];
    if (!row || row.revoked) return res.status(404).json({ error: 'Este enlace no existe o ha sido revocado.' });
    res.json(row);
  } catch (e) {
    console.error('[share] error al leer enlace', e);
    res.status(500).json({ error: 'No se ha podido cargar el informe.' });
  }
});

router.delete('/:id', requireAuth, async function (req, res) {
  try {
    const { rows } = await pool.query('SELECT created_by FROM shares WHERE id = $1', [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Ese enlace no existe.' });
    if (row.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo quien creó el enlace puede revocarlo.' });
    }
    await pool.query('UPDATE shares SET revoked = TRUE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[share] error al revocar enlace', e);
    res.status(500).json({ error: 'No se ha podido revocar el enlace.' });
  }
});

module.exports = router;
