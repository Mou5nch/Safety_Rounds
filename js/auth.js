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

  function cached() {
    try { return JSON.parse(localStorage.getItem('sr:auth') || 'null'); } catch (e) { return null; }
  }

  function clearCache() {
    try { localStorage.removeItem('sr:auth'); } catch (e) {}
  }

  function goToLogin() {
    clearCache();
    location.href = 'login.html';
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

  function init() {
    var user = cached();
    if (user) paint(user);

    var btn = document.getElementById('sessionLogout');
    if (btn) btn.addEventListener('click', logout);

    verifyWithServer();
    setInterval(heartbeat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') heartbeat();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.Auth = { logout: logout };
})(window);
