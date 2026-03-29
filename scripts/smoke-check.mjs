#!/usr/bin/env node
/**
 * Smoke check: weryfikuje, że API odpowiada i endpointy zwracają oczekiwany format.
 * Uruchom gdy API działa (npm run dev). Domyślnie: http://localhost:3000
 */
const API_BASE = process.env.API_URL || 'http://localhost:3000';
const SMOKE_EMAIL = process.env.SMOKE_EMAIL || process.env.SEED_ADMIN_EMAIL || 'biuro@lamastage.pl';
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD || process.env.SEED_ADMIN_PASSWORD || 'admin1234';

async function check(name, url, validator = () => true, headers = {}) {
  try {
    const res = await fetch(url, { headers });
    const ok = res.ok;
    const body = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    const valid = body !== null && validator(body);
    if (ok && valid) {
      console.log(`  OK ${name}`);
      return true;
    }
    console.error(`  FAIL ${name}: status=${res.status} ok=${ok} valid=${valid}`, body ? '' : await res.text());
    return false;
  } catch (e) {
    console.error(`  FAIL ${name}:`, e.message);
    return false;
  }
}

async function loginAndGetCookie() {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD }),
  });
  if (!res.ok) {
    const maybeJson = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(maybeJson || {})}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('Brak Set-Cookie po loginie');
  return setCookie.split(';')[0];
}

async function main() {
  console.log(`Smoke check: ${API_BASE}\n`);

  const health = await check('GET /health', `${API_BASE}/health`, (b) => b.status === 'ok');
  const authCookie = await loginAndGetCookie();
  const authHeaders = { cookie: authCookie };

  const clients = await check(
    'GET /api/clients?page=1&limit=1',
    `${API_BASE}/api/clients?page=1&limit=1`,
    (b) => Array.isArray(b.data) && b.meta && typeof b.meta.total === 'number',
    authHeaders
  );
  const orders = await check(
    'GET /api/orders?page=1&limit=1',
    `${API_BASE}/api/orders?page=1&limit=1`,
    (b) => Array.isArray(b.data) && b.meta && typeof b.meta.total === 'number',
    authHeaders
  );

  const equipment = await check(
    'GET /api/equipment?page=1&limit=1',
    `${API_BASE}/api/equipment?page=1&limit=1`,
    (b) => Array.isArray(b.data) && b.meta && typeof b.meta.total === 'number',
    authHeaders
  );

  const issuerProfiles = await check(
    'GET /api/issuer-profiles?page=1&limit=10',
    `${API_BASE}/api/issuer-profiles?page=1&limit=10`,
    (b) => Array.isArray(b.data) && b.meta && typeof b.meta.total === 'number',
    authHeaders
  );

  const transportPricing = await check(
    'GET /api/finance/transport-pricing',
    `${API_BASE}/api/finance/transport-pricing`,
    (b) =>
      b?.data &&
      Array.isArray(b.data.ranges) &&
      b.data.ranges.length > 0 &&
      b.data.ranges.every(
        (row) =>
          typeof row?.fromKm === 'number' &&
          typeof row?.toKm === 'number' &&
          typeof row?.flatNet === 'number'
      ) &&
      typeof b.data.longDistancePerKm === 'number',
    authHeaders
  );

  const transportQuote = await check(
    'GET /api/finance/transport-pricing/quote?distanceKm=120&trips=2',
    `${API_BASE}/api/finance/transport-pricing/quote?distanceKm=120&trips=2`,
    (b) =>
      b?.data &&
      typeof b.data.baseNetPerTrip === 'number' &&
      typeof b.data.totalNet === 'number' &&
      typeof b.data.formula === 'string' &&
      b.data.trips === 2,
    authHeaders
  );

  let orderById = true;
  try {
    const listRes = await fetch(`${API_BASE}/api/orders?page=1&limit=1`, { headers: authHeaders });
    const listBody = await listRes.json();
    const firstId = listBody?.data?.[0]?.id;
    if (firstId) {
      const oneRes = await fetch(`${API_BASE}/api/orders/${firstId}`, { headers: authHeaders });
      const oneBody = await oneRes.json();
      const order = oneBody?.data ?? oneBody;
      orderById = oneRes.ok && order && (order.id || order.equipmentItems) !== undefined;
      if (!orderById) console.error('  FAIL GET /api/orders/:id - bad structure');
      else console.log('  OK GET /api/orders/:id');
    }
  } catch (e) {
    orderById = false;
    console.error('  FAIL GET /api/orders/:id', e.message);
  }

  const all =
    health && clients && orders && equipment && issuerProfiles && transportPricing && transportQuote && orderById;
  console.log(all ? '\nSmoke check passed.' : '\nSmoke check failed.');
  process.exit(all ? 0 : 1);
}

main();
