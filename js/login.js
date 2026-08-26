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

  var loginView = document.getElementById('loginView');
  var forgotView = document.getElementById('forgotView');
  var forgotToggle = document.getElementById('forgotToggle');
  var backToLogin = document.getElementById('backToLogin');
  var forgotForm = document.getElementById('forgotForm');
  var forgotUserEl = document.getElementById('fForgotUser');
  var forgotErrEl = document.getElementById('forgotError');
  var forgotOkEl = document.getElementById('forgotSuccess');
  var forgotBtn = document.getElementById('forgotBtn');

  function showForgot(show) {
    loginView.hidden = show;
    forgotView.hidden = !show;
    forgotErrEl.hidden = true;
    forgotOkEl.hidden = true;
    if (show) forgotUserEl.focus();
  }
  if (forgotToggle) forgotToggle.addEventListener('click', function () { showForgot(true); });
  if (backToLogin) backToLogin.addEventListener('click', function () { showForgot(false); });

  if (forgotForm) {
    forgotForm.addEventListener('submit', function (e) {
      e.preventDefault();
      forgotErrEl.hidden = true;
      forgotOkEl.hidden = true;
      forgotBtn.disabled = true;

      fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: forgotUserEl.value.trim() })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (r) {
        forgotBtn.disabled = false;
        if (!r.ok) {
          forgotErrEl.textContent = (r.data && r.data.error) || 'No se ha podido procesar la petición.';
          forgotErrEl.hidden = false;
          return;
        }
        forgotOkEl.textContent = r.data.message || 'Si esa cuenta existe, te hemos enviado un enlace por correo.';
        forgotOkEl.hidden = false;
        forgotForm.reset();
      }).catch(function () {
        forgotBtn.disabled = false;
        forgotErrEl.textContent = 'No se ha podido conectar con el servidor. Comprueba tu conexión.';
        forgotErrEl.hidden = false;
      });
    });
  }

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
