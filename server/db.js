/* ==========================================================================
   Safety Rounds — Conexión a Postgres y esquema
   Railway inyecta DATABASE_URL automáticamente al añadir el plugin Postgres
   al proyecto. El esquema se crea solo al arrancar (CREATE TABLE IF NOT
   EXISTS): no hay migraciones que ejecutar a mano.
   ========================================================================== */
'use strict';

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn(
    '[db] No hay DATABASE_URL configurada. Añade el plugin PostgreSQL en el ' +
    'proyecto de Railway: la variable se inyecta sola y solo hace falta volver a desplegar.'
  );
} else if (process.env.DATABASE_URL.indexOf('${{') !== -1) {
  console.warn(
    '[db] DATABASE_URL contiene "${{...}}" sin resolver: eso es una referencia de Railway ' +
    '(válida solo dentro de Railway) o quedó copiada literal de .env.example. ' +
    'En local, sustitúyela por una URL real; en Railway, revisa que el nombre del servicio ' +
    'de Postgres en la referencia coincida con el que aparece en tu proyecto.'
  );
} else {
  // Nunca se registra la contraseña: solo host/puerto/base, para poder
  // comprobar en los logs de Railway a qué Postgres se está intentando
  // conectar sin exponer credenciales.
  try {
    var u = new URL(process.env.DATABASE_URL);
    console.log('[db] Conectando a ' + u.hostname + ':' + (u.port || '5432') + u.pathname + ' (SSL: ' + (process.env.PGSSL === 'true' ? 'sí' : 'no') + ')');
  } catch (e) { /* URL rara: se deja que pg dé su propio error más abajo */ }
}

// La URL interna que Railway da entre servicios del mismo proyecto
// (host *.railway.internal) no habla SSL: forzarlo ahí hace que la conexión
// falle. Por eso aquí SSL está desactivado por defecto, y solo se activa si
// se define PGSSL=true (por ejemplo, para conectar a un Postgres externo
// como Supabase, que si lo exige).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('error', function (err) {
  console.error('[db] error inesperado en el pool de Postgres', err);
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'inspector',
      password_hash TEXT NOT NULL,
      fictitious BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      email TEXT
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

    CREATE TABLE IF NOT EXISTS password_resets (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets(user_id);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      logout_at TIMESTAMPTZ,
      ip TEXT,
      user_agent TEXT
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT,
      payload JSONB NOT NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      revoked BOOLEAN NOT NULL DEFAULT FALSE
    );
  `);
}

module.exports = { pool, initSchema };
