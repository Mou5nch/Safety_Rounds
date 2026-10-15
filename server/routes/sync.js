/* ==========================================================================
   Safety Rounds — Sincronización de datos de trabajo
   --------------------------------------------------------------------------
   La APP principal y la WebApp de campo siguen trabajando contra su copia
   local (IndexedDB), que es lo que permite usarlas sin cobertura. Este
   servidor es el punto de encuentro: cada dispositivo sube sus cambios y baja
   los de los demás.

   · Un documento = una fila de `docs`, identificada por (store, id).
   · Cada escritura recibe un `seq` creciente. Los clientes piden "lo que ha
     cambiado desde el seq N" y así nunca descargan dos veces lo mismo.
   · Los conflictos se resuelven campo a campo (clave de primer nivel): si un
     técnico cierra una desviación desde la tablet mientras el administrador
     cambia su gravedad desde el ordenador, se conservan las dos cosas. Solo
     si ambos tocan la misma clave gana el último en subirla.
   · Las bajas viajan como lápida (`deleted`) para propagarse a los demás.
   ========================================================================== */
'use strict';

const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

const ALL_STORES = ['settings', 'folders', 'forms', 'visits', 'deviations', 'actions', 'catalogs', 'lists', 'files'];

// Qué almacenes puede modificar cada rol. Los inspectores trabajan en campo:
// realizan visitas y gestionan desviaciones y acciones, y pueden dar de alta
// elementos de una lista desde la propia visita, pero no tocan la
// configuración de cuestionarios ni los ajustes generales. Las cuentas de
// demostración ('usuario') no sincronizan: cada navegador tiene su copia.
const WRITABLE = {
  admin: ALL_STORES,
  supervisor: ALL_STORES,
  inspector: ['visits', 'deviations', 'actions', 'catalogs', 'files']
};

const PAGE_BYTES = 5 * 1024 * 1024;   // tope orientativo de cada página de descarga
const MAX_CHANGES = 400;              // cambios por petición de subida

function canSync(user) {
  return !!(user && WRITABLE[user.role]);
}

function requireSync(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No has iniciado sesión.' });
  if (!canSync(req.user)) {
    return res.status(403).json({ error: 'Las cuentas de demostración no sincronizan con el servidor.', code: 'demo' });
  }
  next();
}

function sameJson(a, b) {
  return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
}

function isoOrNow(v) {
  const t = Date.parse(v);
  if (isNaN(t)) return new Date();
  // Un reloj de móvil adelantado no debe ganar para siempre todos los conflictos.
  return new Date(Math.min(t, Date.now() + 5 * 60 * 1000));
}

/* --------------------------------------------------------------------------
   Aplicar un cambio dentro de una transacción
   -------------------------------------------------------------------------- */

async function applyChange(client, ch, user, device) {
  const store = ch.store, id = ch.id;
  const when = isoOrNow(ch.updatedAt);

  async function selectForUpdate() {
    const r = await client.query('SELECT * FROM docs WHERE store = $1 AND id = $2 FOR UPDATE', [store, id]);
    return r.rows[0] || null;
  }

  let cur = await selectForUpdate();

  if (!cur) {
    const ins = await client.query(
      `INSERT INTO docs (store, id, data, deleted, updated_at, seq, last_device, echo, updated_by)
       VALUES ($1, $2, $3, $4, $5, nextval('docs_seq'), $6, FALSE, $7)
       ON CONFLICT (store, id) DO NOTHING`,
      [store, id, ch.deleted ? null : JSON.stringify(ch.data), !!ch.deleted, when, device, user.id]
    );
    if (ins.rowCount === 1) return 'applied';
    cur = await selectForUpdate();   // otro dispositivo se nos adelantó con el mismo id
    if (!cur) return 'ignored';
  }

  const curTime = new Date(cur.updated_at).getTime();

  /* --- Baja --- */
  if (ch.deleted) {
    if (cur.deleted) return 'ignored';
    // Si alguien editó el documento después de que este dispositivo decidiera
    // borrarlo, la edición es más reciente y se respeta.
    if (curTime > when.getTime()) return 'ignored';
    await client.query(
      `UPDATE docs SET data = NULL, deleted = TRUE, updated_at = $3, seq = nextval('docs_seq'),
              last_device = $4, echo = FALSE, updated_by = $5
        WHERE store = $1 AND id = $2`,
      [store, id, when, device, user.id]
    );
    return 'applied';
  }

  /* --- Alta/edición sobre una lápida: solo resucita si es más reciente --- */
  if (cur.deleted) {
    if (when.getTime() <= curTime) return 'ignored';
    await client.query(
      `UPDATE docs SET data = $3, deleted = FALSE, updated_at = $4, seq = nextval('docs_seq'),
              last_device = $5, echo = FALSE, updated_by = $6
        WHERE store = $1 AND id = $2`,
      [store, id, JSON.stringify(ch.data), when, device, user.id]
    );
    return 'applied';
  }

  /* --- Edición sobre un documento vivo --- */
  const keys = Array.isArray(ch.changedKeys) ? ch.changedKeys : null;

  if (!keys) {
    // El dispositivo no conoce la versión base (documento nuevo para él):
    // gana el más reciente completo.
    if (when.getTime() < curTime) return 'ignored';
    await client.query(
      `UPDATE docs SET data = $3, updated_at = $4, seq = nextval('docs_seq'),
              last_device = $5, echo = FALSE, updated_by = $6
        WHERE store = $1 AND id = $2`,
      [store, id, JSON.stringify(ch.data), when, device, user.id]
    );
    return 'applied';
  }

  // Fusión por claves: se aplican solo las que este dispositivo ha cambiado.
  const base = cur.data || {};
  const merged = Object.assign({}, base);
  keys.forEach(function (k) {
    if (k === 'id') return;
    if (Object.prototype.hasOwnProperty.call(ch.data, k)) merged[k] = ch.data[k];
    else delete merged[k];
  });
  merged.updatedAt = new Date(Math.max(curTime, when.getTime())).toISOString();

  // ¿Lo fusionado difiere de lo que el dispositivo cree que tiene? Entonces
  // hay que devolvérselo en la siguiente descarga (echo).
  let echo = false;
  const all = Object.keys(Object.assign({}, merged, ch.data));
  for (let i = 0; i < all.length; i++) {
    const k = all[i];
    if (k === 'updatedAt') continue;
    if (!sameJson(merged[k], ch.data[k])) { echo = true; break; }
  }

  if (sameJson(merged, base)) return 'ignored';   // nada que escribir

  await client.query(
    `UPDATE docs SET data = $3, updated_at = $4, seq = nextval('docs_seq'),
            last_device = $5, echo = $6, updated_by = $7
      WHERE store = $1 AND id = $2`,
    [store, id, JSON.stringify(merged), new Date(merged.updatedAt), device, echo, user.id]
  );
  return 'applied';
}

/* --------------------------------------------------------------------------
   POST /api/sync/push
   -------------------------------------------------------------------------- */

router.post('/push', requireSync, async function (req, res) {
  const device = String((req.body && req.body.device) || '').slice(0, 64);
  const changes = (req.body && req.body.changes) || [];
  if (!device || !Array.isArray(changes)) return res.status(400).json({ error: 'Petición no válida.' });
  if (changes.length > MAX_CHANGES) return res.status(413).json({ error: 'Demasiados cambios en una sola petición.' });

  const allowed = WRITABLE[req.user.role];
  const results = [];
  const client = await pool.connect();

  try {
    for (let i = 0; i < changes.length; i++) {
      const ch = changes[i] || {};
      const ref = { store: ch.store, id: ch.id };

      if (ALL_STORES.indexOf(ch.store) === -1 || typeof ch.id !== 'string' || !ch.id || ch.id.length > 120) {
        results.push(Object.assign(ref, { result: 'invalid' }));
        continue;
      }
      if (allowed.indexOf(ch.store) === -1) {
        results.push(Object.assign(ref, { result: 'forbidden' }));
        continue;
      }
      if (!ch.deleted && (!ch.data || typeof ch.data !== 'object')) {
        results.push(Object.assign(ref, { result: 'invalid' }));
        continue;
      }

      // Una transacción por documento: un cambio defectuoso no tumba el resto.
      try {
        await client.query('BEGIN');
        const r = await applyChange(client, ch, req.user, device);
        await client.query('COMMIT');
        results.push(Object.assign(ref, { result: r }));
      } catch (e) {
        await client.query('ROLLBACK').catch(function () {});
        console.error('[sync] error al aplicar ' + ch.store + '/' + ch.id, e.message);
        results.push(Object.assign(ref, { result: 'error' }));
      }
    }
    res.json({ results: results });
  } finally {
    client.release();
  }
});

/* --------------------------------------------------------------------------
   GET /api/sync/pull?since=N&device=ID
   -------------------------------------------------------------------------- */

router.get('/pull', requireSync, async function (req, res) {
  const since = Math.max(0, parseInt(req.query.since, 10) || 0);
  const device = String(req.query.device || '').slice(0, 64);

  try {
    const { rows } = await pool.query(
      `SELECT store, id, data, deleted, seq, last_device, echo, pg_column_size(data) AS size
         FROM docs WHERE seq > $1 ORDER BY seq ASC LIMIT 400`,
      [since]
    );

    const docs = [];
    let bytes = 0, last = since, more = false;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const size = Number(r.size) || 0;
      if (docs.length && bytes + size > PAGE_BYTES) { more = true; break; }
      bytes += size;
      last = Number(r.seq);
      // Lo que el propio dispositivo acaba de subir (y que el servidor no ha
      // modificado) no se le devuelve: ya lo tiene.
      if (device && r.last_device === device && !r.echo) continue;
      docs.push({ store: r.store, id: r.id, data: r.deleted ? null : r.data, deleted: r.deleted, seq: Number(r.seq) });
    }
    if (!more && rows.length === 400) more = true;

    res.json({ docs: docs, last: last, more: more });
  } catch (e) {
    console.error('[sync] error en pull', e);
    res.status(500).json({ error: 'No se han podido descargar los cambios.' });
  }
});

/* GET /api/sync/head — seq más reciente (sirve para saber si hay algo nuevo sin descargarlo) */
router.get('/head', requireSync, async function (req, res) {
  try {
    const { rows } = await pool.query('SELECT COALESCE(MAX(seq), 0)::bigint AS head, COUNT(*)::int AS n FROM docs');
    res.json({ head: Number(rows[0].head), docs: rows[0].n });
  } catch (e) {
    res.status(500).json({ error: 'No se ha podido consultar el estado.' });
  }
});

module.exports = router;
module.exports.canSync = canSync;
