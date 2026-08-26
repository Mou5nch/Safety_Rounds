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
          el('td', {}, [el('div', { text: u.name }), el('div', { class: 'hint', style: { margin: 0 }, text: '@' + u.username })]),
          el('td', {}, el('span', { class: 'tag tag--navy', text: roleLabel(u.role) })),
          el('td', {}, el('span', {
            class: 'tag ' + (activeByUser[u.username] ? 'tag--ok' : ''), text: activeByUser[u.username] ? 'Conectado' : 'Sin conexión'
          })),
          el('td', { text: String(u.session_count) }),
          el('td', { text: fmtWhen(u.last_seen_at) }),
          el('td', { text: fmtDuration(u.total_seconds) }),
          el('td', {}, el('button', {
            class: 'btn btn--quiet btn--sm btn--icon', title: 'Eliminar usuario', html: ico('trash', 15),
            onclick: function () { deleteUser(u); }
          }))
        ]));
      });
      table.appendChild(tbody);
      body.appendChild(el('div', { style: { overflowX: 'auto' } }, table));
    }
    card.appendChild(body);
    return card;
  }

  function roleLabel(role) {
    return role === 'admin' ? 'Administración' : role === 'supervisor' ? 'Supervisor' : 'Inspector';
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
    var passEl = el('input', { class: 'input', type: 'text', placeholder: 'Contraseña' });
    var roleEl = el('select', { class: 'select' }, [
      el('option', { value: 'inspector', text: 'Inspector' }),
      el('option', { value: 'supervisor', text: 'Supervisor' }),
      el('option', { value: 'admin', text: 'Administración' })
    ]);

    var body = el('div', {}, [
      UI.field('Usuario', userEl),
      UI.field('Nombre', nameEl),
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
              username: userEl.value.trim(), name: nameEl.value.trim(),
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

  load();
})();
