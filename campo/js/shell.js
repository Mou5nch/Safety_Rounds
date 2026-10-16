/* ==========================================================================
   Safety Rounds · Campo — Contenedor, navegación y arranque
   --------------------------------------------------------------------------
   Pinta la barra superior (planta + estado de sincronización), la navegación
   inferior (móvil) o lateral (tablet horizontal) y arranca la app. También
   hace de «puente» para el motor de visitas compartido con la APP principal
   (js/runner.js), que espera un objeto global `App` con go/setHeader.
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el, esc = UI.esc;
  var Views = global.Views = global.Views || {};

  var TABS = [
    { id: 'home',       label: 'Inicio',        icon: 'home' },
    { id: 'calendar',   label: 'Calendario',    icon: 'calendar' },
    { id: 'forms',      label: 'Cuestionarios', icon: 'clipboard' },
    { id: 'deviations', label: 'Desviaciones',  icon: 'alert' },
    { id: 'actions',    label: 'Acciones',      icon: 'target' }
  ];

  // Rutas de la APP principal que el motor de visitas todavía pide por nombre
  var LEGACY = {
    dashboard: ['home'], calendario: ['calendar'], cuestionarios: ['forms', { seg: 'new' }],
    historico: ['forms', { seg: 'done' }], desviaciones: ['deviations'], acciones: ['actions']
  };

  var current = { tab: 'home', params: {} };
  var mode = 'normal';              // 'normal' | 'run'
  var runExit = null;               // botón «Salir» que aporta el motor de visitas

  /* ======================================================================
     Navegación
     ====================================================================== */

  function go(tab, params) {
    if (!Views[tab]) tab = 'home';
    leaveRun();
    current = { tab: tab, params: params || {} };
    try { history.replaceState(history.state, '', '#' + tab); } catch (e) {}
    paintNav();
    window.scrollTo(0, 0);
    render();
  }

  function render() {
    if (mode !== 'normal') return;
    var view = UI.$('#view');
    view.className = 'view f-page';
    UI.clear(view);
    // Los parámetros (p. ej. pestaña interna a abrir) solo valen para la primera
    // pintura: después manda lo que el usuario vaya eligiendo en la pantalla.
    var params = current.params || {};
    current.params = {};
    try {
      Views[current.tab].render(params);
    } catch (e) {
      console.error(e);
      view.appendChild(Campo.empty('alert', 'No se ha podido mostrar esta pantalla', e.message));
    }
    paintBadges();
  }

  function paintNav() {
    UI.$$('[data-tab]').forEach(function (b) {
      var on = b.getAttribute('data-tab') === current.tab && mode === 'normal';
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  function paintBadges() {
    var openDevs = Store.query('deviations', function (d) { return d.status !== 'closed' && Campo.inPlant(d.centerId); }).length;
    var overdue = Store.query('actions', function (a) {
      return a.status !== 'done' && a.dueDate && UI.relativeDays(a.dueDate) < 0 && Campo.inPlant(a.centerId);
    }).length;
    setBadge('deviations', openDevs);
    setBadge('actions', overdue);
    paintPlantChip();
  }

  function setBadge(tab, n) {
    UI.$$('[data-badge="' + tab + '"]').forEach(function (b) {
      b.textContent = n > 99 ? '99+' : String(n);
      b.hidden = !n;
    });
  }

  /* ======================================================================
     Modo «visita en curso»
     Se oculta la navegación para dejar toda la pantalla al formulario.
     ====================================================================== */

  function runVisit(formId, visitId, prefill) {
    mode = 'run';
    runExit = null;
    document.body.classList.add('is-run');
    paintNav();
    window.scrollTo(0, 0);
    Runner.start(formId, visitId, prefill);
  }

  function leaveRun() {
    if (mode !== 'run') return;
    mode = 'normal';
    runExit = null;
    document.body.classList.remove('is-run');
    UI.clear(UI.$('#fActions'));
    UI.$('#fTitle').textContent = '';
  }

  /** Puente con js/runner.js: espera `App.setHeader(titulo, subtitulo, [botones])`. */
  var App = {
    go: function (route) {
      var m = LEGACY[route] || ['home'];
      go(m[0], m[1]);
    },
    setHeader: function (title, sub, actions) {
      if (mode !== 'run') return;
      UI.$('#fTitle').textContent = title || '';
      UI.$('#fSub').textContent = sub || '';
      var box = UI.$('#fActions');
      UI.clear(box);
      runExit = null;
      (actions || []).forEach(function (a) {
        if (!a) return;
        if (/Salir/.test(a.textContent || '')) runExit = a;
        box.appendChild(a);
      });
    },
    setSubtitle: function (sub) { UI.$('#fSub').textContent = sub || ''; },
    refreshBadges: paintBadges,
    updateStorage: function () {},
    applyBrand: function () {},
    get route() { return current.tab; }
  };
  global.App = App;

  /* ======================================================================
     Barra superior
     ====================================================================== */

  function paintPlantChip() {
    var name = UI.$('#fPlantName');
    if (name) name.textContent = Campo.plantName();
    var chip = UI.$('#fPlant');
    if (chip) chip.classList.toggle('is-filtered', !!Campo.plant());
  }

  function openPlantSheet() {
    var body = el('div');
    var query = '';
    var list = el('div', { class: 'f-list' });
    var s = null;

    function row(id, name, color) {
      var st = Campo.plantStats(id);
      var parts = [];
      parts.push(st.deviations + (st.deviations === 1 ? ' desviación abierta' : ' desviaciones abiertas'));
      if (st.overdueActions) parts.push(st.overdueActions + (st.overdueActions === 1 ? ' acción vencida' : ' acciones vencidas'));
      if (st.dueVisits) parts.push(st.dueVisits + (st.dueVisits === 1 ? ' ronda pendiente' : ' rondas pendientes'));
      var on = (Campo.plant() || '') === id;
      return el('button', {
        class: 'f-pick' + (on ? ' is-on' : ''), type: 'button',
        onclick: function () {
          Campo.setPlant(id);
          s.close();
          render();
          UI.toast(id ? 'Planta: ' + name : 'Mostrando todas las plantas', 'info');
        }
      }, [
        el('span', { class: 'f-pick__dot', style: { background: color } }),
        el('span', { class: 'f-pick__main' }, [
          el('span', { class: 'f-pick__name', text: name }),
          el('span', { class: 'f-pick__sub', text: parts.join(' · ') })
        ]),
        el('span', { class: 'f-pick__check', html: ico('check', 16) })
      ]);
    }

    function paint() {
      UI.clear(list);
      var q = query.trim().toLowerCase();
      if (!q) list.appendChild(row('', 'Todas las plantas', '#1E2B6F'));
      var cs = Campo.centers().filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) !== -1; });
      cs.forEach(function (c) { list.appendChild(row(c.id, c.name, c.color || '#4356AE')); });
      if (!cs.length && q) list.appendChild(Campo.empty('search', 'Sin resultados', 'Prueba con otro nombre.'));
      if (!Campo.centers().length) {
        list.appendChild(Campo.empty('building', 'Todavía no hay plantas',
          'Las plantas se dan de alta en la APP principal (Ajustes → Centros e instalaciones) y aparecen aquí al sincronizar.'));
      }
    }

    if (Campo.centers().length > 7) {
      body.appendChild(Campo.searchBox('', 'Buscar planta…', function (v) { query = v; paint(); }));
    }
    body.appendChild(list);
    paint();

    s = Campo.sheet({ title: 'Planta o centro de trabajo', subtitle: 'Filtra calendario, cuestionarios, desviaciones y acciones.', body: body });
  }

  /* ======================================================================
     Estado de sincronización y perfil
     ====================================================================== */

  var SYNC_LABEL = {
    synced: 'Sincronizado', idle: 'Al día', syncing: 'Sincronizando…', pending: 'Pendiente de subir',
    offline: 'Sin conexión', auth: 'Sesión caducada', error: 'Error de sincronización', off: 'Sin sincronizar'
  };

  function paintSync(s) {
    var b = UI.$('#fSync');
    if (!b) return;
    b.setAttribute('data-status', s.status);
    var pend = UI.$('#fSyncCount');
    pend.textContent = s.pending > 99 ? '99+' : String(s.pending);
    pend.hidden = !s.pending;
    b.setAttribute('aria-label', (SYNC_LABEL[s.status] || s.status) + (s.pending ? ' · ' + s.pending + ' pendientes' : ''));
    b.querySelector('.f-sync__icon').innerHTML = ico(s.status === 'offline' ? 'cloudOff' : s.status === 'syncing' ? 'refresh' : 'cloud', 20);

    var off = UI.$('#fOffline');
    if (off) {
      var offline = s.status === 'offline' || navigator.onLine === false;
      off.hidden = !offline;
      if (offline) UI.$('#fOfflineText').textContent = s.pending
        ? 'Sin conexión · ' + s.pending + ' ' + UI.plural(s.pending, 'cambio') + ' por subir. Se enviarán solos al volver la cobertura.'
        : 'Sin conexión · puedes seguir trabajando, todo se guarda en el dispositivo.';
    }
  }

  function openProfile() {
    var me = Campo.auth();
    var body = el('div');

    body.appendChild(el('div', { class: 'f-profile' }, [
      el('div', { class: 'f-avatar f-avatar--lg', text: Campo.initials(me.name || me.username) }),
      el('div', {}, [
        el('div', { class: 'f-profile__name', text: me.name || me.username || 'Usuario' }),
        el('div', { class: 'f-profile__sub', text: roleLabel(me.role) + (me.username ? ' · ' + me.username : '') })
      ])
    ]));

    var offSync = function () {};
    if (me.role === 'usuario') {
      // Cuenta de demostración: sin servidor; los datos viven en este navegador y los comparten Desk y Go
      body.appendChild(el('div', { class: 'f-section-title', text: 'Cuenta de demostración' }));
      body.appendChild(el('div', { class: 'f-card f-card--flat' },
        el('div', { class: 'f-hint', style: { padding: '12px 0' }, text: 'Estás probando Safety Rounds con datos de ejemplo. Viven en este navegador y los comparten Safety Desk y Safety Go: lo que hagas aquí lo verás en Safety Desk, y al revés.' })));
    } else {
    // --- Sincronización ---
    var box = el('div', { class: 'f-card f-card--flat' });
    var line = el('div', { class: 'f-row' });
    var tag = el('span', { class: 'tag' });
    var when = el('div', { class: 'f-hint' });
    line.appendChild(tag);
    box.appendChild(line);
    box.appendChild(when);
    function paint(st) {
      var map = { synced: 'ok', idle: 'ok', syncing: 'navy', pending: 'warn', offline: 'warn', auth: 'danger', error: 'danger' };
      tag.className = 'tag tag--' + (map[st.status] || '');
      tag.textContent = (SYNC_LABEL[st.status] || st.status) + (st.pending ? ' (' + st.pending + ')' : '');
      when.textContent = st.lastSync ? 'Última sincronización: ' + UI.fmtDateTime(st.lastSync) : 'Todavía no se ha sincronizado.';
      if (st.error) when.textContent += ' ' + st.error;
    }
    paint(Sync.status());
    offSync = Sync.on(function (st) { paint(st); });
    box.appendChild(el('button', {
      class: 'btn btn--navy btn--block f-btn', style: { marginTop: '12px' },
      html: ico('refresh', 18) + '<span>Sincronizar ahora</span>',
      onclick: function () { Sync.now(); }
    }));
    body.appendChild(el('div', { class: 'f-section-title', text: 'Sincronización' }));
    body.appendChild(box);
    }

    // --- Dispositivo ---
    var dev = el('div', { class: 'f-card f-card--flat' });
    var used = el('span', { text: '…' });
    dev.appendChild(el('div', { class: 'f-kv' }, [el('span', { text: 'Datos en este dispositivo' }), used]));
    dev.appendChild(el('div', { class: 'f-kv' }, [el('span', { text: 'Versión' }), el('span', { text: 'v' + Store.APP_VERSION + ' · Campo' })]));
    Store.usage().then(function (u) { used.textContent = Store.formatBytes(u.used); });
    body.appendChild(el('div', { class: 'f-section-title', text: 'Este dispositivo' }));
    body.appendChild(dev);

    // Administración y supervisor pueden cargar la demostración (la de la APP principal)
    if (me.role === 'admin' || me.role === 'supervisor') {
      body.appendChild(el('div', { class: 'f-section-title', text: 'Datos de demostración' }));
      body.appendChild(el('div', { class: 'f-card f-card--flat' }, [
        el('div', { class: 'f-hint', style: { padding: '12px 0 4px' }, text: 'Carga los cuestionarios, plantas, visitas, desviaciones y acciones de ejemplo para probar la aplicación. Sustituye los datos compartidos.' }),
        el('button', {
          class: 'btn btn--ghost btn--block f-btn', style: { margin: '10px 0 12px' }, html: ico('download', 18) + '<span>Cargar la demostración</span>',
          onclick: function () {
            UI.confirm({
              title: 'Cargar la demostración', text: 'Sustituye TODOS los datos compartidos (visitas, desviaciones, acciones, cuestionarios y plantas) por los de ejemplo, en todos los dispositivos. No se puede deshacer.',
              confirmLabel: 'Sí, cargarla', cancelLabel: 'Cancelar', icon: 'download', confirmIcon: 'download'
            }).then(function (ok) {
              if (!ok) return;
              Seed.loadSharedDemo().then(function () {
                Sync.now();
                UI.toast('Demostración cargada.');
                Shell.render();
              }).catch(function (e) { UI.toast(e.message || 'No se ha podido cargar la demostración.', 'err'); });
            });
          }
        })
      ]));
    }

    if (me.role === 'usuario') {
      body.appendChild(el('div', { class: 'f-section-title', text: 'Datos de demostración' }));
      body.appendChild(el('div', { class: 'f-card f-card--flat' }, [
        el('div', { class: 'f-hint', style: { padding: '12px 0 4px' }, text: 'Vuelve a cargar los datos de ejemplo (cuestionarios, plantas, visitas, desviaciones y acciones). Sustituye lo que tengas ahora en este navegador, en Safety Go y en Safety Desk.' }),
        el('button', {
          class: 'btn btn--ghost btn--block f-btn', style: { margin: '10px 0 12px' }, html: ico('download', 18) + '<span>Restaurar la demostración</span>',
          onclick: function () {
            UI.confirm({
              title: 'Restaurar la demostración', text: 'Sustituye TODOS tus datos de este navegador por los de ejemplo. No se puede deshacer.',
              confirmLabel: 'Sí, restaurar', cancelLabel: 'Cancelar', icon: 'download', confirmIcon: 'download'
            }).then(function (ok) {
              if (!ok) return;
              Seed.loadSharedDemo({ local: true }).then(function () {
                UI.toast('Demostración restaurada.');
                Shell.render();
              }).catch(function (e) { UI.toast(e.message || 'No se ha podido restaurar la demostración.', 'err'); });
            });
          }
        })
      ]));
    }

    body.appendChild(el('div', { class: 'f-stack', style: { marginTop: '18px' } }, [
      // «Cambiar a Safety Desk»: solo para quien tiene acceso a las dos versiones
      (accessOf(me).desk && accessOf(me).go) ? el('a', {
        class: 'btn btn--ghost btn--block f-btn', href: '../entrar.html?from=go', target: '_top',
        html: ico('monitor', 18) + '<span>Cambiar a Safety Desk</span>'
      }) : null,
      // En un ordenador con «Pantalla completa»: volver a verla dentro del teléfono
      window.__goMode === 'full' ? el('button', {
        class: 'btn btn--ghost btn--block f-btn', type: 'button', html: ico('smartphone', 18) + '<span>Ver como móvil</span>',
        onclick: function () { try { sessionStorage.removeItem('sr:go-full'); } catch (e) {} location.href = '/campo/'; }
      }) : null,
      el('button', {
        class: 'btn btn--danger btn--block f-btn', html: ico('logout', 18) + '<span>Cerrar sesión</span>',
        onclick: logout
      })
    ]));

    Campo.sheet({ title: 'Mi cuenta', body: body, onClose: offSync });
  }

  /** Versiones a las que tiene acceso la cuenta (sin dato guardado: las dos). */
  function accessOf(me) {
    return (me && me.access) || { desk: true, go: true };
  }

  function roleLabel(r) {
    return { admin: 'Administración', supervisor: 'Supervisor', inspector: 'Inspector', usuario: 'Demostración' }[r] || 'Usuario';
  }

  /** Salir a otra página (login, Safety Desk) en la ventana completa, no dentro del teléfono de la vista de móvil. */
  function leave(url) {
    if (window.__leave) window.__leave(url); else location.replace(url);
  }

  function logout() {
    var pending = Sync.pending() + (global.Mailer ? Mailer.pending() : 0);
    var go = function () {
      fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(function () {}).then(function () {
        try { localStorage.removeItem('sr:auth'); } catch (e) {}
        leave('../login.html?next=/campo/');
      });
    };
    if (!pending) { go(); return; }
    UI.confirm({
      title: 'Hay cambios sin subir',
      text: 'Tienes ' + pending + ' ' + UI.plural(pending, 'cambio') + ' pendientes de enviar al servidor. Seguirán guardados en este dispositivo y se subirán la próxima vez que entres con conexión. ¿Cerrar sesión igualmente?',
      confirmLabel: 'Cerrar sesión', cancelLabel: 'Volver', danger: false, icon: 'logout'
    }).then(function (ok) { if (ok) go(); });
  }

  /* ---------- Sesión caducada: se vuelve a pedir la contraseña sin perder nada ---------- */

  var reloginOpen = false;
  function relogin() {
    if (reloginOpen) return;
    reloginOpen = true;
    var me = Campo.auth();
    var pass = el('input', { class: 'input', type: 'password', placeholder: 'Contraseña', autocomplete: 'current-password' });
    var err = el('div', { class: 'f-hint', style: { color: 'var(--coral-dark)', minHeight: '18px' } });
    var s = null;

    function submit() {
      if (!pass.value) return;
      err.textContent = '';
      fetch('/api/auth/login', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: me.username, password: pass.value, client: 'campo' })
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, b: b }; }); })
        .then(function (r) {
          if (!r.ok) { err.textContent = r.b.error || 'No se ha podido iniciar sesión.'; return; }
          try { localStorage.setItem('sr:auth', JSON.stringify({ username: r.b.username, name: r.b.name, role: r.b.role, access: r.b.access, cachedAt: Date.now() })); } catch (e) {}
          s.close();
          UI.toast('Sesión renovada. Sincronizando…', 'info');
          Sync.now();
        }).catch(function () { err.textContent = 'Sin conexión con el servidor.'; });
    }
    pass.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });

    s = Campo.sheet({
      title: 'Vuelve a identificarte',
      subtitle: 'Tu sesión ha caducado. No se ha perdido nada: lo que hayas hecho sigue guardado en el dispositivo y se subirá al entrar.',
      body: el('div', {}, [
        el('div', { class: 'f-hint', style: { marginBottom: '10px' }, text: 'Usuario: ' + (me.username || '') }),
        pass, err
      ]),
      footer: [el('button', { class: 'btn btn--primary btn--block f-btn', html: ico('check', 18) + '<span>Entrar</span>', onclick: submit })],
      onClose: function () { reloginOpen = false; }
    });
    setTimeout(function () { pass.focus(); }, 250);
  }

  /* ======================================================================
     Arranque
     ====================================================================== */

  function buildChrome() {
    var tabsBar = UI.$('#fTabs'), rail = UI.$('#fRail');
    UI.$('#fBack').innerHTML = ico('arrowLeft', 22);
    UI.$('#fPlantIcon').innerHTML = ico('building', 20);
    UI.$('#fPlantChev').innerHTML = ico('chevronDown', 18);
    UI.$('#fOfflineIcon').innerHTML = ico('cloudOff', 18);
    TABS.forEach(function (t) {
      function mk(cls) {
        return el('button', {
          class: cls, type: 'button', 'data-tab': t.id, onclick: function () { go(t.id); }
        }, [
          el('span', { class: cls + '__icon', html: ico(t.icon, 24) }),
          el('span', { class: cls + '__label', text: t.label }),
          (t.id === 'deviations' || t.id === 'actions')
            ? el('span', { class: 'f-badge', 'data-badge': t.id, hidden: true }) : null
        ]);
      }
      tabsBar.appendChild(mk('f-tab'));
      rail.appendChild(mk('f-railitem'));
    });

    UI.$('#fPlant').addEventListener('click', openPlantSheet);
    UI.$('#fSync').addEventListener('click', openProfile);
    UI.$('#fAvatar').addEventListener('click', openProfile);
    UI.$('#fBack').addEventListener('click', function () {
      if (mode === 'run' && runExit) runExit.click();
      else go('home');
    });

    var me = Campo.auth();
    UI.$('#fAvatar').textContent = Campo.initials(me.name || me.username);

    Sync.on(paintSync);
    paintSync(Sync.status());
    window.addEventListener('online', function () { paintSync(Sync.status()); });
    window.addEventListener('offline', function () { paintSync(Sync.status()); });
  }

  function refreshIfIdle() {
    if (mode !== 'normal') return;
    var busy = UI.$('#sheetRoot .sheet-root') || UI.$('#modalRoot .overlay') || UI.$('#view input:focus, #view textarea:focus, #view select:focus');
    if (busy) { paintBadges(); return; }
    var y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }

  function boot() {
    var me = Campo.auth();
    if (me.access && me.access.go === false) { leave('../index.html'); return; }
    // Cuenta de demostración: sin servidor; los datos de ejemplo viven en este navegador y los
    // comparten Safety Desk y Safety Go (mismo almacenamiento).
    var demo = me.role === 'usuario';

    Store.init().then(function () {
      if (demo) Sync.resetForDemo();
      return Sync.start();
    }).then(function () {
      // Demostración: la propia de la cuenta, o (datos compartidos en blanco) la que carga un administrador
      return demo ? Seed.ensureLocalDemo() : Seed.ensureSharedDemo();
    }).then(function () {
      Store.migrate();
      buildChrome();

      Sync.onRemote(function () { clearTimeout(boot.t); boot.t = setTimeout(refreshIfIdle, 350); });
      Sync.onAuthLost(relogin);
      Campo.onPlant(function () { paintPlantChip(); });
      window.addEventListener('sr:mail', function () { clearTimeout(boot.t); boot.t = setTimeout(refreshIfIdle, 200); });

      var hash = (location.hash || '').replace('#', '');
      go(Views[hash] ? hash : 'home');

      // Sesión: se confirma con el servidor y se mantiene viva con un latido
      function check() {
        if (navigator.onLine === false) return;
        fetch('/api/auth/me', { credentials: 'include' }).then(function (r) {
          if (r.status === 401) relogin();
          else if (r.ok) return r.json().then(function (u) {
            try { localStorage.setItem('sr:auth', JSON.stringify({ username: u.username, name: u.name, role: u.role, access: u.access, cachedAt: Date.now() })); } catch (e) {}
            // Si le quitan el acceso a Safety Go mientras tiene la pantalla abierta, se le lleva a Safety Desk
            if (u.access && u.access.go === false) leave('../index.html');
          });
        }).catch(function () {});
      }
      // El latido indica que esta sesión se usa desde Safety Go: adopta la ventana de 24 horas
      function heartbeat() {
        fetch('/api/auth/heartbeat', {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client: 'campo' })
        }).then(function (r) { if (r.status === 401) relogin(); }).catch(function () {});
      }
      check();
      if (navigator.onLine !== false) heartbeat();
      setInterval(function () {
        if (document.visibilityState === 'visible' && navigator.onLine !== false) {
          heartbeat();
        }
      }, 60 * 1000);

      if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      }
    }).catch(function (e) {
      console.error(e);
      document.body.innerHTML = '<div style="max-width:480px;margin:18vh auto;padding:24px;font-family:sans-serif"><h1 style="font-size:20px">No se ha podido iniciar la aplicación</h1><p style="color:#4A5378;line-height:1.6">' + esc(e.message) + '</p>' +
        '<button id="srRepair" style="margin-top:10px;height:50px;padding:0 22px;border:0;border-radius:12px;background:#F16B6B;color:#fff;font:600 16px sans-serif">Actualizar la aplicación</button>' +
        '<p style="color:#7A83A3;font-size:13px;line-height:1.5">Borra los archivos guardados de versiones anteriores y recarga. Tus datos no se tocan.</p></div>';
      var b = document.getElementById('srRepair');
      if (b) b.addEventListener('click', function () { if (global.Sync && Sync.repair) Sync.repair(); else location.reload(); });
    });
  }

  global.Shell = {
    go: go, render: render, runVisit: runVisit, refresh: refreshIfIdle,
    openPlantSheet: openPlantSheet, openProfile: openProfile, paintBadges: paintBadges
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
