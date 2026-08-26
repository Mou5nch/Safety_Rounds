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
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

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
