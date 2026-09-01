/* ==========================================================================
   Safety Rounds — Servidor
   Sirve la aplicación estática (igual que antes) y añade la API necesaria
   para los enlaces compartidos y el seguimiento de acceso de usuarios.
   La aplicación sigue guardando los datos de trabajo en el dispositivo
   (IndexedDB): este servidor solo entra en juego para compartir informes y
   para el inicio de sesión.
   ========================================================================== */
'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { pool, initSchema } = require('./db');
const { seedUsers } = require('./seed');
const { attachUser } = require('./auth');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const shareRoutes = require('./routes/share');
const trackRoutes = require('./routes/track');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

const app = express();
app.set('trust proxy', 1); // Railway va detrás de un proxy: así req.ip es el real

app.use(express.json({ limit: '20mb' })); // las visitas con fotos pueden pesar varios MB
app.use(cookieParser());
app.use(attachUser);

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/track', trackRoutes);

// Diagnóstico rápido de la conexión a Postgres: abre esta URL en el
// navegador para saber, sin mirar logs, si la base de datos responde.
// No expone credenciales; solo si conecta o no y, si falla, el motivo.
app.get('/api/health', async function (req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ db: 'error', reason: 'DATABASE_URL no está definida en este servicio.' });
  }
  try {
    await pool.query('SELECT 1');
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users').catch(function () { return { rows: [{ n: null }] }; });
    res.json({ db: 'ok', users: rows[0].n });
  } catch (e) {
    res.status(503).json({ db: 'error', reason: e.message, code: e.code || null });
  }
});

// Enlace amigable /r/<id> → sirve la página que llama a /api/share/:id
app.get('/r/:id', function (req, res) {
  res.sendFile(path.join(ROOT, 'report.html'));
});

app.use(express.static(ROOT, { extensions: ['html'] }));

app.use(function (req, res) {
  res.status(404).sendFile(path.join(ROOT, 'index.html'));
});

async function start() {
  try {
    await initSchema();
    await seedUsers();
  } catch (e) {
    console.error('[server] no se ha podido preparar la base de datos.');
    console.error('[server] mensaje: ' + e.message + (e.code ? ' (código: ' + e.code + ')' : ''));
    console.error('[server] revisa que el plugin PostgreSQL esté añadido y que DATABASE_URL apunte a él (no al valor de ejemplo de .env.example).');
  }
  app.listen(PORT, function () {
    console.log('[server] Safety Rounds escuchando en el puerto ' + PORT);
  });
}

start();
