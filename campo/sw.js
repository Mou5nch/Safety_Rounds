/* ==========================================================================
   Safety Rounds · Campo — Service Worker
   Guarda el esqueleto de la aplicación para que abra sin conexión. Los datos
   no pasan por aquí: viven en IndexedDB y se sincronizan con /api/sync.
   Estrategia: «sirve lo guardado y actualízalo por detrás» para los archivos
   de la aplicación, de modo que una versión nueva llega sola a la siguiente
   apertura sin dejar a nadie atascado en la antigua.
   ========================================================================== */

var CACHE = 'safety-rounds-campo-v3';

var ASSETS = [
  '/campo/',
  '/campo/index.html',
  '/campo/manifest.webmanifest',
  '/campo/css/campo.css',
  '/campo/js/core.js',
  '/campo/js/records.js',
  '/campo/js/home.js',
  '/campo/js/calendar.js',
  '/campo/js/forms.js',
  '/campo/js/deviations.js',
  '/campo/js/actions.js',
  '/campo/js/shell.js',
  '/css/app.css',
  '/js/icons.js',
  '/js/store.js',
  '/js/sync.js',
  '/js/ui.js',
  '/js/recurrence.js',
  '/js/seed.js',
  '/js/builder.js',
  '/js/runner.js',
  '/js/pdf.js',
  '/js/mailer.js',
  '/js/share.js',
  '/vendor/jspdf.umd.min.js',
  '/icons/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (url) {
        return c.add(new Request(url, { cache: 'reload' })).catch(function () { /* recurso opcional */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return (k.indexOf('safety-rounds-campo-') === 0 && k !== CACHE) ? caches.delete(k) : null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Tipografías de Google: lo guardado primero, para que se vea igual sin conexión
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
  // La API nunca se guarda: sesión, sincronización y correo necesitan el dato real
  if (url.pathname.indexOf('/api/') === 0) return;

  // Navegación: red primero (versión nueva al recargar) y, sin red, la app guardada
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('/campo/index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('/campo/index.html').then(function (hit) { return hit || caches.match('/campo/'); });
      })
    );
    return;
  }

  // Resto: lo guardado al instante y se refresca por detrás
  e.respondWith(
    caches.match(req).then(function (hit) {
      var network = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || network;
    })
  );
});
