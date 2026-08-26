/* ==========================================================================
   Safety Rounds — Service Worker
   Precarga el esqueleto de la aplicación para que funcione sin conexión.
   Los datos no pasan por aquí: viven en IndexedDB.
   ========================================================================== */

// Al subir este nombre, la activación borra las cachés anteriores: es lo que
// hace que quien tenga la aplicación instalada reciba de verdad la versión
// nueva en lugar de seguir con los archivos guardados de la anterior.
var CACHE = 'safety-rounds-v4';

var ASSETS = [
  './',
  'index.html',
  'login.html',
  'admin.html',
  'report.html',
  'reset-password.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/icons.js',
  'js/store.js',
  'js/ui.js',
  'js/seed.js',
  'js/builder.js',
  'js/runner.js',
  'js/pdf.js',
  'js/dashboard.js',
  'js/lists.js',
  'js/settings.js',
  'js/share.js',
  'js/auth.js',
  'js/login.js',
  'js/admin.js',
  'js/report-viewer.js',
  'js/reset-password.js',
  'js/app.js',
  'vendor/jspdf.umd.min.js',
  'icons/favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // addAll falla en bloque si un solo recurso da error: se añaden de uno en uno
      return Promise.all(ASSETS.map(function (url) {
        return c.add(url).catch(function () { /* recurso opcional */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Tipografías de Google: cache-first para que la app se vea igual sin conexión
  if (url.hostname.indexOf('fonts.g') !== -1) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        }).catch(function () { return hit; });
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // La API nunca pasa por caché: sesión, panel de accesos e informes
  // compartidos necesitan siempre el dato del servidor, no uno guardado.
  if (url.pathname.indexOf('/api/') === 0) return;

  // Red primero para el HTML (así una versión nueva se ve al recargar),
  // caché primero para el resto de recursos estáticos.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        var fallback = url.pathname.indexOf('/r/') === 0 ? 'report.html' : 'index.html';
        return caches.match(req).then(function (hit) { return hit || caches.match(fallback); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
