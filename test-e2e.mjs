// NYAMA — Test E2E parcours complet (Client → Cook → Rider → Rating)
// Lance contre Railway prod (par défaut) ou local (NYAMA_API_URL)
//
//   node test-e2e.mjs
//
// Génère un rapport e2e-report.md à la racine.

import { io } from 'socket.io-client';
import { writeFileSync } from 'node:fs';

const API = process.env.NYAMA_API_URL || 'https://nyama-api-production.up.railway.app/api/v1';
const WS = process.env.NYAMA_WS_URL || 'https://nyama-api-production.up.railway.app';

const PHONES = {
  admin: '+237699000000',
  fabrice: '+237691000001',
  catherine: '+237690000001',
  kevin: '+237692000001',
};

// CookProfile.id (pour /cooks/:id et POST /orders.cookId)
// userId (u-catherine) sert pour les rooms socket et /admin/live/map
const COOK_PROFILE_ID = 'cp-catherine';
const COOK_USER_ID = 'u-catherine';

// ─── Helpers ─────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STEPS = [];
const step = (label, ok, detail = '') => {
  STEPS.push({ label, ok, detail, time: new Date().toISOString() });
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
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

async function login(phone) {
  const r = await api(null, 'POST', '/auth/otp/verify', { phone, code: '123456' });
  return r;
}

function makeSocket(token, label, events) {
  const s = io(WS, {
    transports: ['websocket'],
    auth: { token },
    reconnection: false,
    timeout: 8000,
  });
  s.onAny((event, data) => {
    events.push({ time: Date.now(), role: label, event, data });
  });
  s.on('connect_error', (err) => console.error(`[${label}] connect_error:`, err.message));
  return s;
}

function waitForConnect(s, label, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (s.connected) return resolve();
    const t = setTimeout(() => reject(new Error(`${label} socket connect timeout`)), timeoutMs);
    s.once('connect', () => {
      clearTimeout(t);
      resolve();
    });
  });
}

// ─── Scénario ────────────────────────────────────────
async function runE2E() {
  const events = [];
  const t0 = Date.now();

  // 1) Login 4 personas
  let admin, fabrice, catherine, kevin;
  try {
    [admin, fabrice, catherine, kevin] = await Promise.all([
      login(PHONES.admin),
      login(PHONES.fabrice),
      login(PHONES.catherine),
      login(PHONES.kevin),
    ]);
    step('Login 4 personas (admin/client/cook/rider)', true,
      `roles: ${admin.user.role}/${fabrice.user.role}/${catherine.user.role}/${kevin.user.role}`);
  } catch (e) {
    step('Login 4 personas', false, `${e.message} | body=${JSON.stringify(e.body)}`);
    throw e;
  }

  // Vérifier rôles
  const expectedRoles = { admin: 'ADMIN', fabrice: 'CLIENT', catherine: 'COOK', kevin: 'RIDER' };
  const actualRoles = { admin: admin.user.role, fabrice: fabrice.user.role,
                        catherine: catherine.user.role, kevin: kevin.user.role };
  const rolesOk = JSON.stringify(expectedRoles) === JSON.stringify(actualRoles);
  step('Rôles personas conformes au seed', rolesOk,
    rolesOk ? '' : `attendu=${JSON.stringify(expectedRoles)} obtenu=${JSON.stringify(actualRoles)}`);

  // 2) Connecter sockets
  const sAdmin = makeSocket(admin.accessToken, 'ADMIN', events);
  const sFabrice = makeSocket(fabrice.accessToken, 'CLIENT', events);
  const sCatherine = makeSocket(catherine.accessToken, 'COOK', events);
  const sKevin = makeSocket(kevin.accessToken, 'RIDER', events);

  try {
    await Promise.all([
      waitForConnect(sAdmin, 'admin'),
      waitForConnect(sFabrice, 'fabrice'),
      waitForConnect(sCatherine, 'catherine'),
      waitForConnect(sKevin, 'kevin'),
    ]);
    step('4 sockets connectés', true, `ids=${[sAdmin.id, sFabrice.id, sCatherine.id, sKevin.id].join(',')}`);
  } catch (e) {
    step('4 sockets connectés', false, e.message);
    throw e;
  }

  // 3) Récupérer un menuItem disponible de Catherine
  let ndole;
  try {
    const menu = await api(fabrice.accessToken, 'GET', `/cooks/${COOK_PROFILE_ID}/menu-items`);
    const list = Array.isArray(menu) ? menu : (menu.data || menu.items || []);
    ndole = list.find((m) => /ndol/i.test(m.name) && (m.available !== false))
         || list.find((m) => m.available !== false)
         || list[0];
    step('Menu Catherine récupéré', !!ndole,
      ndole ? `${list.length} plats, choix: "${ndole.name}" (${ndole.priceXaf}fcfa)` : 'menu vide');
    if (!ndole) throw new Error('Aucun plat disponible chez Catherine');
  } catch (e) {
    step('Menu Catherine récupéré', false, `${e.message} | body=${JSON.stringify(e.body)}`);
    throw e;
  }

  // 4) Fabrice passe commande CASH
  let order;
  try {
    order = await api(fabrice.accessToken, 'POST', '/orders', {
      cookId: COOK_PROFILE_ID,
      items: [{ menuItemId: ndole.id, quantity: 1 }],
      deliveryAddress: 'Akwa I, Douala — Test E2E',
      deliveryLat: 4.0511,
      deliveryLng: 9.7679,
      paymentMethod: 'CASH',
    });
    step('Commande créée', true, `id=${order.id} status=${order.status} total=${order.totalXaf}fcfa`);
  } catch (e) {
    step('Commande créée', false, `${e.message} | body=${JSON.stringify(e.body)}`);
    throw e;
  }

  // 4bis) Subscribe les 3 protagonistes à la room order-X (pour delivery:status)
  sFabrice.emit('order:subscribe', { orderId: order.id });
  sCatherine.emit('order:subscribe', { orderId: order.id });
  sKevin.emit('order:subscribe', { orderId: order.id });

  // 5) Vérifier que Catherine a reçu order:new
  await sleep(2500);
  const newOrderEvent = events.find((e) => e.role === 'COOK' && e.event === 'order:new'
    && (e.data?.id === order.id || e.data?.orderId === order.id || e.data?.order?.id === order.id));
  step('Catherine reçoit order:new via socket', !!newOrderEvent,
    newOrderEvent ? `payload OK` : `events COOK reçus: ${events.filter(e => e.role==='COOK').map(e => e.event).join(', ') || '∅'}`);

  // 6) Catherine accepte
  try {
    await api(catherine.accessToken, 'PATCH', `/cook/orders/${order.id}/accept`);
    step('Catherine PATCH /cook/orders/:id/accept', true);
  } catch (e) {
    step('Catherine PATCH /cook/orders/:id/accept', false, `${e.message} | ${JSON.stringify(e.body)}`);
    throw e;
  }
  await sleep(800);

  // 6bis) Catherine passe en PREPARING (transition obligatoire avant READY)
  try {
    await api(catherine.accessToken, 'PATCH', `/cook/orders/${order.id}/preparing`);
    step('Catherine PATCH /cook/orders/:id/preparing', true);
  } catch (e) {
    step('Catherine PATCH /cook/orders/:id/preparing', false, `${e.message} | ${JSON.stringify(e.body)}`);
    throw e;
  }
  await sleep(800);

  // 7) Catherine marque prêt
  try {
    await api(catherine.accessToken, 'PATCH', `/cook/orders/${order.id}/ready`);
    step('Catherine PATCH /cook/orders/:id/ready', true);
  } catch (e) {
    step('Catherine PATCH /cook/orders/:id/ready', false, `${e.message} | ${JSON.stringify(e.body)}`);
    throw e;
  }
  await sleep(1200);

  // 8) Vérifier que Fabrice a reçu order:status READY (sur client-X room)
  const readyEvent = events.find((e) => e.role === 'CLIENT' && e.event === 'order:status'
    && /READY|PRÊT/i.test(String(e.data?.status ?? '')));
  step('Fabrice reçoit order:status READY', !!readyEvent,
    readyEvent ? `status=${readyEvent.data.status}` : `events CLIENT: ${events.filter(e=>e.role==='CLIENT').map(e=>`${e.event}/${e.data?.status||''}`).join(',') || '∅'}`);

  // 9) Kevin accepte la course (POST /rider/orders/:id/accept avec ORDER id)
  let delivery;
  try {
    const acceptRes = await api(kevin.accessToken, 'POST', `/rider/orders/${order.id}/accept`);
    step('Kevin POST /rider/orders/:id/accept', true,
      acceptRes?.delivery?.id ? `deliveryId=${acceptRes.delivery.id}` : `res=${JSON.stringify(acceptRes).slice(0,120)}`);
    // récupérer la delivery depuis liste deliveries
    const list = await api(kevin.accessToken, 'GET', '/deliveries?limit=20');
    const arr = list.data || list.items || list;
    delivery = (Array.isArray(arr) ? arr : []).find((d) => d.orderId === order.id)
      || acceptRes?.delivery
      || acceptRes;
    if (!delivery?.id) throw new Error(`delivery non retrouvé après accept (orderId=${order.id})`);
  } catch (e) {
    step('Kevin POST /rider/orders/:id/accept', false, `${e.message} | ${JSON.stringify(e.body)}`);
    throw e;
  }

  // 9bis) re-subscribe pour Kevin (au cas où)
  sKevin.emit('order:subscribe', { orderId: order.id });
  await sleep(1500);

  // 10) Vérifier que Kevin a reçu delivery:created (sur rider-X)
  const deliveryCreatedEvent = events.find((e) => e.role === 'RIDER' && e.event === 'delivery:created'
    && e.data?.orderId === order.id);
  step('Kevin reçoit delivery:created', !!deliveryCreatedEvent,
    deliveryCreatedEvent ? `deliveryId=${deliveryCreatedEvent.data.deliveryId}` : `events RIDER: ${events.filter(e=>e.role==='RIDER').map(e=>e.event).join(',') || '∅'}`);

  // 11) Kevin progresse étape par étape
  for (const status of ['ARRIVED_RESTAURANT', 'PICKED_UP', 'ARRIVED_CLIENT', 'DELIVERED']) {
    await sleep(1000);
    try {
      await api(kevin.accessToken, 'PATCH', `/rider/deliveries/${delivery.id}/status`, { status });
      step(`Kevin PATCH delivery → ${status}`, true);
    } catch (e) {
      step(`Kevin PATCH delivery → ${status}`, false, `${e.message} | ${JSON.stringify(e.body)}`);
      throw e;
    }
  }

  // 12) Vérifier que Fabrice a reçu order:status DELIVERED
  await sleep(2500);
  const deliveredEvent = events.find((e) =>
    e.role === 'CLIENT' && e.event === 'order:status' && /DELIVERED|LIVRÉ/i.test(String(e.data?.status ?? '')),
  );
  step('Fabrice reçoit order:status DELIVERED', !!deliveredEvent,
    deliveredEvent ? `status=${deliveredEvent.data.status}` : '');

  // 12bis) delivery:status sur order-X (Catherine et Fabrice subscribed)
  const cookSawDeliveryStatus = events.find((e) => e.role === 'COOK' && e.event === 'delivery:status');
  step('Catherine reçoit delivery:status (room order-X)', !!cookSawDeliveryStatus);

  // 13) Fabrice envoie son rating
  let rating;
  try {
    rating = await api(fabrice.accessToken, 'POST', `/orders/${order.id}/rating`, {
      riderStars: 5,
      restaurantStars: 5,
      appStars: 5,
      comment: 'Test E2E automatisé — parcours complet validé',
      tags: ['Rapide', 'Sympathique'],
    });
    const rId = rating?.rating?.id || rating?.id;
    step('Fabrice POST /orders/:id/rating', !!rId, rId ? `ratingId=${rId}` : `res=${JSON.stringify(rating).slice(0,120)}`);
  } catch (e) {
    step('Fabrice POST /orders/:id/rating', false, `${e.message} | ${JSON.stringify(e.body)}`);
  }

  // 14) Vérifier que la note moyenne de Catherine est mise à jour (via /admin/live/map)
  try {
    const mapData = await api(admin.accessToken, 'GET', '/admin/live/map');
    const cooks = mapData.cooks || mapData.data?.cooks || [];
    const card = cooks.find((c) => c.id === COOK_USER_ID || c.userId === COOK_USER_ID || c.id === COOK_PROFILE_ID);
    const avg = card?.avgRating ?? card?.rating ?? null;
    step('Note Catherine récupérée depuis /admin/live/map', !!card,
      card ? `avgRating=${avg}` : `cooks count=${cooks.length}`);
  } catch (e) {
    step('Note Catherine via /admin/live/map', false, `${e.message} | ${JSON.stringify(e.body)}`);
  }

  // 15) Vérifier /admin/live/overview
  try {
    const overview = await api(admin.accessToken, 'GET', '/admin/live/overview');
    const rev = overview.todayRevenue ?? overview.revenue ?? overview.kpis?.todayRevenue;
    const cnt = overview.todayOrdersCount ?? overview.todayOrders ?? overview.kpis?.todayOrdersCount;
    step('GET /admin/live/overview OK', true, `todayRevenue=${rev} todayOrdersCount=${cnt}`);
  } catch (e) {
    step('GET /admin/live/overview OK', false, `${e.message} | ${JSON.stringify(e.body)}`);
  }

  // 16) Cleanup sockets
  sAdmin.disconnect(); sFabrice.disconnect(); sCatherine.disconnect(); sKevin.disconnect();

  // ─── RAPPORT ────────────────────────────────────────
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const passed = STEPS.filter((s) => s.ok).length;
  const failed = STEPS.filter((s) => !s.ok).length;

  console.log(`\n📜 TIMELINE EVENTS SOCKET (${events.length} events):`);
  events.forEach((e) => {
    const t = new Date(e.time).toISOString().slice(11, 19);
    const dataStr = e.data ? ` ${JSON.stringify(e.data).slice(0, 90)}` : '';
    console.log(`  [${t}] ${e.role.padEnd(6)} ← ${e.event}${dataStr}`);
  });

  console.log(`\n📊 BILAN — ${passed} ✅ / ${failed} ❌  en ${elapsed}s`);

  // Génération e2e-report.md
  const md = [
    '# Rapport E2E NYAMA — parcours Client complet',
    '',
    `Date : ${new Date().toISOString()}`,
    `Durée : ${elapsed}s`,
    `Endpoint : ${API}`,
    `Order ID : ${order?.id ?? 'n/a'}`,
    '',
    `## Bilan : ${passed} ✅ / ${failed} ❌`,
    '',
    '## Étapes',
    '',
    ...STEPS.map((s) => `- ${s.ok ? '✅' : '❌'} **${s.label}**${s.detail ? ` — ${s.detail}` : ''}`),
    '',
    `## Timeline events socket (${events.length})`,
    '',
    '```',
    ...events.map((e) => {
      const t = new Date(e.time).toISOString().slice(11, 19);
      const dataStr = e.data ? ` ${JSON.stringify(e.data).slice(0, 110)}` : '';
      return `[${t}] ${e.role.padEnd(6)} ← ${e.event}${dataStr}`;
    }),
    '```',
    '',
    `## Verdict global`,
    '',
    failed === 0
      ? '**🟢 PARCOURS CLIENT 100% VALIDÉ** — toutes les étapes et events critiques sont passés.'
      : `**🔴 ${failed} échec(s)** — voir étapes ci-dessus.`,
  ].join('\n');

  writeFileSync('e2e-report.md', md);
  console.log('\n📝 Rapport écrit dans e2e-report.md');

  process.exit(failed === 0 ? 0 : 1);
}

runE2E().catch((e) => {
  console.error('💥 E2E aborted:', e.message);
  process.exit(2);
});
