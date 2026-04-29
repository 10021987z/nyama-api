// NYAMA — Test sync menu Pro → Client
// Vérifie que :
//  1) /ai/menu/suggest renvoie une suggestion exploitable
//  2) Quand Catherine crée un plat, Fabrice reçoit menu:updated en temps réel
//  3) Le plat apparaît dans GET /cooks/cp-catherine/menu-items côté Fabrice
//  4) Quand Catherine désactive le plat, il est masqué côté Client (par défaut)
//  5) Cleanup : suppression du plat de test
//
//   node test-menu-sync.mjs

import { io } from 'socket.io-client';
import { writeFileSync } from 'node:fs';

const API = process.env.NYAMA_API_URL || 'https://nyama-api-production.up.railway.app/api/v1';
const WS = process.env.NYAMA_WS_URL || 'https://nyama-api-production.up.railway.app';

const PHONES = { fabrice: '+237691000001', catherine: '+237690000001' };
const COOK_PROFILE_ID = 'cp-catherine';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STEPS = [];
const step = (label, ok, detail = '') => {
  STEPS.push({ label, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
};

async function api(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}`);
    err.status = res.status; err.body = data;
    throw err;
  }
  return data;
}

async function login(phone) {
  return api(null, 'POST', '/auth/otp/verify', { phone, code: '123456' });
}

function makeSocket(token, label, events) {
  const s = io(WS, { transports: ['websocket'], auth: { token }, reconnection: false, timeout: 8000 });
  s.onAny((event, data) => events.push({ time: Date.now(), role: label, event, data }));
  s.on('connect_error', (err) => console.error(`[${label}] connect_error:`, err.message));
  return s;
}

function waitForConnect(s, label, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (s.connected) return resolve();
    const t = setTimeout(() => reject(new Error(`${label} socket connect timeout`)), timeoutMs);
    s.once('connect', () => { clearTimeout(t); resolve(); });
  });
}

async function run() {
  const events = [];
  const t0 = Date.now();
  let createdDishId = null;

  // 1) Login
  const [fabrice, catherine] = await Promise.all([login(PHONES.fabrice), login(PHONES.catherine)]);
  step('Login Fabrice + Catherine', !!(fabrice.accessToken && catherine.accessToken));

  // 2) Sockets
  const sFabrice = makeSocket(fabrice.accessToken, 'CLIENT', events);
  const sCatherine = makeSocket(catherine.accessToken, 'COOK', events);
  await Promise.all([waitForConnect(sFabrice, 'fabrice'), waitForConnect(sCatherine, 'catherine')]);
  step('Sockets connectés', true);

  // 3) Catherine appelle l'IA pour suggérer un plat
  let suggestion;
  try {
    suggestion = await api(catherine.accessToken, 'POST', '/ai/menu/suggest', {
      dishKeywords: 'okok poisson sauce arachide',
      category: 'plat',
    });
    const ok = suggestion?.name && typeof suggestion?.suggestedPriceXaf === 'number';
    step('IA /ai/menu/suggest OK', ok,
      ok ? `name="${suggestion.name}" price=${suggestion.suggestedPriceXaf}fcfa allergens=[${suggestion.allergens.join(',')}] match=${suggestion.matchedDish}` : `res=${JSON.stringify(suggestion).slice(0,150)}`);
  } catch (e) {
    step('IA /ai/menu/suggest OK', false, `${e.message} | ${JSON.stringify(e.body)}`);
    throw e;
  }

  // 4) Catherine crée le plat (avec tag de test pour éviter collisions)
  const testName = `${suggestion.name} — TEST E2E ${Date.now()}`;
  let newDish;
  try {
    newDish = await api(catherine.accessToken, 'POST', '/cook/menu-items', {
      name: testName,
      description: suggestion.description,
      priceXaf: suggestion.suggestedPriceXaf,
      category: suggestion.category,
      prepTimeMin: suggestion.preparationTimeMin,
    });
    createdDishId = newDish?.id;
    step('Catherine POST /cook/menu-items', !!createdDishId,
      createdDishId ? `id=${createdDishId} isAvailable=${newDish.isAvailable}` : `res=${JSON.stringify(newDish).slice(0,150)}`);
  } catch (e) {
    step('Catherine POST /cook/menu-items', false, `${e.message} | ${JSON.stringify(e.body)}`);
    throw e;
  }

  // 5) Vérifier que Fabrice a reçu menu:updated avec action=created
  await sleep(2000);
  const createdEvent = events.find((e) =>
    e.role === 'CLIENT' && e.event === 'menu:updated' &&
    e.data?.action === 'created' &&
    (e.data?.menuItem?.id === createdDishId),
  );
  step('Fabrice reçoit menu:updated (created) en broadcast', !!createdEvent,
    createdEvent ? `cookId=${createdEvent.data.cookId} action=${createdEvent.data.action}` :
    `events CLIENT menu:updated reçus: ${events.filter(e=>e.role==='CLIENT'&&e.event==='menu:updated').length}`);

  // 6) Fabrice GET le menu de Catherine, le plat doit y apparaître
  try {
    const menu = await api(fabrice.accessToken, 'GET', `/cooks/${COOK_PROFILE_ID}/menu-items`);
    const list = Array.isArray(menu) ? menu : (menu.data || menu.items || []);
    const found = list.find((m) => m.id === createdDishId);
    step('Plat visible dans GET /cooks/.../menu-items côté Client', !!found,
      found ? `name="${found.name}"` : `${list.length} plats reçus, mais pas le test`);
  } catch (e) {
    step('Plat visible côté Client', false, `${e.message} | ${JSON.stringify(e.body)}`);
  }

  // 7) Catherine bascule isAvailable=false
  try {
    await api(catherine.accessToken, 'PATCH', `/cook/menu-items/${createdDishId}/availability`, {
      isAvailable: false,
    });
    step('Catherine PATCH menu-items/:id/availability { isAvailable: false }', true);
  } catch (e) {
    // fallback : essayer via update
    try {
      await api(catherine.accessToken, 'PATCH', `/cook/menu-items/${createdDishId}`, { isAvailable: false });
      step('Catherine PATCH menu-items/:id { isAvailable: false } (fallback)', true);
    } catch (e2) {
      step('Catherine PATCH availability', false, `${e.message} → ${e2.message} | ${JSON.stringify(e2.body)}`);
    }
  }
  await sleep(1500);

  // 8) Fabrice re-GET menu — par défaut isAvailable=true filter, le plat doit disparaître
  try {
    const menuAfter = await api(fabrice.accessToken, 'GET', `/cooks/${COOK_PROFILE_ID}/menu-items`);
    const list = Array.isArray(menuAfter) ? menuAfter : (menuAfter.data || menuAfter.items || []);
    const stillVisible = list.find((m) => m.id === createdDishId);
    step('Plat masqué après désactivation (filter défaut)', !stillVisible,
      stillVisible ? `encore visible isAvailable=${stillVisible.isAvailable}` : `correctement filtré`);
  } catch (e) {
    step('Re-GET menu Client', false, `${e.message} | ${JSON.stringify(e.body)}`);
  }

  // 8bis) Avec ?includeUnavailable=true, le plat doit réapparaître
  try {
    const menuAll = await api(fabrice.accessToken, 'GET', `/cooks/${COOK_PROFILE_ID}/menu-items?includeUnavailable=true`);
    const list = Array.isArray(menuAll) ? menuAll : (menuAll.data || menuAll.items || []);
    const found = list.find((m) => m.id === createdDishId);
    step('?includeUnavailable=true renvoie le plat désactivé', !!found,
      found ? `isAvailable=${found.isAvailable}` : '');
  } catch (e) {
    step('?includeUnavailable=true', false, `${e.message}`);
  }

  // 9) Cleanup — soft delete
  try {
    await api(catherine.accessToken, 'DELETE', `/cook/menu-items/${createdDishId}`);
    step('Cleanup DELETE plat de test', true);
  } catch (e) {
    step('Cleanup DELETE plat de test', false, `${e.message}`);
  }

  // 10) Vérif event delete reçu
  await sleep(1500);
  const deletedEvent = events.find((e) =>
    e.role === 'CLIENT' && e.event === 'menu:updated' &&
    (e.data?.action === 'deleted' || e.data?.action === 'updated') &&
    (e.data?.menuItem?.id === createdDishId),
  );
  step('Fabrice reçoit menu:updated (deleted/updated) après cleanup', !!deletedEvent,
    deletedEvent ? `action=${deletedEvent.data.action}` : '');

  sFabrice.disconnect(); sCatherine.disconnect();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const passed = STEPS.filter((s) => s.ok).length;
  const failed = STEPS.filter((s) => !s.ok).length;

  // Mini-timeline (events menu:updated uniquement)
  const menuEvents = events.filter((e) => e.event === 'menu:updated');
  console.log(`\n📜 ${menuEvents.length} events menu:updated capturés:`);
  menuEvents.forEach((e) => {
    const t = new Date(e.time).toISOString().slice(11, 19);
    console.log(`  [${t}] ${e.role.padEnd(6)} action=${e.data?.action} cookId=${e.data?.cookId} dishId=${e.data?.menuItem?.id}`);
  });

  console.log(`\n📊 BILAN MENU SYNC — ${passed} ✅ / ${failed} ❌  en ${elapsed}s`);

  // Rapport markdown
  const md = [
    '# Rapport menu sync — Pro → Client',
    '',
    `Date : ${new Date().toISOString()}`,
    `Durée : ${elapsed}s`,
    `Endpoint : ${API}`,
    '',
    `## Bilan : ${passed} ✅ / ${failed} ❌`,
    '',
    '## Étapes',
    '',
    ...STEPS.map((s) => `- ${s.ok ? '✅' : '❌'} **${s.label}**${s.detail ? ` — ${s.detail}` : ''}`),
    '',
    `## Events menu:updated (${menuEvents.length})`,
    '',
    '```',
    ...menuEvents.map((e) => {
      const t = new Date(e.time).toISOString().slice(11, 19);
      return `[${t}] ${e.role} action=${e.data?.action} cookId=${e.data?.cookId} dishId=${e.data?.menuItem?.id}`;
    }),
    '```',
    '',
    failed === 0 ? '**🟢 SYNC PRO→CLIENT 100% VALIDÉE**' : `**🔴 ${failed} échec(s)**`,
  ].join('\n');
  writeFileSync('menu-sync-report.md', md);
  console.log('📝 menu-sync-report.md écrit');

  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('💥 Aborted:', e.message);
  process.exit(2);
});
