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

    -- Un registro por cada vez que alguien deja una pantalla del menú: cuánto
    -- tiempo estuvo. Se agrega en server/routes/admin.js para el mapa de
    -- calor de actividad por usuario.
    CREATE TABLE IF NOT EXISTS nav_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      route TEXT NOT NULL,
      seconds INTEGER NOT NULL DEFAULT 0,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS nav_events_user_id_idx ON nav_events(user_id);

    -- Qué versiones de la aplicación puede usar cada persona: Safety Desk (gestión,
    -- en ordenador) y Safety Go (campo). NULL = valor por defecto según el rol
    -- (ver accessFrom en server/auth.js): así no hace falta tocar las cuentas
    -- existentes y un cambio hecho a mano desde el panel de accesos no se pisa
    -- en el siguiente arranque.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS access_desk BOOLEAN;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS access_go BOOLEAN;

    -- Duración de inactividad propia de cada sesión: la WebApp de campo
    -- necesita ventanas más largas que los 30 minutos del navegador de
    -- escritorio (el móvil se bloquea en el bolsillo entre una ronda y otra).
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS idle_minutes INTEGER;

    -- Datos de trabajo compartidos entre la APP principal y la WebApp de
    -- campo. Cada fila es un documento de uno de los almacenes que antes solo
    -- vivían en IndexedDB (visits, deviations, actions, forms…).
    --   seq        contador global creciente: los clientes piden "todo lo que
    --              haya cambiado desde seq N" (ver server/routes/sync.js)
    --   deleted    las bajas se guardan como lápida para que se propaguen
    --   last_device / echo: permiten no devolver a un dispositivo lo que
    --              acaba de subir él mismo, salvo que el servidor lo haya
    --              fusionado con cambios de otro
    CREATE SEQUENCE IF NOT EXISTS docs_seq;
    CREATE TABLE IF NOT EXISTS docs (
      store TEXT NOT NULL,
      id TEXT NOT NULL,
      data JSONB,
      deleted BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      seq BIGINT NOT NULL DEFAULT nextval('docs_seq'),
      last_device TEXT,
      echo BOOLEAN NOT NULL DEFAULT FALSE,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      PRIMARY KEY (store, id)
    );
    CREATE INDEX IF NOT EXISTS docs_seq_idx ON docs(seq);

    -- Registro de informes enviados por correo desde el servidor.
    CREATE TABLE IF NOT EXISTS email_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      visit_id TEXT,
      recipients TEXT NOT NULL,
      subject TEXT,
      status TEXT NOT NULL,
      provider TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS email_log_user_idx ON email_log(user_id, created_at);
  `);
}

module.exports = { pool, initSchema };
