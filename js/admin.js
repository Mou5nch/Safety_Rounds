/* ==========================================================================
   Safety Rounds — Panel de accesos (admin.html)
   Lista los usuarios ficticios y su historial de sesiones: cuándo entraron,
   cuánto tiempo estuvieron conectados y si siguen activos ahora mismo.
   ========================================================================== */
(function () {
  'use strict';

  var el = UI.el, esc = UI.esc;
  var root = document.getElementById('adminRoot');

  document.getElementById('adminLogout').addEventListener('click', function () {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(function () {})
      .then(function () {
        try { localStorage.removeItem('sr:auth'); } catch (e) {}
        location.href = 'login.html';
      });
  });

  function fmtDuration(seconds) {
    seconds = Math.max(0, Math.round(seconds || 0));
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    if (h) return h + ' h ' + m + ' min';
    if (m) return m + ' min ' + s + ' s';
    return s + ' s';
  }

  function fmtWhen(iso) {
    if (!iso) return '—';
    return UI.fmtDateTime ? UI.fmtDateTime(iso) : new Date(iso).toLocaleString('es-ES');
  }

  // Mismas pantallas que el menú principal (js/app.js ROUTES), para el mapa
  // de calor de actividad por usuario.
  var ROUTE_ORDER = ['dashboard', 'cuestionarios', 'historico', 'desviaciones', 'acciones', 'configuracion', 'ajustes'];
  var ROUTE_META = {
    dashboard: { label: 'Dashboard', icon: 'barChart' },
    cuestionarios: { label: 'Cuestionarios', icon: 'clipboardList' },
    historico: { label: 'Visitas realizadas', icon: 'checkCircle' },
    desviaciones: { label: 'Desviaciones', icon: 'alert' },
    acciones: { label: 'Plan de acción', icon: 'target' },
    configuracion: { label: 'Configuración', icon: 'sliders' },
    ajustes: { label: 'Ajustes y datos', icon: 'database' }
  };

  function load() {
    Promise.all([
      fetch('/api/admin/users', { credentials: 'include' }),
      fetch('/api/admin/sessions', { credentials: 'include' })
    ]).then(function (responses) {
      if (responses.some(function (r) { return r.status === 401; })) {
        location.replace('login.html?next=/admin.html');
        return null;
      }
      if (responses.some(function (r) { return r.status === 403; })) {
        throw new Error('forbidden');
      }
      return Promise.all(responses.map(function (r) { return r.json(); }));
    }).then(function (data) {
      if (!data) return;
      render(data[0], data[1]);
    }).catch(function (e) {
      UI.clear(root);
      root.appendChild(el('div', { class: 'card' }, el('div', { class: 'card__body' },
        e && e.message === 'forbidden'
          ? UI.empty('shield', 'Sin permisos', 'Esta cuenta no tiene rol de administración. Entra con el usuario «admin» de las cuentas de prueba.')
          : UI.empty('alertCircle', 'No se ha podido cargar', 'Comprueba tu conexión e inténtalo de nuevo.'))));
    });
  }

  function render(users, sessions) {
    var activeByUser = {};
    sessions.forEach(function (s) { if (s.active) activeByUser[s.username] = true; });

    UI.clear(root);

    root.appendChild(el('div', { class: 'admin-stats' }, [
      stat('Usuarios', users.length),
      stat('Conectados ahora', sessions.filter(function (s) { return s.active; }).length),
      stat('Sesiones registradas', sessions.length)
    ]));

    root.appendChild(usersCard(users, activeByUser));
    root.appendChild(sessionsCard(sessions));
  }

  function stat(label, value) {
    return el('div', { class: 'admin-stat' }, [
      el('div', { class: 'admin-stat__value', text: String(value) }),
      el('div', { class: 'admin-stat__label', text: label })
    ]);
  }

  function usersCard(users, activeByUser) {
    var card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'card__head' }, [
      el('div', {}, [
        el('div', { class: 'card__title', text: 'Usuarios ficticios' }),
        el('div', { class: 'card__sub', text: 'Cuentas de prueba para seguir el acceso a la aplicación.' })
      ]),
      el('div', { class: 'card__actions' }, el('button', {
        class: 'btn btn--primary btn--sm', html: ico('plus', 15) + '<span>Nuevo usuario</span>',
        onclick: openCreateModal
      }))
    ]));

    var body = el('div', { class: 'card__body', style: { padding: '0' } });
    if (!users.length) {
      body.appendChild(el('div', { style: { padding: '20px' } }, UI.empty('users', 'Sin usuarios', 'Crea el primero con «Nuevo usuario».')));
    } else {
      var table = el('table', { class: 'table' });
      table.appendChild(el('thead', {}, el('tr', {}, [
        el('th', { text: 'Usuario' }), el('th', { text: 'Rol' }), el('th', { text: 'Estado' }),
        el('th', { text: 'Sesiones' }), el('th', { text: 'Última conexión' }), el('th', { text: 'Tiempo conectado' }), el('th', {})
      ])));
      var tbody = el('tbody');
      users.forEach(function (u) {
        tbody.appendChild(el('tr', {}, [
          el('td', {}, [
            el('div', { text: u.name }),
            el('div', { class: 'hint', style: { margin: 0 }, text: '@' + u.username + (u.email ? ' · ' + u.email : ' · sin correo (recuperación solo por el admin)') })
          ]),
          el('td', {}, el('span', { class: 'tag ' + (u.role === 'usuario' ? 'tag--warn' : 'tag--navy'), text: roleLabel(u.role) })),
          el('td', {}, el('span', {
            class: 'tag ' + (activeByUser[u.username] ? 'tag--ok' : ''), text: activeByUser[u.username] ? 'Conectado' : 'Sin conexión'
          })),
          el('td', { text: String(u.session_count) }),
          el('td', { text: fmtWhen(u.last_seen_at) }),
          el('td', { text: fmtDuration(u.total_seconds) }),
          el('td', {}, el('div', { style: { display: 'flex', gap: '4px' } }, [
            el('button', {
              class: 'btn btn--quiet btn--sm btn--icon', title: 'Ver actividad', html: ico('activity', 15),
              onclick: function () { openActivity(u); }
            }),
            el('button', {
              class: 'btn btn--quiet btn--sm btn--icon', title: 'Restablecer contraseña', html: ico('refresh', 15),
              onclick: function () { resetPassword(u); }
            }),
            el('button', {
              class: 'btn btn--quiet btn--sm btn--icon', title: 'Eliminar usuario', html: ico('trash', 15),
              onclick: function () { deleteUser(u); }
            })
          ]))
        ]));
      });
      table.appendChild(tbody);
      body.appendChild(el('div', { style: { overflowX: 'auto' } }, table));
    }
    card.appendChild(body);
    return card;
  }

  function roleLabel(role) {
    if (role === 'admin') return 'Administración';
    if (role === 'supervisor') return 'Supervisor';
    if (role === 'usuario') return 'Usuario (autorregistrado)';
    return 'Inspector';
  }

  /* ---------- Mapa de calor de actividad ---------- */

  function openActivity(u) {
    fetch('/api/admin/users/' + u.id + '/activity', { credentials: 'include' })
      .then(function (res) { if (!res.ok) throw new Error(); return res.json(); })
      .then(function (rows) { renderActivityModal(u, rows); })
      .catch(function () { UI.toast('No se ha podido cargar la actividad de este usuario.', 'err'); });
  }

  function renderActivityModal(u, rows) {
    var byRoute = {};
    rows.forEach(function (r) { byRoute[r.route] = r; });
    var totalSeconds = rows.reduce(function (a, r) { return a + r.seconds; }, 0);
    var totalVisits = rows.reduce(function (a, r) { return a + r.visits; }, 0);
    var maxSeconds = rows.reduce(function (m, r) { return Math.max(m, r.seconds); }, 0);

    var body = el('div', {});

    if (!totalVisits) {
      body.appendChild(UI.empty('activity', 'Sin actividad todavía',
        'Esta cuenta no ha navegado por la aplicación desde que se activó el seguimiento, o entró antes de que existiera esta función.'));
    } else {
      var grid = el('div', { class: 'heatmap' });
      ROUTE_ORDER.forEach(function (key) {
        var r = byRoute[key];
        var seconds = r ? r.seconds : 0;
        var visits = r ? r.visits : 0;
        var intensity = maxSeconds ? seconds / maxSeconds : 0;
        grid.appendChild(heatCell(ROUTE_META[key], visits, seconds, intensity));
      });
      body.appendChild(grid);

      var ranked = ROUTE_ORDER
        .map(function (key) { return { label: ROUTE_META[key].label, seconds: byRoute[key] ? byRoute[key].seconds : 0, visits: byRoute[key] ? byRoute[key].visits : 0 }; })
        .filter(function (r) { return r.visits; })
        .sort(function (a, b) { return b.seconds - a.seconds; });

      var list = el('div', { class: 'bar-list', style: { marginTop: '22px' } });
      ranked.forEach(function (r) {
        var pct = totalSeconds ? Math.round(r.seconds / totalSeconds * 100) : 0;
        list.appendChild(el('div', { class: 'bar-item' }, [
          el('div', { class: 'bar-item__top' }, [
            el('span', { class: 'bar-item__name', text: r.label }),
            el('span', {
              class: 'bar-item__val',
              text: fmtDuration(r.seconds) + ' · ' + r.visits + ' ' + (r.visits === 1 ? 'visita' : 'visitas') + ' · ' + pct + ' %'
            })
          ]),
          el('div', { class: 'bar-item__track' }, el('div', {
            class: 'bar-item__fill',
            style: { width: (maxSeconds ? r.seconds / maxSeconds * 100 : 0) + '%', background: 'linear-gradient(90deg,#4356AE,#F16B6B)' }
          }))
        ]));
      });
      body.appendChild(list);
    }

    UI.modal({
      title: 'Actividad de ' + u.name,
      subtitle: '@' + u.username + ' · tiempo por pantalla desde que empezó el seguimiento',
      icon: 'activity',
      size: 'wide',
      body: body,
      buttons: [{ label: 'Cerrar', kind: 'quiet' }]
    });
  }

  function heatCell(meta, visits, seconds, intensity) {
    var alpha = visits ? (0.10 + intensity * 0.75) : 0.05;
    var strong = intensity > 0.55;
    return el('div', {
      class: 'heat-cell',
      style: { background: 'rgba(67,86,174,' + alpha.toFixed(2) + ')', color: strong ? '#fff' : 'var(--ink)' }
    }, [
      el('div', { class: 'heat-cell__icon', html: ico(meta.icon, 18) }),
      el('div', { class: 'heat-cell__label', text: meta.label }),
      el('div', { class: 'heat-cell__value', text: visits ? fmtDuration(seconds) : '—' }),
      el('div', { class: 'heat-cell__sub', text: visits ? (visits + ' ' + (visits === 1 ? 'visita' : 'visitas')) : 'Sin visitas' })
    ]);
  }

  function sessionsCard(sessions) {
    var card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'card__head' }, el('div', {}, [
      el('div', { class: 'card__title', text: 'Registro de sesiones' }),
      el('div', { class: 'card__sub', text: 'Las 200 conexiones más recientes.' })
    ])));

    var body = el('div', { class: 'card__body', style: { padding: '0' } });
    if (!sessions.length) {
      body.appendChild(el('div', { style: { padding: '20px' } }, UI.empty('clock', 'Sin sesiones todavía', 'Aparecerán aquí en cuanto alguien inicie sesión.')));
    } else {
      var table = el('table', { class: 'table' });
      table.appendChild(el('thead', {}, el('tr', {}, [
        el('th', { text: 'Usuario' }), el('th', { text: 'Entrada' }), el('th', { text: 'Salida' }),
        el('th', { text: 'Duración' }), el('th', { text: 'Estado' }), el('th', { text: 'IP' })
      ])));
      var tbody = el('tbody');
      sessions.forEach(function (s) {
        tbody.appendChild(el('tr', {}, [
          el('td', { text: s.name || s.username }),
          el('td', { text: fmtWhen(s.login_at) }),
          el('td', { text: s.logout_at ? fmtWhen(s.logout_at) : '—' }),
          el('td', { text: fmtDuration(s.duration_seconds) }),
          el('td', {}, el('span', { class: 'tag ' + (s.active ? 'tag--ok' : ''), text: s.active ? 'Activa' : 'Cerrada' })),
          el('td', { text: s.ip || '—' })
        ]));
      });
      table.appendChild(tbody);
      body.appendChild(el('div', { style: { overflowX: 'auto' } }, table));
    }
    card.appendChild(body);
    return card;
  }

  function openCreateModal() {
    var userEl = el('input', { class: 'input', placeholder: 'p. ej. jorge.diaz' });
    var nameEl = el('input', { class: 'input', placeholder: 'Nombre completo' });
    var emailEl = el('input', { class: 'input', type: 'email', placeholder: 'jorge.diaz@empresa.com' });
    var passEl = el('input', { class: 'input', type: 'text', placeholder: 'Contraseña' });
    var roleEl = el('select', { class: 'select' }, [
      el('option', { value: 'inspector', text: 'Inspector' }),
      el('option', { value: 'supervisor', text: 'Supervisor' }),
      el('option', { value: 'admin', text: 'Administración' }),
      el('option', { value: 'usuario', text: 'Usuario (demo)' })
    ]);

    var body = el('div', {}, [
      UI.field('Usuario', userEl, 'Para iniciar sesión sirve tanto este usuario como el correo de abajo.'),
      UI.field('Nombre', nameEl),
      UI.field('Correo (opcional)', emailEl, 'Si lo indicas, esta cuenta también podrá usar «¿Has olvidado tu contraseña?» en el login.'),
      UI.field('Rol', roleEl),
      UI.field('Contraseña', passEl, 'Compártela con quien vaya a usar esta cuenta de prueba.')
    ]);

    UI.modal({
      title: 'Nuevo usuario ficticio',
      icon: 'users',
      body: body,
      buttons: [
        { label: 'Cancelar', kind: 'quiet' },
        {
          label: 'Crear usuario', kind: 'primary', icon: 'plus',
          onClick: function () {
            var payload = {
              username: userEl.value.trim(), name: nameEl.value.trim(), email: emailEl.value.trim(),
              role: roleEl.value, password: passEl.value
            };
            if (!payload.username || !payload.name || !payload.password) {
              UI.toast('Rellena usuario, nombre y contraseña.', 'err');
              return false;
            }
            fetch('/api/admin/users', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
              body: JSON.stringify(payload)
            }).then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
              .then(function (r) {
                if (!r.ok) { UI.toast((r.data && r.data.error) || 'No se ha podido crear.', 'err'); return; }
                UI.toast('Usuario creado.');
                load();
              }).catch(function () { UI.toast('No se ha podido conectar con el servidor.', 'err'); });
          }
        }
      ]
    });
  }

  function deleteUser(u) {
    UI.confirm({
      title: 'Eliminar ' + u.name,
      text: 'Se borrará el usuario y todo su historial de sesiones. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar usuario'
    }).then(function (ok) {
      if (!ok) return;
      fetch('/api/admin/users/' + u.id, { method: 'DELETE', credentials: 'include' })
        .then(function (res) { if (!res.ok) throw new Error(); UI.toast('Usuario eliminado.'); load(); })
        .catch(function () { UI.toast('No se ha podido eliminar.', 'err'); });
    });
  }

  function resetPassword(u) {
    UI.confirm({
      title: 'Restablecer contraseña de ' + u.name,
      text: 'Se generará una contraseña nueva al azar y dejará de valer la anterior. Tendrás que pasársela tú a quien use esta cuenta.',
      confirmLabel: 'Restablecer', danger: false, icon: 'refresh'
    }).then(function (ok) {
      if (!ok) return;
      fetch('/api/admin/users/' + u.id + '/reset-password', { method: 'POST', credentials: 'include' })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
        .then(function (r) {
          if (!r.ok) { UI.toast((r.data && r.data.error) || 'No se ha podido restablecer.', 'err'); return; }
          showNewPassword(r.data);
        }).catch(function () { UI.toast('No se ha podido conectar con el servidor.', 'err'); });
    });
  }

  function showNewPassword(data) {
    var input = el('input', { class: 'input', value: data.password, readonly: true, onclick: function () { input.select(); } });
    var body = el('div', {}, [
      UI.field('Contraseña nueva', input, 'Cópiala ahora: no se volverá a mostrar. Pásasela a ' + data.name + ' por un canal seguro.')
    ]);
    UI.modal({
      title: 'Contraseña restablecida', subtitle: '@' + data.username, icon: 'refresh',
      body: body,
      buttons: [{
        label: 'Copiar contraseña', icon: 'copy', kind: 'primary',
        onClick: function () {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(data.password).catch(function () {});
          UI.toast('Contraseña copiada.');
          return false;
        }
      }]
    });
  }

  load();
})();
