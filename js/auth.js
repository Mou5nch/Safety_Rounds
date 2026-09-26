/* ==========================================================================
   Safety Rounds — Sesión dentro de la aplicación
   El guardado inline en index.html ya decidió si se puede entrar (con la
   copia en localStorage, válida sin conexión). Aquí se confirma con el
   servidor cuando hay red, se manda el latido periódico para el panel de
   accesos, y se pinta el usuario y el cierre de sesión en la barra lateral.
   ========================================================================== */
(function (global) {
  'use strict';

  var HEARTBEAT_MS = 60 * 1000;
  var IDLE_TIMEOUT_MS = 30 * 60 * 1000;

  function cached() {
    try { return JSON.parse(localStorage.getItem('sr:auth') || 'null'); } catch (e) { return null; }
  }

  function clearCache() {
    try { localStorage.removeItem('sr:auth'); } catch (e) {}
  }

  function goToLogin(reason) {
    clearCache();
    location.href = 'login.html' + (reason ? '?reason=' + encodeURIComponent(reason) : '');
  }

  function paint(user) {
    var box = document.getElementById('sessionUser');
    if (!box) return;
    box.hidden = false;
    var nameEl = document.getElementById('sessionUserName');
    if (nameEl) nameEl.textContent = user.name || user.username;
    var adminLink = document.getElementById('navAdmin');
    if (adminLink) adminLink.hidden = user.role !== 'admin';
  }

  function verifyWithServer() {
    fetch('/api/auth/me', { credentials: 'include' }).then(function (res) {
      if (res.status === 401) {
        if (navigator.onLine) goToLogin();
        return null;
      }
      return res.ok ? res.json() : null;
    }).then(function (user) {
      if (!user) return;
      try {
        localStorage.setItem('sr:auth', JSON.stringify({
          username: user.username, name: user.name, role: user.role, cachedAt: Date.now()
        }));
      } catch (e) {}
      paint(user);
    }).catch(function () { /* sin conexión: se sigue con la copia local */ });
  }

  function heartbeat() {
    if (!navigator.onLine) return;
    fetch('/api/auth/heartbeat', { method: 'POST', credentials: 'include' }).then(function (res) {
      if (res.status === 401) goToLogin();
    }).catch(function () { /* sin efecto: se reintenta en el siguiente latido */ });
  }

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .catch(function () {})
      .then(function () { goToLogin(); });
  }

  /* ---------- Cierre de sesión por inactividad ----------
     30 minutos sin ningún gesto del usuario (ratón, teclado, toque, scroll)
     cierran la sesión igual que el botón de salir, tanto aquí como en el
     servidor (que también rechaza el latido y cualquier petición si la
     sesión lleva ese tiempo sin actividad): así no basta con dejar la
     pestaña abierta para que login.html, al comprobar /api/auth/me, te
     devuelva sin más a la aplicación. */

  var ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'wheel', 'touchstart', 'scroll'];
  var lastActivity = Date.now();
  var lastActivityWrite = 0;
  var idleTimer = null;

  function idleLogout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .catch(function () {})
      .then(function () { goToLogin('inactivity'); });
  }

  function resetIdleTimer() {
    lastActivity = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(idleLogout, IDLE_TIMEOUT_MS);
  }

  function onActivity() {
    // Un mousemove dispara decenas de eventos por segundo: de sobra con
    // reiniciar el temporizador una vez cada pocos segundos.
    var now = Date.now();
    if (now - lastActivityWrite < 5000) return;
    lastActivityWrite = now;
    resetIdleTimer();
  }

  function initIdleTimer() {
    ACTIVITY_EVENTS.forEach(function (evt) {
      document.addEventListener(evt, onActivity, { passive: true });
    });
    resetIdleTimer();
  }

  function init() {
    var user = cached();
    if (user) paint(user);

    var btn = document.getElementById('sessionLogout');
    if (btn) btn.addEventListener('click', logout);

    verifyWithServer();
    initIdleTimer();
    setInterval(heartbeat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      // Un temporizador en segundo plano puede quedar pausado por el
      // navegador: al volver a la pestaña se comprueba el tiempo real
      // transcurrido en vez de fiarse de que ya hubiera saltado solo.
      if (Date.now() - lastActivity >= IDLE_TIMEOUT_MS) { idleLogout(); return; }
      heartbeat();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.Auth = { logout: logout };
})(window);
