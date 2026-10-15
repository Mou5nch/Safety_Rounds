/* ==========================================================================
   Safety Rounds — Pantalla «¿Cómo quieres entrar?» (entrar.html)
   Solo la ven las cuentas con acceso a Safety Desk (gestión) y a Safety Go
   (campo). Quien solo tiene una entra directamente en ella. Safety Desk es la
   versión predeterminada; al llegar desde el enlace «Cambiar a…» de una app
   (?from=desk|go) se propone la otra.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('entrar');
  var from = new URLSearchParams(location.search).get('from');       // 'desk' | 'go' | null
  var choice = from === 'desk' ? 'go' : 'desk';

  var NAMES = { desk: 'Safety Desk', go: 'Safety Go' };
  var URLS = { desk: '/index.html', go: '/campo/' };

  function cached() {
    try { return JSON.parse(localStorage.getItem('sr:auth') || 'null'); } catch (e) { return null; }
  }

  function accessOf(u) {
    if (u && u.access) return u.access;
    return { desk: true, go: !u || u.role !== 'usuario' };           // sin dato: valor por defecto del rol
  }

  function cache(u) {
    try {
      localStorage.setItem('sr:auth', JSON.stringify({
        username: u.username, name: u.name, role: u.role, access: u.access, cachedAt: Date.now()
      }));
    } catch (e) {}
  }

  function firstName(u) {
    return String((u && (u.name || u.username)) || '').replace(/@.*$/, '').split(/[\s._-]+/)[0] || '';
  }

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(function () {}).then(function () {
      try { localStorage.removeItem('sr:auth'); } catch (e) {}
      location.replace('login.html');
    });
  }

  /* ---------- Pintado ---------- */

  function paintChoice() {
    Array.prototype.forEach.call(document.querySelectorAll('.choice'), function (card) {
      var on = card.getAttribute('data-choice') === choice;
      card.classList.toggle('is-on', on);
      card.querySelector('input').checked = on;
    });
    document.getElementById('eGoText').textContent = 'Entrar en ' + NAMES[choice];
  }

  function build(user) {
    document.getElementById('eIconDesk').innerHTML = ico('monitor', 34);
    document.getElementById('eIconGo').innerHTML = ico('smartphone', 34);
    document.getElementById('eCheckDesk').innerHTML = ico('check', 17);
    document.getElementById('eCheckGo').innerHTML = ico('check', 17);
    document.getElementById('eGoArrow').innerHTML = ico('arrowRight', 22);

    var name = firstName(user);
    document.getElementById('eHello').textContent = name ? 'Hola, ' + name : 'Hola';
    var who = document.getElementById('eWho');
    who.innerHTML = '';
    who.appendChild(document.createTextNode(name ? '¿No eres ' + name + '? ' : ''));
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = 'Cerrar sesión';
    b.addEventListener('click', logout);
    who.appendChild(b);

    if (from === 'desk' || from === 'go') {
      document.getElementById('eSub').textContent = 'Cambia de versión sin volver a iniciar sesión. Tus datos son los mismos en las dos.';
      if (from === 'desk') document.getElementById('eBadgeDesk').textContent = 'Estás aquí';
      if (from === 'go') document.getElementById('eHereGo').hidden = false;
    }

    Array.prototype.forEach.call(document.querySelectorAll('.choice input'), function (input) {
      input.addEventListener('change', function () { choice = input.value; paintChoice(); });
    });
    paintChoice();
    root.hidden = false;
    var checked = document.querySelector('.choice input:checked');
    if (checked) checked.focus({ preventScroll: true });
  }

  /* ---------- Entrar ---------- */

  function proceed() {
    var btn = document.getElementById('eGo');
    btn.disabled = true;
    var done = false;
    function nav() { if (done) return; done = true; location.href = URLS[choice]; }
    setTimeout(nav, 1200);
    // La sesión adopta la ventana de inactividad de la versión elegida
    // (30 minutos en Desk, 24 horas en Go) antes de cambiar de página.
    fetch('/api/auth/heartbeat', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: choice === 'go' ? 'campo' : 'desk' })
    }).then(nav, nav);
  }

  document.getElementById('eGo').addEventListener('click', proceed);
  document.getElementById('eLogoutTop').addEventListener('click', logout);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !root.hidden && e.target.tagName !== 'BUTTON') { e.preventDefault(); proceed(); }
  });

  /* ---------- Arranque ---------- */

  function start(user) {
    var a = accessOf(user);
    if (!(a.desk && a.go)) { location.replace(a.go ? URLS.go : 'index.html'); return false; }
    build(user);
    return true;
  }

  // Se pinta ya con lo guardado (sin esperar a la red) y se confirma con el servidor
  var local = cached();
  var shown = local ? start(local) : false;

  fetch('/api/auth/me', { credentials: 'include' }).then(function (res) {
    if (res.status === 401) { if (navigator.onLine) { try { localStorage.removeItem('sr:auth'); } catch (e) {} location.replace('login.html'); } return null; }
    return res.ok ? res.json() : null;
  }).then(function (user) {
    if (!user) return;
    cache(user);
    var a = accessOf(user);
    if (!(a.desk && a.go)) { location.replace(a.go ? URLS.go : 'index.html'); return; }
    if (!shown) start(user);
  }).catch(function () {
    // Sin conexión: si hay datos guardados ya se ha pintado; si no, no se puede saber qué versiones tiene
    if (!shown) location.replace('login.html');
  });
})();
