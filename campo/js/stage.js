/* ==========================================================================
   Safety Go — Vista de móvil en ordenador
   --------------------------------------------------------------------------
   En un ordenador (pantalla ancha y ratón), /campo/ no ocupa toda la pantalla:
   muestra un teléfono con Safety Go dentro, en tamaño de móvil real, para ver
   y probar cómo funciona en planta. El teléfono es un iframe de /campo/ de
   390 px de ancho, así que la aplicación aplica de verdad su diseño de móvil, y
   comparte con Safety Desk el mismo almacenamiento del navegador: los datos
   de la demostración son los mismos y lo que se haga en uno se ve en el otro.
   En un móvil, una tablet o con «Pantalla completa», este archivo no se carga.
   ========================================================================== */
(function () {
  'use strict';

  var W = 414, H = 868;           // marco del teléfono (pantalla de 390 × 844 + 12 px de borde)

  function auth() {
    try { return JSON.parse(localStorage.getItem('sr:auth') || 'null') || {}; } catch (e) { return {}; }
  }
  var me = auth();
  var access = me.access || { desk: true, go: true };
  var demo = me.role === 'usuario';

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  var url = location.origin + '/campo/';

  var steps = [
    'Elige una planta en la parte de arriba',
    'Empieza una visita desde «Cuestionarios»'
  ];
  if (access.desk) steps.push('Vuelve a Safety Desk y verás el resultado');

  var root = document.createElement('div');
  root.className = 'stage';
  root.innerHTML =
    '<header class="stage__top">' +
      '<div class="stage__brand"><span class="stage__mark" aria-hidden="true">' +
        '<svg width="22" height="22" viewBox="0 0 100 100" fill="none"><path d="M50 10 L86 25 V52 C86 71 71 85 50 92 C29 85 14 71 14 52 V25 Z" stroke="#fff" stroke-width="7"/><path d="M34 51 L45 62 L67 38" stroke="#F16B6B" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</span><span>Safety Rounds</span></div>' +
      (access.desk ? '<a class="stage__toplink" href="../index.html">' + ico('monitor', 16) + '<span>Volver a Safety Desk</span></a>' : '') +
    '</header>' +

    '<main class="stage__main">' +
      '<section class="stage__info">' +
        '<span class="stage__eyebrow">' + ico('smartphone', 15) + '<span>Vista de móvil</span></span>' +
        '<h1 class="stage__title">Safety Go,<br>como se ve en un móvil</h1>' +
        '<p class="stage__text">Pruébala igual que en planta: pulsa, desliza y rellena una visita. ' +
          (demo ? 'Usa los datos de la demostración, los mismos que ves en Safety Desk.' : 'Usa los mismos datos que Safety Desk.') + '</p>' +
        '<ol class="stage__steps">' +
          steps.map(function (t, i) { return '<li><b>' + (i + 1) + '</b><span>' + esc(t) + '</span></li>'; }).join('') +
        '</ol>' +
        '<div class="stage__actions">' +
          (access.desk ? '<a class="stage__btn stage__btn--primary" href="../index.html">' + ico('monitor', 18) + '<span>Volver a Safety Desk</span></a>' : '') +
          '<button class="stage__btn" id="stFull" type="button">' + ico('external', 18) + '<span>Pantalla completa</span></button>' +
        '</div>' +
        '<p class="stage__note">En un móvil o una tablet de verdad, Safety Go ocupa toda la pantalla. ' +
          'Para probarla allí, entra con tu cuenta en <strong>' + esc(url) + '</strong> ' +
          '<button class="stage__copy" id="stCopy" type="button">Copiar enlace</button></p>' +
      '</section>' +

      '<section class="stage__device-wrap" id="stWrap">' +
        '<div class="device" id="stDevice">' +
          '<span class="device__btn device__btn--silent"></span><span class="device__btn device__btn--up"></span>' +
          '<span class="device__btn device__btn--down"></span><span class="device__btn device__btn--power"></span>' +
          '<div class="device__screen">' +
            '<iframe class="device__frame" id="stFrame" title="Safety Go"></iframe>' +
            '<div class="device__status" aria-hidden="true">' +
              '<span class="device__time" id="stClock">9:41</span>' +
              '<span class="device__island"></span>' +
              '<span class="device__sys">' +
                '<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>' +
                '<svg width="17" height="12" viewBox="0 0 17 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1.5 4.2a10 10 0 0 1 14 0"/><path d="M4 7a6.4 6.4 0 0 1 9 0"/><circle cx="8.5" cy="10" r="1.1" fill="currentColor" stroke="none"/></svg>' +
                '<svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x=".6" y=".6" width="22.8" height="11.8" rx="3.6" stroke="currentColor" opacity=".55"/><rect x="2.4" y="2.4" width="17" height="8.2" rx="2" fill="currentColor"/><path d="M25 4.4v4.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".55"/></svg>' +
              '</span>' +
            '</div>' +
            '<div class="device__home" aria-hidden="true"><span></span></div>' +
          '</div>' +
        '</div>' +
      '</section>' +
    '</main>';

  document.body.appendChild(root);

  /* ---------- El teléfono es la propia aplicación, a tamaño de móvil ---------- */

  document.getElementById('stFrame').src = location.pathname + '?frame=1' + location.hash;

  /* ---------- Ajuste al alto de la ventana ---------- */

  var wrap = document.getElementById('stWrap');
  var device = document.getElementById('stDevice');
  function fit() {
    var top = (document.querySelector('.stage__top') || {}).offsetHeight || 60;
    var room = window.innerHeight - top - 64;
    var s = Math.max(.55, Math.min(1, room / H));
    wrap.style.width = Math.round(W * s) + 'px';
    wrap.style.height = Math.round(H * s) + 'px';
    device.style.transform = 'scale(' + s + ')';
  }
  fit();
  window.addEventListener('resize', fit);

  /* ---------- Reloj de la barra de estado ---------- */

  var clock = document.getElementById('stClock');
  function tick() {
    var d = new Date();
    clock.textContent = d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  }
  tick();
  setInterval(tick, 20000);

  /* ---------- Acciones ---------- */

  document.getElementById('stFull').addEventListener('click', function () {
    try { sessionStorage.setItem('sr:go-full', '1'); } catch (e) {}
    location.reload();
  });

  var copy = document.getElementById('stCopy');
  copy.addEventListener('click', function () {
    function done() { copy.textContent = 'Enlace copiado'; setTimeout(function () { copy.textContent = 'Copiar enlace'; }, 2200); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done);
    else done();
  });
})();
