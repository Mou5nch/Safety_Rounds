/* ==========================================================================
   Safety Rounds — Elegir contraseña nueva (reset-password.html)
   ========================================================================== */
(function () {
  'use strict';

  var token = new URLSearchParams(location.search).get('token');

  var resetView = document.getElementById('resetView');
  var doneView = document.getElementById('doneView');
  var invalidView = document.getElementById('invalidView');

  if (!token) {
    resetView.hidden = true;
    invalidView.hidden = false;
    return;
  }

  var form = document.getElementById('resetForm');
  var pass1 = document.getElementById('fPass1');
  var pass2 = document.getElementById('fPass2');
  var errEl = document.getElementById('resetError');
  var btn = document.getElementById('resetBtn');

  function showError(msg) {
    errEl.textContent = msg;
    errEl.hidden = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errEl.hidden = true;

    if (pass1.value.length < 8) { showError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (pass1.value !== pass2.value) { showError('Las dos contraseñas no coinciden.'); return; }

    btn.disabled = true;
    fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token, password: pass1.value })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
    }).then(function (r) {
      btn.disabled = false;
      if (!r.ok) {
        var msg = (r.data && r.data.error) || 'No se ha podido restablecer la contraseña.';
        if (/caducado|no es válido/i.test(msg)) { resetView.hidden = true; invalidView.hidden = false; return; }
        showError(msg);
        return;
      }
      resetView.hidden = true;
      doneView.hidden = false;
    }).catch(function () {
      btn.disabled = false;
      showError('No se ha podido conectar con el servidor. Comprueba tu conexión.');
    });
  });
})();
