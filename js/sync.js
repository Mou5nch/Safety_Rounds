/* ==========================================================================
   Safety Rounds — Sincronización con el servidor
   --------------------------------------------------------------------------
   Lo comparten la APP principal y la WebApp de campo (/campo).

   Principio de funcionamiento
   · Cada dispositivo sigue trabajando contra su copia local (IndexedDB), así
     que todo funciona sin cobertura. Sync se limita a ponerse al día con el
     servidor cuando hay red.
   · SUBIDA: cada cambio local se anota en una cola persistente. Al subirlo se
     envían solo las claves de primer nivel que han cambiado desde la última
     versión conocida del servidor; el servidor las fusiona con lo que haya
     hecho otra persona entre tanto (ver server/routes/sync.js).
   · BAJADA: se piden los documentos con `seq` mayor que el último recibido.
     Si el documento recibido choca con un cambio local aún sin subir, se
     conservan las claves que cambió este dispositivo y se toman del servidor
     las demás.
   · Las cuentas de demostración ('usuario') no sincronizan.
   ========================================================================== */
(function (global) {
  'use strict';

  var ENABLED_ROLES = ['admin', 'supervisor', 'inspector'];
  var POLL_MS = 30 * 1000;
  var PUSH_DELAY_MS = 2500;
  var BATCH_BYTES = 6 * 1024 * 1024;
  var BATCH_MAX = 200;
  // De los ajustes generales solo viajan los que tienen sentido para todos
  // (ver Store.SHARED_SETTINGS); el resto es de cada dispositivo.
  var SETTINGS_KEYS = Store.SHARED_SETTINGS;

  var st = {
    enabled: false,
    started: false,
    status: 'off',          // off | idle | syncing | synced | pending | offline | auth | error
    running: false,
    again: false,
    device: null,
    since: 0,
    lastSync: null,
    lastError: '',
    queue: {},              // 'store:id' → { id, store, rid, op, n, t }
    pushTimer: null,
    pollTimer: null,
    statusFns: [],
    remoteFns: [],
    authFns: []
  };

  /* ---------- Utilidades ---------- */

  function role() {
    try {
      var a = JSON.parse(localStorage.getItem('sr:auth') || 'null');
      return a && a.role;
    } catch (e) { return null; }
  }

  function enabledForUser() {
    return ENABLED_ROLES.indexOf(role()) !== -1 && Store.mode === 'idb';
  }

  function h32(str, seed) {
    var h = seed;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function hashVal(v) {
    var s = JSON.stringify(v === undefined ? null : v);
    return h32(s, 2166136261).toString(36) + h32(s, 0x9747b28c).toString(36) + s.length.toString(36);
  }

  function hashDoc(doc) {
    var out = {};
    Object.keys(doc).forEach(function (k) { out[k] = hashVal(doc[k]); });
    return out;
  }

  function changedKeys(doc, baseHashes) {
    var keys = [];
    var now = hashDoc(doc);
    Object.keys(now).forEach(function (k) { if (now[k] !== baseHashes[k]) keys.push(k); });
    Object.keys(baseHashes).forEach(function (k) { if (!(k in now)) keys.push(k); });
    return { keys: keys, hashes: now };
  }

  function pick(doc, keys) {
    var out = { id: doc.id };
    keys.forEach(function (k) { if (k in doc) out[k] = doc[k]; });
    return out;
  }

  function qKey(store, id) { return store + ':' + id; }
  function baseOf(key) { var r = Store.meta.get('h:' + key); return r ? r.h : null; }
  function setBase(key, hashes) { Store.meta.put({ id: 'h:' + key, h: hashes }); }

  function setStatus(s, err) {
    st.status = s;
    st.lastError = err || '';
    notify();
  }

  /** Avisa a quien pinte el estado (chip, contador) sin cambiar el estado en sí. */
  function notify() {
    st.statusFns.forEach(function (fn) { try { fn(snapshot()); } catch (e) {} });
  }

  function snapshot() {
    return {
      status: st.status, enabled: st.enabled, pending: pendingCount(),
      lastSync: st.lastSync, error: st.lastError, online: navigator.onLine !== false
    };
  }

  function pendingCount() { return Object.keys(st.queue).length; }

  function saveState() {
    Store.meta.put({ id: 'state', since: st.since, device: st.device, initialized: true, lastSync: st.lastSync });
  }

  function deviceId() {
    var id = null;
    try { id = localStorage.getItem('sr:device'); } catch (e) {}
    if (!id) {
      id = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem('sr:device', id); } catch (e) {}
    }
    return id;
  }

  /* ---------- HTTP ---------- */

  function http(method, path, body) {
    return fetch(path, {
      method: method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      if (res.status === 401) { var e = new Error('auth'); e.auth = true; throw e; }
      if (res.status === 403) { var e2 = new Error('forbidden'); e2.forbidden = true; throw e2; }
      if (!res.ok) { var e3 = new Error('HTTP ' + res.status); e3.http = res.status; throw e3; }
      return res.json();
    });
  }

  /* ---------- Cola de cambios locales ---------- */

  function enqueue(store, id, op) {
    if (!st.enabled) return;
    var key = qKey(store, id);
    var prev = st.queue[key];
    var rec = { id: 'q:' + key, store: store, rid: id, op: op, n: prev ? prev.n + 1 : 1, t: new Date().toISOString() };
    st.queue[key] = rec;
    Store.meta.put(rec);
    schedulePush();
    notify();      // el contador de pendientes cambia aunque el estado siga siendo «sin conexión»
  }

  function dequeue(key, n) {
    var cur = st.queue[key];
    if (!cur || (n !== undefined && cur.n !== n)) return;   // se volvió a tocar mientras subía
    delete st.queue[key];
    Store.meta.del('q:' + key);
    notify();
  }

  function schedulePush() {
    clearTimeout(st.pushTimer);
    st.pushTimer = setTimeout(function () { now(); }, PUSH_DELAY_MS);
    if (st.status === 'synced' || st.status === 'idle') setStatus('pending');
  }

  function markAllDirty() {
    Store.STORES.forEach(function (s) {
      Store.all(s).forEach(function (r) { enqueue(s, r.id, 'put'); });
    });
  }

  /* ---------- Subida ---------- */

  function buildChange(q) {
    var key = qKey(q.store, q.rid);

    if (q.op === 'del') {
      return { change: { store: q.store, id: q.rid, deleted: true, updatedAt: q.t }, key: key, n: q.n, hashes: null };
    }

    var doc = Store.get(q.store, q.rid);
    if (!doc) return { skip: true, key: key, n: q.n };

    var data = q.store === 'settings' ? pick(doc, SETTINGS_KEYS.concat(['updatedAt'])) : doc;
    var base = baseOf(key);
    var keys = null, hashes;

    if (base) {
      var diff = changedKeys(data, base);
      // Un cambio que solo toca la marca de fecha no es un cambio real
      if (!diff.keys.filter(function (k) { return k !== 'updatedAt'; }).length) return { skip: true, key: key, n: q.n };
      keys = diff.keys; hashes = diff.hashes;
    } else {
      hashes = hashDoc(data);
    }

    return {
      change: { store: q.store, id: q.rid, data: data, changedKeys: keys, updatedAt: doc.updatedAt || q.t },
      key: key, n: q.n, hashes: hashes
    };
  }

  function push(done) {
    done = done || {};
    var entries = Object.keys(st.queue).map(function (k) { return st.queue[k]; })
      .filter(function (q) { return !done[qKey(q.store, q.rid)]; })
      .sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; });
    if (!entries.length) return Promise.resolve();

    var batch = [], bytes = 0, i = 0;
    for (; i < entries.length && batch.length < BATCH_MAX; i++) {
      var built = buildChange(entries[i]);
      if (built.skip) { dequeue(built.key, built.n); continue; }
      var size = built.change.data ? JSON.stringify(built.change.data).length : 100;
      if (batch.length && bytes + size > BATCH_BYTES) break;
      bytes += size;
      batch.push(built);
    }
    var more = i < entries.length;
    if (!batch.length) return more ? push(done) : Promise.resolve();

    // Cada documento se intenta una sola vez por ciclo: si el servidor falla
    // con uno, no puede atascar al resto ni provocar un bucle.
    batch.forEach(function (b) { done[b.key] = true; });

    return http('POST', '/api/sync/push', {
      device: st.device,
      changes: batch.map(function (b) { return b.change; })
    }).then(function (res) {
      var results = res.results || [];
      batch.forEach(function (b, idx) {
        var r = (results[idx] || {}).result;
        if (r === 'applied') {
          if (b.hashes) setBase(b.key, b.hashes); else Store.meta.del('h:' + b.key);
          dequeue(b.key, b.n);
        } else if (r === 'ignored' || r === 'forbidden' || r === 'invalid') {
          // 'ignored': el servidor tiene algo más reciente, llegará en la bajada.
          // 'forbidden'/'invalid': no se va a aceptar nunca; se descarta de la cola.
          dequeue(b.key, b.n);
        }
        // 'error' → se deja en cola y se reintenta en el siguiente ciclo
      });
      return more ? push(done) : null;
    });
  }

  /* ---------- Bajada ---------- */

  function applyDoc(doc) {
    var store = doc.store, id = doc.id, key = qKey(store, id);
    var local = Store.get(store, id);
    var dirty = !!st.queue[key];

    if (store === 'settings') {
      if (doc.deleted || !doc.data) return;
      var cur = Store.settings();
      var changed = false;
      SETTINGS_KEYS.forEach(function (k) {
        if (k in doc.data && JSON.stringify(cur[k]) !== JSON.stringify(doc.data[k])) { cur[k] = doc.data[k]; changed = true; }
      });
      if (changed) Store.applyRemote('settings', cur.id, cur);
      // Versión base: lo que el servidor tiene ahora, para que la próxima subida
      // lleve solo lo que el usuario cambie de verdad.
      var snap = pick(cur, SETTINGS_KEYS.concat(['updatedAt']));
      snap.updatedAt = doc.data.updatedAt;
      setBase(key, hashDoc(snap));
      return changed ? store : null;
    }

    if (doc.deleted) {
      if (local && !dirty) {
        Store.applyRemote(store, id, null);
        Store.meta.del('h:' + key);
        return store;
      }
      return null;       // hay cambios locales sin subir: la subida decide quién gana
    }

    var remote = doc.data;
    if (!remote) return null;

    if (!local || !dirty) {
      Store.applyRemote(store, id, remote);
      setBase(key, hashDoc(remote));
      return store;
    }

    // Cambio local pendiente + versión nueva del servidor: se conservan las
    // claves que este dispositivo ha tocado y se toma el resto del servidor.
    var base = baseOf(key);
    if (!base) {
      // documento creado aquí y existente allí a la vez: gana el más reciente
      if ((local.updatedAt || '') >= (remote.updatedAt || '')) return null;
      Store.applyRemote(store, id, remote);
      setBase(key, hashDoc(remote));
      dequeue(key);
      return store;
    }
    var mine = changedKeys(local, base).keys;
    var merged = {};
    Object.keys(remote).forEach(function (k) { merged[k] = remote[k]; });
    mine.forEach(function (k) {
      if (k in local) merged[k] = local[k]; else delete merged[k];
    });
    Store.applyRemote(store, id, merged);
    setBase(key, hashDoc(remote));
    return store;
  }

  function pull() {
    var touched = {};
    var total = 0;

    function page() {
      return http('GET', '/api/sync/pull?since=' + st.since + '&device=' + encodeURIComponent(st.device)).then(function (res) {
        (res.docs || []).forEach(function (d) {
          var s = applyDoc(d);
          if (s) { touched[s] = true; total++; }
        });
        if (res.last > st.since) { st.since = res.last; saveState(); }
        return res.more ? page() : null;
      });
    }

    return page().then(function () {
      if (total) st.remoteFns.forEach(function (fn) { try { fn(Object.keys(touched)); } catch (e) {} });
    });
  }

  /* ---------- Ciclo ---------- */

  function now() {
    if (!st.enabled || !st.started) return Promise.resolve();
    if (st.running) { st.again = true; return Promise.resolve(); }
    if (navigator.onLine === false) { setStatus('offline'); return Promise.resolve(); }

    clearTimeout(st.pushTimer);
    st.running = true;
    setStatus('syncing');

    return push().then(pull).then(function () {
      st.lastSync = new Date().toISOString();
      saveState();
      return global.Mailer && Mailer.flush ? Mailer.flush() : null;
    }).then(function () {
      setStatus(pendingCount() ? 'pending' : 'synced');
    }).catch(function (e) {
      if (e && e.auth) { setStatus('auth'); st.authFns.forEach(function (fn) { fn(); }); }
      else if (e && e.forbidden) setStatus('off', 'Esta cuenta no sincroniza.');
      else if (navigator.onLine === false || (e && e.name === 'TypeError')) setStatus('offline');
      else setStatus('error', (e && e.message) || 'Error de sincronización');
    }).then(function () {
      st.running = false;
      if (st.again) { st.again = false; schedulePush(); }
    });
  }

  /* ---------- Primera sincronización de un dispositivo ---------- */

  /**
   * Un dispositivo que ya tenía datos de la versión sin servidor (pruebas o
   * demostración) los guarda en una copia previa y empieza limpio con lo del
   * servidor. Un dispositivo nuevo, en cambio, sube lo poco que ya tenga.
   */
  function bootstrap() {
    return http('GET', '/api/sync/head').then(function () {
      var presync = false;
      try { presync = localStorage.getItem('sr:presync') === '1'; } catch (e) {}

      var hasData = Store.STORES.some(function (s) {
        return s !== 'settings' && Store.all(s).some(function (r) { return r.createdAt !== Store.EPOCH; });
      });

      var step = Promise.resolve();
      if (presync && hasData) {
        step = Store.meta.putBackup(Store.exportAll()).then(function () {
          Store.STORES.forEach(function (s) {
            if (s !== 'settings') Store.clearStore(s, { quiet: true });
          });
        });
      }
      return step.then(function () {
        Store.meta.clear('q:'); Store.meta.clear('h:');
        st.queue = {};
        st.since = 0;
        try { localStorage.removeItem('sr:presync'); } catch (e) {}
        saveState();
        if (!(presync && hasData)) markAllDirty();   // dispositivo nuevo: sube lo que tenga
        return pull();
      });
    });
  }

  /* ---------- Arranque ---------- */

  /**
   * Devuelve una promesa que se cumple cuando el dispositivo está listo para
   * trabajar: ya bajó lo del servidor, o no puede (sin red / sin sincronización)
   * y seguirá con lo que tenga en local.
   */
  function start() {
    st.enabled = enabledForUser();
    if (!st.enabled) { setStatus('off'); return Promise.resolve(false); }
    if (st.started) return Promise.resolve(true);

    st.device = deviceId();
    var state = Store.meta.get('state');
    Store.meta.all('q:').forEach(function (q) { st.queue[qKey(q.store, q.rid)] = q; });
    st.since = state ? state.since || 0 : 0;
    st.lastSync = state ? state.lastSync || null : null;

    Store.onChange(enqueue);
    st.started = true;

    window.addEventListener('online', function () { now(); });
    window.addEventListener('offline', function () { setStatus('offline'); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') now();
    });
    st.pollTimer = setInterval(function () {
      if (document.visibilityState === 'visible') now();
    }, POLL_MS);

    if (state && state.initialized) {
      setStatus(pendingCount() ? 'pending' : 'idle');
      // Primera comprobación con el servidor sin retrasar el arranque de la pantalla
      var first = now();
      return navigator.onLine === false ? Promise.resolve(true) : Promise.race([
        first, new Promise(function (r) { setTimeout(r, 4000); })
      ]).then(function () { return true; });
    }

    // Aún no se había sincronizado nunca en este dispositivo
    if (navigator.onLine === false) {
      setStatus('offline');
      var retry = function () {
        window.removeEventListener('online', retry);
        initialSync();
      };
      window.addEventListener('online', retry);
      return Promise.resolve(true);
    }
    return initialSync().then(function () { return true; });
  }

  function initialSync() {
    setStatus('syncing');
    st.running = true;
    return bootstrap().then(function () {
      st.lastSync = new Date().toISOString();
      saveState();
      setStatus(pendingCount() ? 'pending' : 'synced');
      st.running = false;
      if (pendingCount()) schedulePush();
      st.remoteFns.forEach(function (fn) { try { fn(Store.STORES); } catch (e) {} });
    }).catch(function (e) {
      st.running = false;
      if (e && e.auth) { setStatus('auth'); st.authFns.forEach(function (fn) { fn(); }); }
      else if (navigator.onLine === false || (e && e.name === 'TypeError')) setStatus('offline');
      else setStatus('error', (e && e.message) || 'No se ha podido sincronizar');
    });
  }

  /** Vuelve a bajar todo desde cero (conservando lo pendiente de subir). */
  function resync() {
    st.since = 0;
    saveState();
    return now();
  }

  /**
   * Cuenta de demostración en un dispositivo que había sincronizado antes:
   * se limpia todo rastro de la copia compartida para que los datos de
   * demostración no se mezclen con los reales ni lleguen al servidor.
   */
  function resetForDemo() {
    var state = Store.meta.get('state');
    if (!state) return false;
    Store.STORES.forEach(function (s) { Store.clearStore(s, { quiet: true }); });
    Store.meta.clear();
    return true;
  }

  global.Sync = {
    start: start,
    now: now,
    resync: resync,
    resetForDemo: resetForDemo,
    enabled: function () { return st.enabled; },
    ready: function () { var s = Store.meta.get('state'); return !!(s && s.initialized); },
    enabledForUser: enabledForUser,
    status: snapshot,
    pending: pendingCount,
    // Devuelve la función que da de baja la suscripción (para las pantallas que se abren y cierran)
    on: function (fn) {
      st.statusFns.push(fn);
      return function () { st.statusFns = st.statusFns.filter(function (f) { return f !== fn; }); };
    },
    onRemote: function (fn) { st.remoteFns.push(fn); },
    onAuthLost: function (fn) { st.authFns.push(fn); },
    getBackup: function () { return Store.meta.getBackup(); },
    ENABLED_ROLES: ENABLED_ROLES
  };
})(window);
