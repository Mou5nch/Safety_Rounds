// ==========================================================================
// Prueba de integración de la sincronización y del correo (/api/sync, /api/email)
// --------------------------------------------------------------------------
// Necesita un servidor arrancado contra una base de datos DE PRUEBA (no la de
// producción: crea y borra documentos). Ejemplo en local:
//
//   DATABASE_URL=postgres://localhost/safety_test PORT=3100 \
//   ADMIN_PASSWORD=admin-local SEED_USERS_PASSWORD=Rondas2026! node server/index.js
//   BASE_URL=http://localhost:3100 ADMIN_PASSWORD=admin-local \
//   SEED_USERS_PASSWORD=Rondas2026! npm run test:api
//
// Comprueba: subida y bajada entre dos dispositivos, fusión por claves, bajas,
// permisos por rol, cuentas de demostración, reloj adelantado y correo.
// ==========================================================================
// Prueba de integración de /api/sync y /api/email contra el servidor local.
const BASE = process.env.BASE_URL || 'http://localhost:3100';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'mou5nch@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const USERS_PASSWORD = process.env.SEED_USERS_PASSWORD || 'Rondas2026!';
if (!ADMIN_PASSWORD) { console.error('Define ADMIN_PASSWORD (la contraseña del administrador del servidor de pruebas).'); process.exit(2); }
let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ✓', name);
  else { fails++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}
async function login(username, password, client) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, client }) });
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  return { status: r.status, cookie, body: await r.json() };
}
async function api(sess, method, path, body) {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Cookie: sess.cookie }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const now = (ms = 0) => new Date(Date.now() + ms).toISOString();

const insp = await login('carlos.ruiz', USERS_PASSWORD, 'campo');
const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
console.log('Login'); check('inspector entra', insp.status === 200 && insp.cookie, insp.body); check('admin entra', admin.status === 200);

const id = 'dev_test_' + Date.now();
const A = 'device-A', B = 'device-B';

console.log('Subida y descarga básica');
let r = await api(insp, 'POST', '/api/sync/push', { device: A, changes: [{ store: 'deviations', id, data: { id, status: 'open', severity: 'alta', description: 'Suelo mojado', updatedAt: now() }, updatedAt: now() }] });
check('push crea el documento', r.body.results && r.body.results[0].result === 'applied', r.body);
r = await api(admin, 'GET', '/api/sync/pull?since=0&device=' + B);
const got = (r.body.docs || []).find(d => d.id === id);
check('el otro dispositivo lo descarga', !!got && got.data.description === 'Suelo mojado', r.body);
const seq1 = r.body.last;
r = await api(insp, 'GET', '/api/sync/pull?since=0&device=' + A);
check('el dispositivo que subió NO recibe su propio eco', !(r.body.docs || []).some(d => d.id === id), r.body.docs && r.body.docs.length);

console.log('Fusión por claves (conflicto sin pisarse)');
// A cambia severity; B (con la misma base) cambia status. Ambos parten del documento original.
r = await api(insp, 'POST', '/api/sync/push', { device: A, changes: [{ store: 'deviations', id, data: { id, status: 'open', severity: 'critica', description: 'Suelo mojado', updatedAt: now(10) }, changedKeys: ['severity', 'updatedAt'], updatedAt: now(10) }] });
check('A aplica severity', r.body.results[0].result === 'applied', r.body);
r = await api(admin, 'POST', '/api/sync/push', { device: B, changes: [{ store: 'deviations', id, data: { id, status: 'closed', severity: 'alta', description: 'Suelo mojado', updatedAt: now(20) }, changedKeys: ['status', 'updatedAt'], updatedAt: now(20) }] });
check('B aplica status', r.body.results[0].result === 'applied', r.body);
r = await api(admin, 'GET', '/api/sync/pull?since=' + seq1 + '&device=' + B);
const echo = (r.body.docs || []).find(d => d.id === id);
check('B recibe el documento fusionado (echo)', !!echo && echo.data.severity === 'critica' && echo.data.status === 'closed', echo && echo.data);
r = await api(insp, 'GET', '/api/sync/pull?since=0&device=' + A);
const fa = (r.body.docs || []).find(d => d.id === id);
check('A recibe status=closed de B y conserva severity=critica', !!fa && fa.data.status === 'closed' && fa.data.severity === 'critica', fa && fa.data);

console.log('Bajas (lápidas)');
r = await api(insp, 'POST', '/api/sync/push', { device: A, changes: [{ store: 'deviations', id, deleted: true, updatedAt: now(30) }] });
check('A borra', r.body.results[0].result === 'applied', r.body);
r = await api(admin, 'GET', '/api/sync/pull?since=0&device=' + B);
const tomb = (r.body.docs || []).find(d => d.id === id);
check('B recibe la lápida', !!tomb && tomb.deleted === true && tomb.data === null, tomb);
r = await api(admin, 'POST', '/api/sync/push', { device: B, changes: [{ store: 'deviations', id, data: { id, status: 'open', updatedAt: now(-60000) }, changedKeys: ['status'], updatedAt: now(-60000) }] });
check('una edición ANTERIOR a la baja no resucita el documento', r.body.results[0].result === 'ignored', r.body);
r = await api(admin, 'POST', '/api/sync/push', { device: B, changes: [{ store: 'deviations', id, data: { id, status: 'open', updatedAt: now(5000) }, updatedAt: now(5000) }] });
check('una edición POSTERIOR a la baja sí la restaura', r.body.results[0].result === 'applied', r.body);

console.log('Permisos por rol');
r = await api(insp, 'POST', '/api/sync/push', { device: A, changes: [{ store: 'forms', id: 'f1', data: { id: 'f1', name: 'x', updatedAt: now() }, updatedAt: now() }] });
check('el inspector no puede escribir cuestionarios', r.body.results[0].result === 'forbidden', r.body);
r = await api(admin, 'POST', '/api/sync/push', { device: B, changes: [{ store: 'forms', id: 'f1', data: { id: 'f1', name: 'Ronda', updatedAt: now() }, updatedAt: now() }] });
check('el administrador sí', r.body.results[0].result === 'applied', r.body);
r = await api(insp, 'POST', '/api/sync/push', { device: A, changes: [{ store: 'nope', id: 'x', data: {} }] });
check('almacén desconocido rechazado', r.body.results[0].result === 'invalid', r.body);
const reg = await fetch(BASE + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Demo', email: 'demo' + Date.now() + '@x.com', password: 'Demo12345' }) });
const demoCookie = (reg.headers.get('set-cookie') || '').split(';')[0];
r = await api({ cookie: demoCookie }, 'GET', '/api/sync/pull?since=0&device=Z');
check('cuenta de demostración no sincroniza (403)', r.status === 403 && r.body.code === 'demo', r);
r = await fetch(BASE + '/api/sync/pull?since=0&device=Z'); check('sin sesión: 401', r.status === 401);

console.log('Documento nuevo para el dispositivo (sin base) → gana el más reciente');
const id2 = 'vis_' + Date.now();
await api(insp, 'POST', '/api/sync/push', { device: A, changes: [{ store: 'visits', id: id2, data: { id: id2, v: 'nuevo', updatedAt: now(1000) }, updatedAt: now(1000) }] });
r = await api(admin, 'POST', '/api/sync/push', { device: B, changes: [{ store: 'visits', id: id2, data: { id: id2, v: 'viejo', updatedAt: now(-5000) }, updatedAt: now(-5000) }] });
check('el cambio más antiguo sin base se ignora', r.body.results[0].result === 'ignored', r.body);

console.log('Reloj adelantado');
const id3 = 'vis_clock_' + Date.now();
await api(insp, 'POST', '/api/sync/push', { device: A, changes: [{ store: 'visits', id: id3, data: { id: id3, v: 1, updatedAt: now(10 * 3600 * 1000) }, updatedAt: now(10 * 3600 * 1000) }] });
r = await api(admin, 'POST', '/api/sync/push', { device: B, changes: [{ store: 'visits', id: id3, data: { id: id3, v: 2, updatedAt: now(60000) }, updatedAt: now(60000) }] });
check('un reloj 10 h adelantado queda recortado a +5 min: un cambio de hace 1 min aún pierde', r.body.results[0].result === 'ignored', r.body);
r = await api(admin, 'POST', '/api/sync/push', { device: B, changes: [{ store: 'visits', id: id3, data: { id: id3, v: 3, updatedAt: now(6 * 60000) }, updatedAt: now(6 * 60000) }] });
check('...pero un cambio real posterior a esos 5 min sí gana (no se bloquea para siempre)', r.body.results[0].result === 'applied', r.body);

console.log('Correo');
r = await api(insp, 'GET', '/api/email/status'); check('estado del correo accesible', r.status === 200 && 'configured' in r.body, r.body);
r = await api(insp, 'POST', '/api/email/report', { to: ['a@b.com'], pdfBase64: Buffer.from('%PDF-1.4 test').toString('base64'), subject: 's' });
check('con proveedor ausente → 503 not_configured; con proveedor, el envío responde ok/502', (r.status === 503 && r.body.code === 'not_configured') || r.status === 200 || r.status === 502, r);
r = await api(insp, 'POST', '/api/email/report', { to: ['no-es-correo'], pdfBase64: 'x' });
check('destinatario no válido → 503 antes (sin proveedor) o 400', r.status === 503 || r.status === 400, r);

console.log('Sesión de campo');
r = await api(insp, 'POST', '/api/auth/heartbeat'); check('heartbeat de sesión de campo ok', r.status === 200, r);

console.log(fails ? `\n${fails} FALLO(S)` : '\nTodo correcto');
process.exit(fails ? 1 : 0);
