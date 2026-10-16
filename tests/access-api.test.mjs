// ==========================================================================
// Prueba de integración del acceso a Safety Desk y Safety Go (/api/admin, /api/auth)
// --------------------------------------------------------------------------
// Necesita un servidor arrancado contra una base de datos DE PRUEBA (crea
// usuarios). Ejemplo en local:
//
//   DATABASE_URL=postgres://localhost/safety_test PORT=3100 \
//   ADMIN_PASSWORD=admin-local SEED_USERS_PASSWORD=Rondas2026! node server/index.js
//   BASE_URL=http://localhost:3100 ADMIN_PASSWORD=admin-local \
//   SEED_USERS_PASSWORD=Rondas2026! npm run test:access
//
// Comprueba: acceso por defecto (todos, también las cuentas de demostración), cambio desde el panel, reglas
// (la administración conserva Desk, nadie se queda sin acceso), alta de
// usuarios con acceso y sesión según la versión en uso.
// ==========================================================================
const BASE = process.env.BASE_URL || 'http://localhost:3100';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'mou5nch@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const USERS_PASSWORD = process.env.SEED_USERS_PASSWORD || 'Rondas2026!';
if (!ADMIN_PASSWORD) { console.error('Define ADMIN_PASSWORD (la contraseña del administrador del servidor de pruebas).'); process.exit(2); }
const RUN = Date.now().toString(36);
let fails = 0;
const check = (n, c, x) => { if (c) console.log('  ✓', n); else { fails++; console.log('  ✗', n, x !== undefined ? JSON.stringify(x) : ''); } };
async function login(u, p, client) { const r = await fetch(BASE + '/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username:u,password:p,client}) }); return { status:r.status, cookie:(r.headers.get('set-cookie')||'').split(';')[0], body: await r.json() }; }
async function api(s, m, path, body) { const r = await fetch(BASE + path, { method:m, headers:{'Content-Type':'application/json', Cookie:s.cookie}, body: body?JSON.stringify(body):undefined }); return { status:r.status, body: await r.json().catch(()=>({})) }; }

console.log('Acceso por defecto');
const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
check('admin: Desk y Go', admin.body.access && admin.body.access.desk && admin.body.access.go, admin.body);
const insp = await login('carlos.ruiz', USERS_PASSWORD);
check('inspector: Desk y Go por defecto', insp.body.access.desk && insp.body.access.go, insp.body);
const reg = await fetch(BASE + '/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:'Demo', email:'demo'+Date.now()+'@x.com', password:'Demo12345' }) });
const regBody = await reg.json();
check('cuenta de demostración: también Desk y Go (puede probar las dos)', regBody.access.desk === true && regBody.access.go === true, regBody);
let me = await api(insp, 'GET', '/api/auth/me');
check('/me incluye el acceso', me.body.access && me.body.access.desk && me.body.access.go, me.body);

console.log('Cambiar el acceso desde el panel');
let list = await api(admin, 'GET', '/api/admin/users');
const carlos = list.body.find(u => u.username === 'carlos.ruiz');
check('el listado trae el acceso de cada usuario', list.body.every(u => u.access && typeof u.access.desk === 'boolean'), list.body[0]);
let r = await api(admin, 'PATCH', '/api/admin/users/' + carlos.id + '/access', { desk: false, go: true });
check('dejar a un inspector solo con Go', r.status === 200 && r.body.access.desk === false && r.body.access.go === true, r);
me = await api(insp, 'GET', '/api/auth/me');
check('/me refleja el cambio al momento', me.body.access.desk === false && me.body.access.go === true, me.body);
const again = await login('carlos.ruiz', USERS_PASSWORD);
check('el login devuelve el acceso nuevo', again.body.access.desk === false && again.body.access.go === true, again.body);
r = await api(admin, 'PATCH', '/api/admin/users/' + carlos.id + '/access', { desk: false, go: false });
check('no se puede dejar a nadie sin ningún acceso (400)', r.status === 400, r);
const adm = list.body.find(u => u.role === 'admin');
r = await api(admin, 'PATCH', '/api/admin/users/' + adm.id + '/access', { desk: false, go: true });
check('la administración no pierde Desk (400)', r.status === 400, r);
r = await api(admin, 'PATCH', '/api/admin/users/' + adm.id + '/access', { desk: true, go: false });
check('...pero sí puede quedarse sin Go', r.status === 200 && r.body.access.desk === true && r.body.access.go === false, r);
await api(admin, 'PATCH', '/api/admin/users/' + adm.id + '/access', { desk: true, go: true });
r = await api(admin, 'PATCH', '/api/admin/users/' + carlos.id + '/access', { desk: 'si', go: true });
check('valores que no son booleanos (400)', r.status === 400, r);
r = await api(insp, 'PATCH', '/api/admin/users/' + carlos.id + '/access', { desk: true, go: true });
check('un inspector no puede cambiar accesos (403)', r.status === 403, r);
r = await api(admin, 'PATCH', '/api/admin/users/99999/access', { desk: true, go: true });
check('usuario inexistente (404)', r.status === 404, r);
await api(admin, 'PATCH', '/api/admin/users/' + carlos.id + '/access', { desk: true, go: true });

console.log('Alta de usuario con acceso');
r = await api(admin, 'POST', '/api/admin/users', { username: 'solo.campo.' + RUN, name: 'Solo Campo', role: 'inspector', password: 'Clave12345', access: { desk: false, go: true } });
check('crear un usuario solo con Go', r.status === 201 && r.body.access.desk === false && r.body.access.go === true, r);
r = await api(admin, 'POST', '/api/admin/users', { username: 'sin.nada.' + RUN, name: 'Sin Nada', role: 'inspector', password: 'Clave12345', access: { desk: false, go: false } });
check('crear un usuario sin ningún acceso (400)', r.status === 400, r);
r = await api(admin, 'POST', '/api/admin/users', { username: 'por.defecto.' + RUN, name: 'Por Defecto', role: 'usuario', password: 'Clave12345' });
check('sin indicar acceso: las dos versiones, también para una demo', r.status === 201 && r.body.access.desk && r.body.access.go, r);

console.log('Sesión según la versión en uso');
const s = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
let hb = await api(s, 'POST', '/api/auth/heartbeat', { client: 'campo' });
check('latido desde Go: ok', hb.status === 200, hb);
hb = await api(s, 'POST', '/api/auth/heartbeat', { client: 'desk' });
check('latido desde Desk: ok', hb.status === 200, hb);

console.log(fails ? `\n${fails} FALLO(S)` : '\nTodo correcto');
process.exit(fails ? 1 : 0);
