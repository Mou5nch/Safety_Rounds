/* ==========================================================================
   Safety Rounds — Arranque y navegación
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el;

  var ROUTES = {
    dashboard:     { title: 'Dashboard', run: function () { Dashboard.render(); } },
    calendario:    { title: 'Calendario', run: function () { Calendar.render(); } },
    cuestionarios: { title: 'Cuestionarios', run: function () { Lists.forms('run'); } },
    historico:     { title: 'Visitas realizadas', run: function () { Lists.history(); } },
    desviaciones:  { title: 'Desviaciones', run: function () { Lists.deviations(); } },
    acciones:      { title: 'Plan de acción', run: function () { Lists.actions(); } },
    configuracion: { title: 'Configuración cuestionarios', run: function () { Lists.forms('edit'); } },
    ajustes:       { title: 'Ajustes y datos', run: function () { Settings.render(); } }
  };

  var current = 'dashboard';

  /* ---------- Navegación ---------- */

  function go(route, opts) {
    if (!ROUTES[route]) route = 'dashboard';
    trackRouteChange(route);
    current = route;
    if (!(opts && opts.silent)) {
      try { history.replaceState(null, '', '#' + route); } catch (e) {}
    }
    UI.$$('.nav__item').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-route') === route);
    });
    closeSidebar();
    window.scrollTo(0, 0);
    ROUTES[route].run();
    refreshBadges();
  }

  /* ---------- Seguimiento de navegación ----------
     Para el mapa de calor de actividad del panel de accesos: cuánto tiempo
     pasa cada usuario en cada pantalla del menú. Solo cuenta tiempo con la
     pestaña visible (en segundo plano se pausa el contador) y solo se manda
     al servidor al cambiar de pantalla, ocultar la pestaña o cerrarla. */

  var navTrack = { route: null, since: 0 };

  function trackRouteChange(route) {
    flushNavTrack();
    navTrack = { route: route, since: Date.now() };
  }

  function flushNavTrack() {
    if (!navTrack.route) return;
    var seconds = Math.round((Date.now() - navTrack.since) / 1000);
    var route = navTrack.route;
    navTrack = { route: null, since: 0 };
    if (seconds < 1) return;
    sendNavBeacon(route, seconds);
  }

  function sendNavBeacon(route, seconds) {
    var payload = JSON.stringify({ route: route, seconds: seconds });
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon('/api/track/nav', blob)) return;
      }
    } catch (e) { /* sin sendBeacon: se usa fetch a continuación */ }
    fetch('/api/track/nav', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', keepalive: true, body: payload
    }).catch(function () { /* se pierde este dato puntual, sin más consecuencia */ });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      flushNavTrack();
    } else if (current) {
      navTrack = { route: current, since: Date.now() };
    }
  });
  window.addEventListener('pagehide', flushNavTrack);

  function setHeader(title, sub, actions) {
    UI.$('#pageTitle').textContent = title;
    UI.$('#pageSub').textContent = sub || '';
    var box = UI.$('#pageActions');
    UI.clear(box);
    (actions || []).forEach(function (a) { if (a) box.appendChild(a); });
  }

  function setSubtitle(sub) {
    UI.$('#pageSub').textContent = sub || '';
  }

  /* ---------- Contadores del menú ---------- */

  function refreshBadges() {
    var openDevs = Store.query('deviations', function (d) { return d.status !== 'closed'; }).length;
    var pendingActions = Store.query('actions', function (a) { return a.status !== 'done'; }).length;
    var visits = Store.query('visits', function (v) { return v.status === 'completed'; }).length;

    badge('#badgeDev', openDevs);
    badge('#badgeActions', pendingActions);
    badge('#badgeVisits', visits);
    updateStorage();
  }

  function badge(sel, n) {
    var b = UI.$(sel);
    if (!b) return;
    b.textContent = n > 99 ? '99+' : String(n);
    b.hidden = !n;
  }

  function updateStorage() {
    Store.usage().then(function (u) {
      var valEl = UI.$('#storageVal');
      var fillEl = UI.$('#storageFill');
      if (!valEl) return;
      valEl.textContent = Store.formatBytes(u.used);
      var pct = u.quota ? Math.min(100, u.used / u.quota * 100) : Math.min(100, u.used / (50 * 1024 * 1024) * 100);
      fillEl.style.width = Math.max(2, pct) + '%';
      fillEl.style.background = pct > 85 ? 'var(--coral)' : pct > 60 ? '#C77A10' : 'var(--coral)';
    });
  }

  /* ---------- Marca ---------- */

  function applyBrand() {
    var s = Store.settings();
    UI.$('#brandName').textContent = s.appName || 'Safety Rounds';
    UI.$('#brandSub').textContent = s.company || s.department || 'Safety & Health';
    document.title = (s.appName || 'Safety Rounds') + ' — Inspecciones de Seguridad y Salud';
    var v = UI.$('#appVersion');
    if (v) v.textContent = 'v' + Store.APP_VERSION;
  }

  /* ---------- Menú lateral en móvil ---------- */

  var scrim = null;

  function openSidebar() {
    UI.$('#sidebar').classList.add('is-open');
    if (!scrim) {
      scrim = el('div', { class: 'scrim', onclick: closeSidebar });
      document.body.appendChild(scrim);
    }
  }

  function closeSidebar() {
    UI.$('#sidebar').classList.remove('is-open');
    if (scrim && scrim.parentNode) { scrim.parentNode.removeChild(scrim); scrim = null; }
  }

  /* ---------- Arranque ---------- */

  function boot() {
    Store.init().then(function () {
      // Una cuenta de demostración nunca comparte datos: si este dispositivo
      // había sincronizado antes, se limpia el rastro antes de cargar la demo.
      if (cachedRole() === 'usuario') Sync.resetForDemo();
      return loadDemoDataIfNeeded();
    }).then(function (demoLoaded) {
      // Primera bajada del servidor ANTES de crear nada propio: así un
      // dispositivo nuevo recibe las listas y cuestionarios existentes en
      // lugar de generar los suyos. Sin red, o sin sincronización, no espera.
      return Sync.start().then(function () {
        // Con los datos compartidos en blanco, un administrador carga la demostración
        return Seed.ensureSharedDemo().then(function (shared) { return demoLoaded || shared; });
      });
    }).then(function (demoLoaded) {
      // Crea las listas de sistema y engancha los elementos de la versión 1
      Store.migrate();
      var created = Seed.ensure();
      applyBrand();
      initSyncUI();
      applyRoleLimits();

      UI.$$('.nav__item').forEach(function (b) {
        b.addEventListener('click', function () { go(b.getAttribute('data-route')); });
      });
      UI.$('#burger').addEventListener('click', function () {
        UI.$('#sidebar').classList.contains('is-open') ? closeSidebar() : openSidebar();
      });

      var hash = (location.hash || '').replace('#', '');
      go(ROUTES[hash] ? hash : 'dashboard');

      if (demoLoaded) {
        setTimeout(function () {
          UI.toast(demoLoaded === 'reset'
            ? 'Hemos restaurado los datos de demostración.'
            : 'Cuenta de demostración creada. Hemos cargado datos de ejemplo para que explores la aplicación.', 'info');
        }, 700);
      } else if (created) {
        setTimeout(function () {
          UI.toast('Bienvenido. Hemos dejado un cuestionario de ejemplo para que veas cómo funciona.', 'info');
        }, 700);
      }

      registerSW();
      watchOffline();
    }).catch(function (e) {
      console.error(e);
      document.body.innerHTML = '<div style="max-width:520px;margin:80px auto;padding:24px;font-family:sans-serif">' +
        '<h1 style="font-size:20px">No se ha podido iniciar la aplicación</h1>' +
        '<p style="color:#4A5378;line-height:1.6">' + UI.esc(e.message) + '</p>' +
        '<button id="srRepair" style="margin:6px 0 14px;height:48px;padding:0 22px;border:0;border-radius:12px;background:#F16B6B;color:#fff;font:600 15px sans-serif;cursor:pointer">Actualizar la aplicación</button>' +
        '<p style="color:#7A83A3;font-size:14px;line-height:1.55">«Actualizar» borra los archivos guardados de versiones anteriores y recarga; tus datos no se tocan. Si sigue fallando, comprueba que el navegador permite el almacenamiento local (en modo incógnito algunas funciones están restringidas).</p></div>';
      var rb = document.getElementById('srRepair');
      if (rb) rb.addEventListener('click', function () { if (global.Sync && Sync.repair) Sync.repair(); else location.reload(); });
    });
  }

  // Toda cuenta de demostración (rol 'usuario', ya sea autorregistrada o creada por el
  // administrador) tiene SIEMPRE los datos de demo-data.json: se cargan la primera vez
  // en cada navegador, se restauran en cada inicio de sesión y se renuevan si el
  // archivo ha cambiado (ver Seed.ensureLocalDemo). Si la carga falla (sin red, JSON
  // corrupto…) no se marca nada como hecho: se reintenta en el siguiente arranque.
  function loadDemoDataIfNeeded() {
    // Mismos datos de ejemplo que ve Safety Go (con las fechas repartidas en las
    // últimas semanas): ver Seed.ensureLocalDemo.
    return Seed.ensureLocalDemo();
  }

  function cachedRole() {
    try {
      var a = JSON.parse(localStorage.getItem('sr:auth') || 'null');
      return a && a.role;
    } catch (e) { return null; }
  }

  /* ---------- Sincronización: chip de estado y refresco al llegar datos ---------- */

  var SYNC_TEXT = {
    synced: 'Sincronizado', idle: 'Al día', syncing: 'Sincronizando…', pending: 'Pendiente de subir',
    offline: 'Sin conexión', auth: 'Sesión caducada', error: 'Error de sincronización'
  };

  function initSyncUI() {
    var chip = UI.$('#syncChip');
    if (!chip || !Sync.enabled()) return;
    chip.hidden = false;
    chip.addEventListener('click', function () { Sync.now(); });

    function paint(s) {
      chip.setAttribute('data-status', s.status);
      var txt = SYNC_TEXT[s.status] || s.status;
      if (s.status === 'pending' && s.pending) txt += ' (' + s.pending + ')';
      UI.$('#syncText').textContent = txt;
    }
    paint(Sync.status());
    Sync.on(paint);

    // Llegan datos de otro dispositivo: se refrescan contadores y, si la
    // pantalla actual es un listado (no una visita en curso ni un diálogo
    // abierto), se vuelve a pintar para que los cambios se vean sin recargar.
    var timer = null;
    Sync.onRemote(function () {
      applyBrand();
      refreshBadges();
      clearTimeout(timer);
      timer = setTimeout(function () {
        var busy = UI.$('.runner') || UI.$('#modalRoot .overlay') || UI.$('#view input:focus, #view textarea:focus');
        if (!busy && ROUTES[current] && current !== 'configuracion') ROUTES[current].run();
      }, 400);
    });
  }

  /* El inspector trabaja en campo: no configura cuestionarios. */
  function applyRoleLimits() {
    if (cachedRole() !== 'inspector') return;
    var cfg = UI.$('[data-route="configuracion"]');
    if (cfg) cfg.hidden = true;
    delete ROUTES.configuracion;
  }

  /* ---------- PWA ---------- */

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return; // sin servidor no hay SW
    navigator.serviceWorker.register('sw.js').catch(function () { /* sin efecto para el usuario */ });
  }

  function watchOffline() {
    var banner = null;
    function update() {
      if (navigator.onLine) {
        if (banner && banner.parentNode) { banner.parentNode.removeChild(banner); banner = null; }
        return;
      }
      if (banner) return;
      banner = el('div', {
        style: {
          position: 'fixed', bottom: '0', left: '0', right: '0', zIndex: '150',
          background: 'var(--navy)', color: '#fff', fontSize: '13px', fontWeight: '600',
          padding: '9px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '7px', textAlign: 'center'
        }
      }, [
        el('span', { style: { flex: 'none', display: 'flex' }, html: ico('database', 14) }),
        el('span', { text: 'Sin conexión · la aplicación sigue funcionando y guardando en este dispositivo' })
      ]);
      document.body.appendChild(banner);
    }
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  /* ---------- Exposición ---------- */

  global.App = {
    go: go,
    setHeader: setHeader,
    setSubtitle: setSubtitle,
    refreshBadges: refreshBadges,
    updateStorage: updateStorage,
    applyBrand: applyBrand,
    get route() { return current; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
