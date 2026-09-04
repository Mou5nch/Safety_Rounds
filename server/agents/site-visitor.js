/* ==========================================================================
   Agente de visitas periódicas
   Cada cierto tiempo (por defecto 40 minutos) visita una lista de webs y
   hace un pequeño recorrido por ellas: abre la portada, recoge unos cuantos
   enlaces internos y entra en varios de ellos con una pausa entre cada paso,
   como haría alguien navegando. No depende de ningún paquete externo (usa
   el `fetch` que trae Node) para poder ejecutarse suelto, sin instalar nada
   más que lo que ya pide este proyecto.

   Uso:
     node server/agents/site-visitor.js
     npm run visit-agent

   Variables de entorno opcionales:
     VISIT_INTERVAL_MINUTES   minutos entre cada ronda (por defecto 40)
     VISIT_TOUR_SIZE          nº de enlaces internos a visitar además de la portada (por defecto 3)
     VISIT_RUN_ONCE           "true" para hacer una sola ronda y salir (útil para probarlo)
   ========================================================================== */
'use strict';

const SITES = [
  { name: 'DYN HUB', url: 'https://www.dynhub.es' },
  { name: 'INCLUDDYN', url: 'https://www.includdyn.es' },
];

const INTERVAL_MINUTES = Number(process.env.VISIT_INTERVAL_MINUTES) || 40;
const TOUR_SIZE = Number(process.env.VISIT_TOUR_SIZE) || 3;
const RUN_ONCE = process.env.VISIT_RUN_ONCE === 'true';

const USER_AGENT = 'Mozilla/5.0 (compatible; SafetyRoundsSiteVisitor/1.0)';
const REQUEST_TIMEOUT_MS = 15000;
const STEP_DELAY_RANGE_MS = [2000, 6000]; // pausa entre "pasos" del recorrido

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function randomStepDelay() {
  const [min, max] = STEP_DELAY_RANGE_MS;
  return sleep(min + Math.random() * (max - min));
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,*/*' },
    });
    const body = await res.text();
    return { status: res.status, ms: Date.now() - startedAt, body: body, finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

// Enlaces internos (mismo origen) de un HTML, sin depender de ningún parser externo.
function extractInternalLinks(html, baseUrl) {
  const origin = new URL(baseUrl).origin;
  const hrefRe = /<a\s[^>]*href=["']([^"']+)["']/gi;
  const seen = new Set();
  const links = [];
  let match;
  while ((match = hrefRe.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw || raw.charAt(0) === '#') continue;
    if (/^(mailto|tel|javascript):/i.test(raw)) continue;
    let abs;
    try {
      abs = new URL(raw, baseUrl).toString();
    } catch (e) {
      continue;
    }
    if (abs.indexOf(origin) !== 0) continue; // solo el mismo dominio
    if (/\.(pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?|css|js)(\?|$)/i.test(abs)) continue;
    if (seen.has(abs)) continue;
    seen.add(abs);
    links.push(abs);
  }
  return links;
}

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

async function visitSite(site) {
  console.log('[site-visitor] → ' + site.name + ' (' + site.url + ')');
  const steps = [];

  let home;
  try {
    home = await fetchWithTimeout(site.url);
  } catch (e) {
    const reason = e.name === 'AbortError' ? 'tiempo agotado' : e.message;
    console.error('[site-visitor]   ✗ portada: ' + reason);
    return { site: site.name, ok: false, steps: [{ url: site.url, error: reason }] };
  }
  steps.push({ url: site.url, status: home.status, ms: home.ms });
  console.log('[site-visitor]   ✓ portada — ' + home.status + ' (' + home.ms + ' ms)');

  const candidates = shuffle(extractInternalLinks(home.body, home.finalUrl)).slice(0, TOUR_SIZE);
  for (const link of candidates) {
    await randomStepDelay();
    try {
      const step = await fetchWithTimeout(link);
      steps.push({ url: link, status: step.status, ms: step.ms });
      console.log('[site-visitor]   ✓ ' + link + ' — ' + step.status + ' (' + step.ms + ' ms)');
    } catch (e) {
      const reason = e.name === 'AbortError' ? 'tiempo agotado' : e.message;
      steps.push({ url: link, error: reason });
      console.error('[site-visitor]   ✗ ' + link + ': ' + reason);
    }
  }

  const ok = steps.every(function (s) { return !s.error && s.status < 400; });
  return { site: site.name, ok: ok, steps: steps };
}

async function runRound() {
  const startedAt = new Date();
  console.log('[site-visitor] ronda iniciada — ' + startedAt.toISOString());
  const results = [];
  for (const site of SITES) {
    results.push(await visitSite(site));
    await randomStepDelay(); // pequeña pausa antes de pasar a la siguiente web
  }
  const failed = results.filter(function (r) { return !r.ok; });
  if (failed.length) {
    console.warn('[site-visitor] ronda terminada con incidencias en: ' + failed.map(function (r) { return r.site; }).join(', '));
  } else {
    console.log('[site-visitor] ronda terminada sin incidencias.');
  }
  return results;
}

async function main() {
  await runRound();
  if (RUN_ONCE) return;
  console.log('[site-visitor] agente en marcha — próxima ronda en ' + INTERVAL_MINUTES + ' minutos.');
  setInterval(function () {
    runRound().catch(function (e) { console.error('[site-visitor] error inesperado en la ronda: ' + e.message); });
  }, INTERVAL_MINUTES * 60 * 1000);
}

if (require.main === module) {
  main();
}

module.exports = { runRound, extractInternalLinks, SITES };
