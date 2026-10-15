/* ==========================================================================
   Safety Rounds — Capa de datos
   IndexedDB como almacén principal, con degradación automática a localStorage
   (necesario para abrir la app directamente desde file:// en algunos
   navegadores, donde IndexedDB está bloqueado).
   ========================================================================== */
(function (global) {
  'use strict';

  var DB_NAME = 'safety-rounds';
  var DB_VERSION = 3;
  var STORES = ['settings', 'folders', 'forms', 'visits', 'deviations', 'actions', 'catalogs', 'lists', 'files'];
  // Almacén interno de la sincronización (cola de cambios, versiones base,
  // estado y copia previa). No forma parte de las copias de seguridad.
  var META_STORE = '_sync';
  var LS_PREFIX = 'sr:';
  // Fecha de los registros que crea la propia aplicación (listas de sistema):
  // cualquier edición real, de cualquier dispositivo, es más reciente.
  var EPOCH = '1970-01-01T00:00:00.000Z';

  var APP_VERSION = '2.2';

  var db = null;
  var mode = 'idb';          // 'idb' | 'ls' | 'mem'
  var cache = {};            // espejo en memoria: cache[store] = { id: record }
  var metaCache = {};        // espejo del almacén _sync (menos la copia previa)
  var ready = null;
  var changeListeners = [];  // se avisa de cada cambio LOCAL (lo consume Sync)

  /* ---------- Utilidades ---------- */

  function uid(prefix) {
    var t = Date.now().toString(36);
    var r = Math.random().toString(36).slice(2, 8);
    return (prefix || 'id') + '_' + t + r;
  }

  function nowISO() { return new Date().toISOString(); }

  function clone(o) {
    if (o === null || typeof o !== 'object') return o;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(o); } catch (e) { /* Blob o similares */ }
    }
    return JSON.parse(JSON.stringify(o));
  }

  /* ---------- Apertura ---------- */

  function openIDB() {
    return new Promise(function (resolve, reject) {
      var req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) { return reject(e); }

      var timer = setTimeout(function () { reject(new Error('timeout')); }, 4000);

      req.onupgradeneeded = function (ev) {
        var d = ev.target.result;
        STORES.concat([META_STORE]).forEach(function (s) {
          if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
        });
        // Una base que ya existía antes de la sincronización contiene datos
        // que nacieron solo en este dispositivo (pruebas o demostración). Se
        // deja constancia para que la primera sincronización los trate como
        // lo que son (ver Sync.bootstrap) en lugar de mezclarlos con el servidor.
        if (ev.oldVersion >= 1 && ev.oldVersion < 3) {
          try { localStorage.setItem('sr:presync', '1'); } catch (e) {}
        }
      };
      req.onsuccess = function () { clearTimeout(timer); resolve(req.result); };
      req.onerror = function () { clearTimeout(timer); reject(req.error || new Error('idb error')); };
      req.onblocked = function () { clearTimeout(timer); reject(new Error('blocked')); };
    });
  }

  function idbAll(store) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(store, 'readonly');
      var req = tx.objectStore(store).getAll();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbPut(store, rec) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(rec);
      tx.oncomplete = function () { resolve(rec); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('abort')); };
    });
  }

  function idbDel(store, id) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }

  function idbClear(store) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }

  /* ---------- Persistencia localStorage (respaldo) ---------- */

  function lsLoad(store) {
    try {
      var raw = localStorage.getItem(LS_PREFIX + store);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  var quotaWarned = false;

  function lsSave(store) {
    try {
      var arr = Object.keys(cache[store]).map(function (k) { return cache[store][k]; });
      localStorage.setItem(LS_PREFIX + store, JSON.stringify(arr));
      return true;
    } catch (e) {
      // Un solo aviso por sesión: en caso contrario cada pulsación de tecla
      // dispararía su propio mensaje de error.
      if (!quotaWarned && global.UI && UI.toast) {
        quotaWarned = true;
        UI.toast('El almacenamiento del navegador está lleno. Descarga una copia de seguridad y borra visitas antiguas.', 'err');
      }
      return false;
    }
  }

  function lsAvailable() {
    try {
      var k = LS_PREFIX + '__probe';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- Arranque ---------- */

  /**
   * Escalera de degradación: IndexedDB → localStorage → memoria.
   * El último escalón importa cuando la página se abre incrustada en otro
   * sitio o en una ventana privada: la aplicación sigue siendo utilizable
   * durante la sesión, simplemente no recuerda nada al recargar.
   */
  function init() {
    if (ready) return ready;
    ready = (function () {
      return openIDB().then(function (d) {
        db = d;
        mode = 'idb';
        return Promise.all(STORES.map(function (s) {
          return idbAll(s).then(function (rows) {
            cache[s] = {};
            rows.forEach(function (r) { cache[s][r.id] = r; });
          });
        }).concat([idbAll(META_STORE).then(function (rows) {
          metaCache = {};
          rows.forEach(function (r) { if (r.id !== 'backup') metaCache[r.id] = r; });
        })]));
      }).catch(function () {
        mode = lsAvailable() ? 'ls' : 'mem';
        STORES.forEach(function (s) {
          cache[s] = {};
          if (mode === 'ls') lsLoad(s).forEach(function (r) { cache[s][r.id] = r; });
        });
        if (mode === 'mem') {
          setTimeout(function () {
            if (global.UI && UI.toast) {
              UI.toast('Este navegador no permite guardar datos aquí: podrás usar la aplicación, pero se reiniciará al recargar la página.', 'info');
            }
          }, 1200);
        }
      });
    })();
    return ready;
  }

  /* ---------- API síncrona sobre la caché ---------- */

  function all(store) {
    var c = cache[store] || {};
    return Object.keys(c).map(function (k) { return c[k]; });
  }

  function get(store, id) {
    return (cache[store] || {})[id] || null;
  }

  /**
   * opts.local = true  → el cambio se guarda pero NO se sincroniza (borradores
   *                      que se autoguardan cada pocos segundos: solo viajan
   *                      cuando el usuario los guarda a propósito o los cierra).
   */
  function put(store, rec, opts) {
    if (!rec.id) rec.id = uid(store.slice(0, 3));
    if (!rec.createdAt) rec.createdAt = nowISO();
    rec.updatedAt = nowISO();
    cache[store][rec.id] = rec;
    persist(store, rec);
    emit(store, rec.id, 'put', opts);
    return rec;
  }

  /** Escritura sin tocar updatedAt (usado en migraciones y restauraciones). */
  function putRaw(store, rec, opts) {
    cache[store][rec.id] = rec;
    persist(store, rec);
    emit(store, rec.id, 'put', opts);
    return rec;
  }

  function emit(store, id, op, opts) {
    if (opts && (opts.local || opts.quiet)) return;
    for (var i = 0; i < changeListeners.length; i++) {
      try { changeListeners[i](store, id, op); } catch (e) { console.warn('[store] oyente de cambios', e); }
    }
  }

  /** Suscripción a los cambios hechos en ESTE dispositivo. */
  function onChange(fn) { changeListeners.push(fn); }

  /**
   * Aplica un documento llegado del servidor: se guarda igual que cualquier
   * otro, pero sin avisar como cambio local (si no, rebotaría al servidor).
   * rec = null elimina el documento.
   */
  function applyRemote(store, id, rec) {
    if (!cache[store]) return;
    if (rec === null) {
      delete cache[store][id];
      if (mode === 'idb') idbDel(store, id).catch(function () {});
      return;
    }
    cache[store][id] = rec;
    persist(store, rec);
  }

  /* ---------- Almacén interno de la sincronización ---------- */

  var meta = {
    all: function (prefix) {
      return Object.keys(metaCache).filter(function (k) { return !prefix || k.indexOf(prefix) === 0; })
        .map(function (k) { return metaCache[k]; });
    },
    get: function (id) { return metaCache[id] || null; },
    put: function (rec) {
      metaCache[rec.id] = rec;
      if (mode === 'idb') idbPut(META_STORE, rec).catch(function () {});
      return rec;
    },
    del: function (id) {
      delete metaCache[id];
      if (mode === 'idb') idbDel(META_STORE, id).catch(function () {});
    },
    /** Elimina todo lo que empiece por prefix (o todo, si no se indica). */
    clear: function (prefix) {
      Object.keys(metaCache).forEach(function (k) {
        if (!prefix || k.indexOf(prefix) === 0) meta.del(k);
      });
    },
    // La copia previa puede pesar varios MB: no vive en memoria.
    putBackup: function (data) {
      if (mode !== 'idb') return Promise.resolve();
      return idbPut(META_STORE, { id: 'backup', savedAt: nowISO(), data: data }).catch(function () {});
    },
    getBackup: function () {
      if (mode !== 'idb') return Promise.resolve(null);
      return new Promise(function (resolve) {
        try {
          var req = db.transaction(META_STORE, 'readonly').objectStore(META_STORE).get('backup');
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    }
  };

  function persist(store, rec) {
    if (mode === 'mem') return;
    if (mode === 'idb') {
      idbPut(store, rec).catch(function (e) {
        console.warn('[store] fallo al escribir en IndexedDB', e);
        if (global.UI && UI.toast) UI.toast('No se ha podido guardar el registro.', 'err');
      });
    } else {
      lsSave(store);
    }
  }

  function remove(store, id, opts) {
    delete cache[store][id];
    if (mode !== 'mem') {
      if (mode === 'idb') idbDel(store, id).catch(function () {});
      else lsSave(store);
    }
    emit(store, id, 'del', opts);
  }

  function clearStore(store, opts) {
    var ids = Object.keys(cache[store] || {});
    cache[store] = {};
    if (mode !== 'mem') {
      if (mode === 'idb') idbClear(store).catch(function () {});
      else lsSave(store);
    }
    ids.forEach(function (id) { emit(store, id, 'del', opts); });
  }

  function query(store, fn) {
    return all(store).filter(fn);
  }

  /* ---------- Ajustes ---------- */

  var DEFAULT_SETTINGS = {
    id: 'app',
    appName: 'Safety Rounds',
    company: '',
    department: 'Departamento de Safety & Health',
    logo: '',                       // dataURL
    defaultInspector: '',
    pdfFooter: '',
    autoEmail: true,
    seeded: false
  };

  function settings() {
    var s = get('settings', 'app');
    if (!s) {
      s = clone(DEFAULT_SETTINGS);
      putRaw('settings', s, { quiet: true });   // los valores por defecto no se suben
    }
    return s;
  }

  // De los ajustes, solo estos viajan al servidor (son los que ven todos los
  // usuarios y la WebApp de campo). El resto —inspector por defecto, marca de
  // demostración cargada…— es de cada dispositivo.
  var SHARED_SETTINGS = ['appName', 'company', 'department', 'logo', 'pdfFooter', 'autoEmail', 'demoLoadedAt'];

  function saveSettings(patch) {
    var s = settings();
    var shared = false;
    Object.keys(patch).forEach(function (k) {
      if (SHARED_SETTINGS.indexOf(k) !== -1 && JSON.stringify(s[k]) !== JSON.stringify(patch[k])) shared = true;
      s[k] = patch[k];
    });
    return put('settings', s, { local: !shared });
  }

  /* ======================================================================
     Tipologías: listas y sus elementos
     ----------------------------------------------------------------------
     Una «lista» es una tipología (Centros, Responsables del departamento…).
     Sus elementos viven en el almacén 'catalogs'. Una lista puede declarar
     una lista hija: entonces cada elemento de la hija cuelga de un elemento
     de la madre (Instalación 2 → Almacén de Químicos, Muelle de carga).
     ====================================================================== */

  // Las cuatro listas que la aplicación necesita para funcionar. Se pueden
  // ampliar y renombrar, pero no borrar: el dashboard y el bloque de
  // desviación dependen de ellas.
  var SYSTEM_LISTS = [
    { system: 'severity', name: 'Niveles de gravedad', color: '#E05C5C', icon: 'alert', analysable: true },
    { system: 'category', name: 'Categorías de riesgo', color: '#2E3D8A', icon: 'layers', analysable: true },
    { system: 'center', name: 'Centros e instalaciones', color: '#1E2B6F', icon: 'building', analysable: true },
    { system: 'area', name: 'Áreas y zonas', color: '#4356AE', icon: 'mapPin', analysable: true }
  ];

  function lists() {
    return all('lists').sort(function (a, b) {
      return (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name);
    });
  }

  function list(id) { return get('lists', id); }

  function listBySystem(system) {
    return all('lists').filter(function (l) { return l.system === system; })[0] || null;
  }

  function addList(data) {
    return put('lists', {
      id: data.id || uid('lst'),
      name: data.name,
      color: data.color || '#4356AE',
      icon: data.icon || 'list',
      system: data.system || null,
      childListId: data.childListId || null,
      analysable: !!data.analysable,
      order: data.order != null ? data.order : all('lists').length
    });
  }

  function removeList(id) {
    var l = get('lists', id);
    if (!l || l.system) return false;
    // Los elementos de la lista y de su hija se van con ella
    if (l.childListId) removeList(l.childListId);
    query('catalogs', function (c) { return c.listId === id; })
      .forEach(function (c) { remove('catalogs', c.id); });
    lists().forEach(function (other) {
      if (other.childListId === id) { other.childListId = null; put('lists', other); }
    });
    remove('lists', id);
    return true;
  }

  function parentListOf(childId) {
    return all('lists').filter(function (l) { return l.childListId === childId; })[0] || null;
  }

  /**
   * Elementos de una lista. Si se indica parentItemId, solo devuelve los que
   * cuelgan de ese elemento — es lo que hace funcionar la cascada.
   */
  function listItems(listId, parentItemId) {
    return query('catalogs', function (c) {
      if (c.listId !== listId) return false;
      if (parentItemId === undefined) return true;
      if (!parentItemId) return true;
      return c.parentId === parentItemId;
    }).sort(function (a, b) {
      return (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name);
    });
  }

  function addItem(listId, data) {
    var l = get('lists', listId);
    return put('catalogs', {
      id: uid('cat'),
      listId: listId,
      type: l ? l.system : null,     // se conserva por compatibilidad con la v1
      name: data.name,
      color: data.color || '#4356AE',
      parentId: data.parentId || null,
      email: data.email || '',
      role: data.role || '',
      phone: data.phone || '',
      notes: data.notes || '',
      order: listItems(listId).length
    });
  }

  /* ---------- Acceso por tipo de sistema (compatibilidad v1) ---------- */

  function catalog(type, parentItemId) {
    var l = listBySystem(type);
    if (!l) return [];
    return listItems(l.id, parentItemId);
  }

  function addCatalog(type, name, color, parentId) {
    var l = listBySystem(type);
    if (!l) return null;
    return addItem(l.id, { name: name, color: color, parentId: parentId });
  }

  function catalogName(id, fallback) {
    var c = get('catalogs', id);
    return c ? c.name : (fallback || '—');
  }

  function catalogColor(id, fallback) {
    var c = get('catalogs', id);
    return c ? c.color : (fallback || '#7A83A3');
  }

  /* ---------- Migración v1 → v2 ---------- */

  /**
   * La v1 guardaba los elementos con un campo `type` y sin listas.
   * Esta función crea las listas de sistema que falten y engancha a ellas los
   * elementos antiguos. Se ejecuta al arrancar y después de restaurar una
   * copia de seguridad, así que una copia de la v1 se abre sin perder nada.
   */
  function migrate() {
    var changed = false;

    // Identificador fijo por tipo («lst_center»…): con datos compartidos,
    // todos los dispositivos deben hablar de la MISMA lista de centros. Con
    // identificadores al azar, cada móvil crearía la suya y las visitas de
    // uno no encontrarían los centros del otro. La fecha es la época: si un
    // administrador ya renombró la lista en otro dispositivo, esa edición gana.
    SYSTEM_LISTS.forEach(function (def, i) {
      if (listBySystem(def.system)) return;
      putRaw('lists', {
        id: 'lst_' + def.system,
        name: def.name, color: def.color, icon: def.icon,
        system: def.system, childListId: null, analysable: def.analysable, order: i,
        createdAt: EPOCH, updatedAt: EPOCH
      });
      changed = true;
    });

    // Centros e instalaciones pasa a ser la madre de Áreas y zonas
    var center = listBySystem('center');
    var area = listBySystem('area');
    if (center && area && !center.childListId) {
      center.childListId = area.id;
      putRaw('lists', center);
      changed = true;
    }

    // Elementos huérfanos: los de la v1 solo tienen `type`
    all('catalogs').forEach(function (c) {
      if (c.listId) return;
      var l = c.type ? listBySystem(c.type) : null;
      if (!l) return;
      c.listId = l.id;
      if (c.email === undefined) c.email = '';
      if (c.role === undefined) c.role = '';
      if (c.phone === undefined) c.phone = '';
      if (c.notes === undefined) c.notes = '';
      putRaw('catalogs', c);
      changed = true;
    });

    return changed;
  }

  /* ---------- Imágenes: compresión antes de guardar ---------- */

  /**
   * Redimensiona y recomprime una imagen a JPEG.
   * Sin esto, un móvil moderno mete fotos de 4 MB y agota la cuota en pocas visitas.
   */
  function compressImage(file, maxSide, quality) {
    maxSide = maxSide || 1400;
    quality = quality || 0.72;
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('No se ha podido leer el archivo')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { resolve(reader.result); }; // no es imagen legible: se guarda tal cual
        img.onload = function () {
          var w = img.naturalWidth, h = img.naturalHeight;
          var scale = Math.min(1, maxSide / Math.max(w, h));
          var cw = Math.round(w * scale), ch = Math.round(h * scale);
          var cv = document.createElement('canvas');
          cv.width = cw; cv.height = ch;
          var ctx = cv.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(img, 0, 0, cw, ch);
          try {
            resolve(cv.toDataURL('image/jpeg', quality));
          } catch (e) {
            resolve(reader.result);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(file);
    });
  }

  /* ---------- Exportar / importar ---------- */

  function exportAll() {
    var data = { _app: 'safety-rounds', _version: 2, _exportedAt: nowISO() };
    STORES.forEach(function (s) { data[s] = all(s); });
    return data;
  }

  /**
   * opts.keepSettings: no toca los ajustes generales (nombre, logotipo…). Se usa
   * al cargar la demostración sobre datos compartidos, para no pisar la
   * identidad del departamento.
   */
  function importAll(data, replace, opts) {
    if (!data || data._app !== 'safety-rounds') {
      throw new Error('El archivo no es una copia de seguridad de Safety Rounds.');
    }
    STORES.forEach(function (s) {
      if (s === 'settings' && opts && opts.keepSettings) return;
      // Los ajustes (nombre, logotipo…) se sustituyen sin borrarlos antes: de
      // lo contrario la baja se propagaría a todos los dispositivos.
      if (replace) clearStore(s, s === 'settings' ? { quiet: true } : undefined);
      (data[s] || []).forEach(function (r) { if (r && r.id) putRaw(s, r); });
    });
    // Una copia de la versión 1 no trae listas: se reconstruyen a partir de
    // los tipos de los elementos.
    migrate();
  }

  /* ---------- Uso de almacenamiento ---------- */

  /**
   * Tamaño de los datos de la aplicación.
   * No se usa navigator.storage.estimate() como medida principal porque
   * incluye la caché del service worker y el relleno que Chrome añade a las
   * respuestas opacas: da cifras de decenas de MB que no significan nada para
   * el usuario. La cuota sí se toma de ahí cuando está disponible.
   */
  function usage() {
    var local = dataSize();
    if (navigator.storage && navigator.storage.estimate) {
      return navigator.storage.estimate().then(function (e) {
        return { used: local.used, quota: e.quota || local.quota };
      }).catch(function () { return local; });
    }
    return Promise.resolve(local);
  }

  function dataSize() {
    var bytes = 0;
    STORES.forEach(function (s) {
      try { bytes += JSON.stringify(all(s)).length; } catch (e) {}
    });
    return { used: bytes, quota: mode === 'ls' ? 5 * 1024 * 1024 : 0 };
  }

  // Símbolos SI en su grafía correcta (kB, MB, GB) y espacio duro antes de la
  // unidad, según la convención es-ES.
  function formatBytes(b) {
    var U = global.UI;
    var fmt = function (n, d, sym) {
      return U ? U.unit(n, sym, d) : n.toFixed(d || 0) + ' ' + sym;
    };
    if (!b) return fmt(0, 0, 'kB');
    if (b < 1024 * 1024) return fmt(b / 1024, 0, 'kB');
    if (b < 1024 * 1024 * 1024) return fmt(b / 1024 / 1024, 1, 'MB');
    return fmt(b / 1024 / 1024 / 1024, 2, 'GB');
  }

  /* ---------- Exposición ---------- */

  global.Store = {
    init: init,
    all: all,
    get: get,
    put: put,
    putRaw: putRaw,
    remove: remove,
    clearStore: clearStore,
    onChange: onChange,
    applyRemote: applyRemote,
    meta: meta,
    EPOCH: EPOCH,
    query: query,
    uid: uid,
    nowISO: nowISO,
    clone: clone,
    settings: settings,
    saveSettings: saveSettings,
    SHARED_SETTINGS: SHARED_SETTINGS,
    lists: lists,
    list: list,
    listBySystem: listBySystem,
    addList: addList,
    removeList: removeList,
    parentListOf: parentListOf,
    listItems: listItems,
    addItem: addItem,
    migrate: migrate,
    catalog: catalog,
    addCatalog: addCatalog,
    catalogName: catalogName,
    catalogColor: catalogColor,
    compressImage: compressImage,
    readFileAsDataURL: readFileAsDataURL,
    exportAll: exportAll,
    importAll: importAll,
    usage: usage,
    formatBytes: formatBytes,
    STORES: STORES,
    APP_VERSION: APP_VERSION,
    get mode() { return mode; }
  };
})(window);
