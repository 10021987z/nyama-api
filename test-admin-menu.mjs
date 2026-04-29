// NYAMA — Test des 4 endpoints admin menu
// Lance après deploy Railway pour valider :
//   GET    /admin/menu/all            (admin)
//   GET    /admin/menu/by-cook        (admin)
//   PATCH  /admin/menu-items/:id      (admin override)
//   DELETE /admin/menu-items/:id      (admin soft-delete)
// + vérifie que CLIENT (Fabrice) reçoit menu:updated avec adminAction.

import { io } from 'socket.io-client';
import { writeFileSync } from 'node:fs';

const API = 'https://nyama-api-production.up.railway.app/api/v1';
const WS = 'https://nyama-api-production.up.railway.app';

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const events = [];

  // 1) Login admin + fabrice (CLIENT) + catherine (COOK)
  const [admin, fabrice, catherine] = await Promise.all([
    login('+237699000000'),
    login('+237691000001'),
    login('+237690000001'),
  ]);
  step('Login admin/client/cook', !!admin.accessToken && !!fabrice.accessToken);

  // 2) Connect Fabrice socket pour capter menu:updated
  const sFabrice = io(WS, { transports: ['websocket'], auth: { token: fabrice.accessToken }, reconnection: false });
  sFabrice.onAny((event, data) => events.push({ time: Date.now(), event, data }));
  await new Promise((r) => sFabrice.once('connect', r));
  step('Socket Fabrice (CLIENT) connecté', true);

  // 3) GET /admin/menu/all sans filtre
  let allRes;
  try {
    allRes = await api(admin.accessToken, 'GET', '/admin/menu/all');
    const ok = allRes?.stats && Array.isArray(allRes.items);
    step('GET /admin/menu/all', ok,
      ok ? `total=${allRes.stats.totalDishes} dispo=${allRes.stats.dishesAvailable} indispo=${allRes.stats.dishesUnavailable} avgPrice=${allRes.stats.avgPrice}fcfa cats=${allRes.stats.categories.length}` :
        `res=${JSON.stringify(allRes).slice(0,150)}`);
  } catch (e) {
    step('GET /admin/menu/all', false, `${e.message} | ${JSON.stringify(e.body)}`);
    throw e;
  }

  // 4) GET avec filtre cookId=cp-catherine
  try {
    const r = await api(admin.accessToken, 'GET', '/admin/menu/all?cookId=cp-catherine');
    const allCatherine = r.items.every((i) => i.cookId === 'cp-catherine');
    step('GET /admin/menu/all?cookId=cp-catherine', allCatherine,
      `${r.items.length} plats, tous Catherine=${allCatherine}`);
  } catch (e) {
    step('GET ?cookId filter', false, e.message);
  }

  // 5) GET avec filtre available=false
  try {
    const r = await api(admin.accessToken, 'GET', '/admin/menu/all?available=false');
    const allUnavail = r.items.every((i) => i.isAvailable === false);
    step('GET /admin/menu/all?available=false', allUnavail,
      `${r.items.length} plats, tous indispos=${allUnavail}`);
  } catch (e) {
    step('GET ?available=false filter', false, e.message);
  }

  // 6) GET avec search
  try {
    const r = await api(admin.accessToken, 'GET', '/admin/menu/all?search=Ndol');
    step('GET /admin/menu/all?search=Ndol', r.items.length > 0,
      `${r.items.length} plats trouvés (premier: "${r.items[0]?.name ?? '—'}")`);
  } catch (e) {
    step('GET ?search filter', false, e.message);
  }

  // 7) GET /admin/menu/by-cook
  let byCookRes;
  try {
    byCookRes = await api(admin.accessToken, 'GET', '/admin/menu/by-cook');
    const groupKeys = Object.keys(byCookRes.groups || {});
    step('GET /admin/menu/by-cook', groupKeys.length > 0,
      `${groupKeys.length} groupes, total=${byCookRes.stats.totalDishes} plats`);
    // Affiche détail
    groupKeys.slice(0, 5).forEach((k) => {
      const g = byCookRes.groups[k];
      console.log(`     · ${g.cook.displayName.padEnd(25)} → ${g.totalDishes} plats (${g.totalAvailable} dispos, rating ${g.cook.avgRating ?? '—'})`);
    });
  } catch (e) {
    step('GET /admin/menu/by-cook', false, `${e.message} | ${JSON.stringify(e.body)}`);
  }

  // 8) Préparer un plat de test à override (Catherine crée un plat jetable)
  const tempDish = await api(catherine.accessToken, 'POST', '/cook/menu-items', {
    name: `Plat test admin override ${Date.now()}`,
    description: 'Plat éphémère pour test admin',
    priceXaf: 1000,
    category: 'plat',
    prepTimeMin: 20,
  });
  step('Catherine crée plat éphémère', !!tempDish.id, `id=${tempDish.id}`);

  // 9) PATCH /admin/menu-items/:id (admin override : changer prix + raison)
  try {
    const patched = await api(admin.accessToken, 'PATCH', `/admin/menu-items/${tempDish.id}`, {
      priceXaf: 999,
      reason: 'Test admin override',
    });
    step('PATCH /admin/menu-items/:id (priceXaf=999)', patched.priceXaf === 999,
      `priceXaf=${patched.priceXaf}`);
  } catch (e) {
    step('PATCH /admin/menu-items/:id', false, `${e.message} | ${JSON.stringify(e.body)}`);
  }

  // 10) Vérifier que Fabrice a reçu menu:updated avec adminAction
  await sleep(2000);
  const adminModEvent = events.find((e) => e.event === 'menu:updated'
    && e.data?.action === 'updated'
    && e.data?.menuItem?.id === tempDish.id
    && e.data?.menuItem?.adminAction?.type === 'admin_modified');
  step('Fabrice reçoit menu:updated adminAction=admin_modified', !!adminModEvent,
    adminModEvent ? `reason="${adminModEvent.data.menuItem.adminAction.reason}"` : '');

  // 11) DELETE /admin/menu-items/:id (admin soft-delete)
  try {
    const deleted = await api(admin.accessToken, 'DELETE', `/admin/menu-items/${tempDish.id}`, {
      reason: 'Plat retiré par admin (test)',
    });
    step('DELETE /admin/menu-items/:id', deleted.ok === true,
      `item.isAvailable=${deleted.item?.isAvailable}`);
  } catch (e) {
    step('DELETE /admin/menu-items/:id', false, `${e.message} | ${JSON.stringify(e.body)}`);
  }

  // 12) Vérifier event admin_deleted
  await sleep(1500);
  const adminDelEvent = events.find((e) => e.event === 'menu:updated'
    && e.data?.action === 'deleted'
    && e.data?.menuItem?.id === tempDish.id
    && e.data?.menuItem?.adminAction?.type === 'admin_deleted');
  step('Fabrice reçoit menu:updated adminAction=admin_deleted', !!adminDelEvent,
    adminDelEvent ? `reason="${adminDelEvent.data.menuItem.adminAction.reason}"` : '');

  // 13) Cleanup hard delete
  try {
    await api(catherine.accessToken, 'DELETE', `/cook/menu-items/${tempDish.id}`);
    step('Cleanup catherine DELETE', true);
  } catch (e) {
    step('Cleanup catherine DELETE', false, e.message);
  }

  // 14) Test guard : un CLIENT ne peut PAS appeler /admin/menu/all
  try {
    await api(fabrice.accessToken, 'GET', '/admin/menu/all');
    step('Guard: CLIENT bloqué sur /admin/menu/all', false, 'fabrice a pu accéder ?!');
  } catch (e) {
    step('Guard: CLIENT bloqué sur /admin/menu/all', e.status === 403 || e.status === 401,
      `HTTP ${e.status}`);
  }

  sFabrice.disconnect();

  const passed = STEPS.filter((s) => s.ok).length;
  const failed = STEPS.filter((s) => !s.ok).length;
  console.log(`\n📊 BILAN ADMIN MENU — ${passed} ✅ / ${failed} ❌`);

  const md = [
    '# Rapport admin menu endpoints',
    '',
    `Date : ${new Date().toISOString()}`,
    `Endpoint : ${API}`,
    '',
    `## Bilan : ${passed} ✅ / ${failed} ❌`,
    '',
    '## Étapes',
    '',
    ...STEPS.map((s) => `- ${s.ok ? '✅' : '❌'} **${s.label}**${s.detail ? ` — ${s.detail}` : ''}`),
    '',
    failed === 0 ? '**🟢 4 endpoints admin menu opérationnels**' : `**🔴 ${failed} échec(s)**`,
  ].join('\n');
  writeFileSync('admin-menu-report.md', md);
  console.log('📝 admin-menu-report.md écrit');

  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('💥 Aborted:', e.message);
  process.exit(2);
});
