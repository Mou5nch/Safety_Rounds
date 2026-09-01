/* ==========================================================================
   Safety Rounds — Página de inicio de sesión
   ========================================================================== */
(function () {
  'use strict';

  function wirePasswordToggle(inputId, buttonId) {
    var input = document.getElementById(inputId);
    var btn = document.getElementById(buttonId);
    if (!input || !btn) return;
    var shown = false;
    function paint() {
      btn.innerHTML = ico(shown ? 'eyeOff' : 'eye', 17);
      btn.setAttribute('aria-label', shown ? 'Ocultar contraseña' : 'Mostrar contraseña');
    }
    btn.addEventListener('click', function () {
      shown = !shown;
      input.type = shown ? 'text' : 'password';
      paint();
    });
    paint();
  }
  wirePasswordToggle('fPass', 'fPassToggle');
  wirePasswordToggle('fRegPass', 'fRegPassToggle');
  wirePasswordToggle('fRegPass2', 'fRegPass2Toggle');

  var form = document.getElementById('loginForm');
  var userEl = document.getElementById('fUser');
  var passEl = document.getElementById('fPass');
  var errEl = document.getElementById('loginError');
  var btn = document.getElementById('loginBtn');

  var views = {
    login: document.getElementById('loginView'),
    forgot: document.getElementById('forgotView'),
    register: document.getElementById('registerView')
  };
  function showView(name, focusId) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    if (focusId) { var f = document.getElementById(focusId); if (f) f.focus(); }
  }

  var forgotToggle = document.getElementById('forgotToggle');
  var backToLogin = document.getElementById('backToLogin');
  var forgotForm = document.getElementById('forgotForm');
  var forgotUserEl = document.getElementById('fForgotUser');
  var forgotErrEl = document.getElementById('forgotError');
  var forgotOkEl = document.getElementById('forgotSuccess');
  var forgotBtn = document.getElementById('forgotBtn');

  if (forgotToggle) forgotToggle.addEventListener('click', function () {
    forgotErrEl.hidden = true; forgotOkEl.hidden = true;
    showView('forgot', 'fForgotUser');
  });
  if (backToLogin) backToLogin.addEventListener('click', function () { showView('login'); });

  var registerToggle = document.getElementById('registerToggle');
  var backToLoginFromRegister = document.getElementById('backToLoginFromRegister');
  var registerForm = document.getElementById('registerForm');
  var regNameEl = document.getElementById('fRegName');
  var regEmailEl = document.getElementById('fRegEmail');
  var regPassEl = document.getElementById('fRegPass');
  var regPass2El = document.getElementById('fRegPass2');
  var regErrEl = document.getElementById('registerError');
  var regBtn = document.getElementById('registerBtn');

  if (registerToggle) registerToggle.addEventListener('click', function () {
    regErrEl.hidden = true;
    showView('register', 'fRegName');
  });
  if (backToLoginFromRegister) backToLoginFromRegister.addEventListener('click', function () { showView('login'); });

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

  if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
      e.preventDefault();
      regErrEl.hidden = true;

      if (regPassEl.value.length < 8) { showRegError('La contraseña debe tener al menos 8 caracteres.'); return; }
      if (regPassEl.value !== regPass2El.value) { showRegError('Las dos contraseñas no coinciden.'); return; }

      regBtn.disabled = true;
      fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: regNameEl.value.trim(), email: regEmailEl.value.trim(), password: regPassEl.value })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (r) {
        regBtn.disabled = false;
        if (!r.ok) { showRegError((r.data && r.data.error) || 'No se ha podido crear la cuenta.'); return; }
        cacheAuth(r.data);
        try { localStorage.setItem('sr:needsDemoSeed', '1'); } catch (e) {}
        location.replace(target());
      }).catch(function () {
        regBtn.disabled = false;
        showRegError('No se ha podido conectar con el servidor. Comprueba tu conexión.');
      });
    });
  }

  function showRegError(msg) {
    regErrEl.textContent = msg;
    regErrEl.hidden = false;
  }

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
