/* ==========================================================================
   Safety Rounds — Página de inicio de sesión
   ========================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('loginForm');
  var userEl = document.getElementById('fUser');
  var passEl = document.getElementById('fPass');
  var errEl = document.getElementById('loginError');
  var btn = document.getElementById('loginBtn');

  function target() {
    var next = new URLSearchParams(location.search).get('next');
    return (next && next.charAt(0) === '/') ? next : 'index.html';
  }

  function cacheAuth(user) {
    try {
      localStorage.setItem('sr:auth', JSON.stringify({
        username: user.username, name: user.name, role: user.role, cachedAt: Date.now()
      }));
    } catch (e) { /* modo privado: sin efecto, se volverá a pedir la sesión */ }
  }

  function showError(msg) {
    errEl.textContent = msg;
    errEl.hidden = false;
  }

  // Si ya hay una sesión abierta en el servidor, entra directo.
  fetch('/api/auth/me', { credentials: 'include' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (user) { if (user) { cacheAuth(user); location.replace(target()); } })
    .catch(function () { /* sin conexión: se queda en el formulario */ });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errEl.hidden = true;
    btn.disabled = true;

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: userEl.value.trim(), password: passEl.value })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
    }).then(function (r) {
      btn.disabled = false;
      if (!r.ok) { showError((r.data && r.data.error) || 'No se ha podido iniciar sesión.'); return; }
      cacheAuth(r.data);
      location.replace(target());
    }).catch(function () {
      btn.disabled = false;
      showError('No se ha podido conectar con el servidor. Comprueba tu conexión.');
    });
  });
})();
