// NYAMA — Test des 10 endpoints admin-extras (chantier 4)
import { writeFileSync } from 'node:fs';

const API = 'https://nyama-api-production.up.railway.app/api/v1';
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

async function test(label, fn) {
  try {
    const detail = await fn();
    step(label, true, detail);
  } catch (e) {
    step(label, false, `${e.message}${e.body ? ' | ' + JSON.stringify(e.body).slice(0, 100) : ''}`);
  }
}

async function run() {
  const admin = await login('+237699000000');
  const fabrice = await login('+237691000001');
  step('Login admin + client', true);

  // Helper riderProfileId : on a besoin du riderProfile.id pour le test payslip
  // u-kevin a un riderProfile, on peut le récupérer via /admin/leaderboard/riders
  let riderProfileId = null;

  await test('GET /admin/finances/commissions', async () => {
    const r = await api(admin.accessToken, 'GET', '/admin/finances/commissions');
    return `cookCount=${r.totals.cookCount} grossXaf=${r.totals.grossXaf} commissionXaf=${r.totals.commissionXaf}`;
  });

  await test('GET /admin/finances/treasury', async () => {
    const r = await api(admin.accessToken, 'GET', '/admin/finances/treasury');
    return `balance=${r.balanceXaf} alerts=${r.alerts.length}`;
  });

  await test('GET /admin/analytics/heatmap?period=24h', async () => {
    const r = await api(admin.accessToken, 'GET', '/admin/analytics/heatmap?period=24h');
    return `points=${r.count}`;
  });

  await test('GET /admin/analytics/revenue-history?days=14', async () => {
    const r = await api(admin.accessToken, 'GET', '/admin/analytics/revenue-history?days=14');
    return `series=${r.series.length} jours, dernier=${r.series.at(-1)?.revenue}fcfa`;
  });

  await test('GET /admin/analytics/cooks-load', async () => {
    const r = await api(admin.accessToken, 'GET', '/admin/analytics/cooks-load');
    const top = r.items[0];
    return `cooks=${r.count} top: ${top?.name} (load=${top?.loadPct}%)`;
  });

  await test('GET /admin/leaderboard/riders?period=week', async () => {
    const r = await api(admin.accessToken, 'GET', '/admin/leaderboard/riders?period=week');
    if (r.items[0]) riderProfileId = r.items[0].riderProfileId;
    return `${r.items.length} riders, top: ${r.items[0]?.name} (${r.items[0]?.deliveryCount} courses)`;
  });

  await test('GET /admin/leaderboard/cooks?period=week', async () => {
    const r = await api(admin.accessToken, 'GET', '/admin/leaderboard/cooks?period=week');
    return `${r.items.length} cooks, top: ${r.items[0]?.name} (${r.items[0]?.orderCount} cmdes, ${r.items[0]?.revenueXaf}fcfa)`;
  });

  await test('GET /admin/finances/payslip/u-kevin (current week)', async () => {
    const r = await api(admin.accessToken, 'GET', '/admin/finances/payslip/u-kevin');
    return `rider=${r.rider?.name ?? 'null'} week=${r.week} deliveries=${r.totals.count} earnings=${r.totals.earningsXaf}`;
  });

  // Crisis mode
  await test('GET /admin/crisis/status (initial)', async () => {
    const r = await api(admin.accessToken, 'GET', '/admin/crisis/status');
    return `active=${r.active}`;
  });

  await test('POST /admin/crisis/activate (5 min)', async () => {
    const r = await api(admin.accessToken, 'POST', '/admin/crisis/activate', {
      minutes: 5,
      reason: 'Test E2E chantier 4',
    });
    return `active=${r.active} reason="${r.reason}" endsAt=${r.endsAt}`;
  });

  await test('GET /admin/crisis/status (after activate)', async () => {
    const r = await api(admin.accessToken, 'GET', '/admin/crisis/status');
    if (!r.active) throw new Error('Should be active');
    return `active=${r.active}`;
  });

  await test('POST /admin/crisis/deactivate', async () => {
    const r = await api(admin.accessToken, 'POST', '/admin/crisis/deactivate');
    if (r.active) throw new Error('Should be inactive');
    return `active=${r.active}`;
  });

  await test('GET /admin/ai/predict-tomorrow', async () => {
    const r = await api(admin.accessToken, 'GET', '/admin/ai/predict-tomorrow');
    return `tomorrow=${r.tomorrow} forecast=${r.forecastXaf}fcfa baseline=${r.baseline} multiplier=${r.dowMultiplier} confidence=${r.confidence}`;
  });

  // Guard ADMIN
  await test('Guard CLIENT bloqué sur /admin/finances/treasury', async () => {
    try {
      await api(fabrice.accessToken, 'GET', '/admin/finances/treasury');
      throw new Error('CLIENT a pu accéder');
    } catch (e) {
      if (e.status === 403 || e.status === 401) return `HTTP ${e.status}`;
      throw e;
    }
  });

  const passed = STEPS.filter((s) => s.ok).length;
  const failed = STEPS.filter((s) => !s.ok).length;
  console.log(`\n📊 BILAN ADMIN-EXTRAS — ${passed} ✅ / ${failed} ❌`);

  const md = [
    '# Rapport admin-extras (chantier 4)',
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
    failed === 0 ? '**🟢 10 endpoints admin-extras opérationnels**' : `**🔴 ${failed} échec(s)**`,
  ].join('\n');
  writeFileSync('admin-extras-report.md', md);
  console.log('📝 admin-extras-report.md écrit');

  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('💥', e.message);
  process.exit(2);
});
