/* ==========================================================================
   Safety Rounds — Cuentas iniciales
   Dos cosas distintas que conviene no mezclar:
   · El administrador real (mou5nch@gmail.com por defecto): la persona que
     de verdad va a entrar en el panel de accesos. Se crea una sola vez.
   · Los usuarios ficticios de demostración: cuentas de prueba para ver
     cómo se registra el acceso y el tiempo de conexión en el panel.
   Ambas cosas se saltan si la cuenta ya existe, así que es seguro llamarlas
   en cada arranque.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const { pool } = require('./db');
const { hashPassword } = require('./auth');

const DEMO_PASSWORD = process.env.SEED_USERS_PASSWORD || 'Rondas2026!';

const DEMO_USERS = [
  { username: 'ana.garcia', name: 'Ana García', role: 'supervisor' },
  { username: 'carlos.ruiz', name: 'Carlos Ruiz', role: 'inspector' },
  { username: 'maria.lopez', name: 'María López', role: 'inspector' }
];

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'mou5nch@gmail.com').trim().toLowerCase();
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador';

async function ensureRealAdmin() {
  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [ADMIN_EMAIL]);
  if (rows.length) return;

  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  const hash = await hashPassword(password);

  await pool.query(
    `INSERT INTO users (username, name, role, password_hash, fictitious) VALUES ($1, $2, 'admin', $3, FALSE)`,
    [ADMIN_EMAIL, ADMIN_NAME, hash]
  );

  console.log('[seed] Administrador creado: ' + ADMIN_EMAIL);
  if (generated) {
    console.log('[seed] Contraseña generada automáticamente (apúntala, no volverá a salir en los logs): ' + password);
    console.log('[seed] Para fijar tú la contraseña, define ADMIN_PASSWORD en las variables de entorno de Railway y vuelve a desplegar.');
  } else {
    console.log('[seed] Contraseña tomada de la variable de entorno ADMIN_PASSWORD.');
  }
}

async function seedDemoUsers() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users WHERE fictitious = TRUE');
  if (rows[0].n > 0) return;

  for (const u of DEMO_USERS) {
    const hash = await hashPassword(DEMO_PASSWORD);
    await pool.query(
      `INSERT INTO users (username, name, role, password_hash, fictitious) VALUES ($1, $2, $3, $4, TRUE)`,
      [u.username, u.name, u.role, hash]
    );
  }

  console.log('[seed] Usuarios ficticios creados: ' + DEMO_USERS.map(function (u) { return u.username; }).join(', '));
  console.log('[seed] Contraseña de todos: ' + DEMO_PASSWORD + ' (cámbiala definiendo SEED_USERS_PASSWORD antes del primer arranque).');
}

async function seedUsers() {
  await ensureRealAdmin();
  await seedDemoUsers();
}

module.exports = { seedUsers };
