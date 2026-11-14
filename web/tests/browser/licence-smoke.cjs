// Browser check for the owner licence screen (Stage 7E), at phone width.
// Supabase is replaced by an in-memory mock (page.route), so this checks the screen,
// the requests it sends and the states it shows. It does NOT test the database.
// The database reply shapes are checked separately (web/tests/fixtures).
//
// Run by hand, like the other smoke scripts: serve web/ on port 5174, then run this file.
//   cd web && python3 -m http.server 5174 --bind 127.0.0.1 &
//   node tests/browser/licence-smoke.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { readFileSync } = require('fs');
const path = require('path');
const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.js'); // web/config.js

const BASE = 'http://127.0.0.1:5174/';
const ALPHA = { id: 'aaaaaaaa-0000-0000-0000-00000000000a', slug: 'alpha-print', name: 'Alpha Print' };
const BETA = { id: 'bbbbbbbb-0000-0000-0000-00000000000b', slug: 'beta-print', name: 'Beta Print' };

const DAY = 86400000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString().replace('Z', '+00:00');
const ACTIVE_DATED = { ok: true, active: true, no_expiry: false, access_end: iso(now + 90 * DAY), next_start: null };
const ACTIVE_LIFETIME = { ok: true, active: true, no_expiry: true, access_end: null, next_start: null };
const SCHEDULED = { ok: true, active: false, no_expiry: false, access_end: null, next_start: iso(now + 30 * DAY) };
const INACTIVE = { ok: true, active: false, no_expiry: false, access_end: null, next_start: null };
const FORBIDDEN = { ok: false, code: 'forbidden' };

// What the mock returns for each shop. A spec may add delayMs, abort or status.
const state = {
  role: 'owner',
  licence: {
    [ALPHA.id]: { body: ACTIVE_DATED },
    [BETA.id]: { body: SCHEDULED },
  },
  requests: [],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const licenceCalls = () => state.requests.filter((r) => r.path.endsWith('/rpc/shop_licence_status'));

const SESSION = {
  access_token: 'owner-token',
  refresh_token: 'refresh-1',
  expires_at: Math.floor(now / 1000) + 3600,
  user: { id: 'owner-1', email: 'owner@example.com' },
};

function shopRow(shop) {
  return {
    id: shop.id,
    slug: shop.slug,
    name: shop.name,
    phone: null,
    address: null,
    is_open: true,
    features: {},
    payment_qr_path: null,
    cash_payment_timing: 'at_pickup',
    minimum_order_paise: 0,
  };
}

async function handleSupabase(route) {
  const req = route.request();
  const url = new URL(req.url());
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });

  let body = null;
  try {
    body = req.postData() ? JSON.parse(req.postData()) : null;
  } catch {
    body = null;
  }
  state.requests.push({ method: req.method(), path: url.pathname, auth: req.headers()['authorization'] ?? null, body });

  const json = (status, data) =>
    route.fulfill({ status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: data === null ? '' : JSON.stringify(data) });

  if (url.pathname === '/auth/v1/logout') return json(204, null);
  if (url.pathname === '/rest/v1/shop_memberships') {
    return json(
      200,
      [ALPHA, BETA].map((shop) => ({ role: state.role, shop: shopRow(shop) }))
    );
  }
  if (url.pathname === '/rest/v1/services') return json(200, []);
  if (url.pathname === '/rest/v1/feature_catalog') return json(200, []);
  if (url.pathname === '/rest/v1/rpc/shop_licence_status') {
    const spec = state.licence[body?.p_shop_id];
    if (!spec) return json(200, FORBIDDEN);
    if (spec.delayMs) await sleep(spec.delayMs);
    if (spec.abort) return route.abort('failed');
    if (spec.status) return json(spec.status, { code: 'PGRST000', message: 'simulated server failure' });
    return json(200, spec.body);
  }
  return json(404, { message: `not mocked: ${url.pathname}` });
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, prefer, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

const results = [];
let failures = 0;
function check(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

// The licence page's own text, as a single string (buttons and status lines).
async function screenText(page) {
  return page.locator('#app').innerText();
}
async function buttonLabels(page) {
  return page.locator('#app button').allInnerTexts();
}
async function waitForText(page, text, timeout = 8000) {
  await page.waitForFunction((t) => document.querySelector('#app')?.innerText.includes(t), text, { timeout });
}
async function waitForCalls(count, timeout = 8000) {
  const start = Date.now();
  while (licenceCalls().length < count) {
    if (Date.now() - start > timeout) throw new Error(`timed out waiting for ${count} licence request(s)`);
    await sleep(25);
  }
}

(async () => {
  const launchOptions = { args: ['--no-sandbox'] };
  // Optional: CHROMIUM_PATH names a Chromium binary. Unset, Playwright uses its own browser.
  if (process.env.CHROMIUM_PATH) launchOptions.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // Seed the owner session once for this tab, the same way a signed-in owner has it.
  await context.addInitScript((session) => {
    if (!sessionStorage.getItem('__licence_smoke_seeded')) {
      sessionStorage.setItem('qrquick.owner.session', JSON.stringify(session));
      sessionStorage.setItem('__licence_smoke_seeded', '1');
    }
  }, SESSION);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);

  const problems = [];
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    const text = msg.text();
    // Mocked failures (503, aborted request) are logged by the browser on purpose.
    const expected = /Failed to load resource|net::ERR_FAILED|simulated server failure/.test(text);
    if (msg.type() === 'error' && !expected && !/favicon/i.test(text)) problems.push(`console: ${text}`);
  });
  await page.route(/supabase\.co/, handleSupabase);

  // ----- owner opens a shop -----
  await page.goto(`${BASE}#/owner/shop/${ALPHA.slug}`);
  await page.getByRole('link', { name: 'Licence', exact: true }).waitFor();
  check('web build: the owner-only Android switch is off', (await page.evaluate(() => window.PRINTNEST_CONFIG?.ownerApp)) === false);
  check('owner sees a Licence link on the shop page', (await page.getByRole('link', { name: 'Licence', exact: true }).count()) === 1);

  await page.getByRole('link', { name: 'Licence', exact: true }).click();
  await waitForText(page, 'Access until');
  let text = await screenText(page);
  check('active dated licence says it is active until a time', /Active/.test(text) && /Access until \d{1,2} \w{3} \d{4}, \d{2}:\d{2} IST/.test(text), text.split('\n').slice(0, 6).join(' | '));
  const first = licenceCalls()[0];
  check('licence check sends one owner RPC with the shop id and owner token',
    licenceCalls().length === 1 && first.body?.p_shop_id === ALPHA.id && first.auth === 'Bearer owner-token',
    JSON.stringify(first));
  check('the licence page sends no call to the licence tables', !state.requests.some((r) => /licence_(coverages|config|denial|admin)|shop_licence_state/.test(r.path)));
  check('no printing-permitted line is shown (removed until 7F enforcement exists)', !/Printing permitted/i.test(await screenText(page)));
  check('the page offers only Refresh, not any licence change', JSON.stringify(await buttonLabels(page)) === '["Refresh"]', JSON.stringify(await buttonLabels(page)));

  // ----- refresh: overlapping presses make one request -----
  state.licence[ALPHA.id] = { body: ACTIVE_LIFETIME, delayMs: 700 };
  const before = licenceCalls().length;
  // Two presses in the same tick. The second lands on the button the first press replaced.
  await page.evaluate(() => {
    const button = document.querySelector('#app [data-action="licence-refresh"]');
    button.click();
    button.click();
  });
  await page.getByRole('button', { name: 'Checking…' }).waitFor();
  const disabled = await page.getByRole('button', { name: 'Checking…' }).isDisabled();
  await waitForText(page, 'Lifetime access');
  check('refresh button is disabled while a check runs', disabled === true);
  check('overlapping refresh presses make one request', licenceCalls().length - before === 1, `new=${licenceCalls().length - before}`);
  text = await screenText(page);
  check('lifetime coverage shows no expiry and no printing line', /Lifetime access\. No expiry\./.test(text) && !/Printing permitted/i.test(text));
  state.licence[ALPHA.id] = { body: ACTIVE_DATED };

  // ----- inactive, scheduled -----
  state.licence[ALPHA.id] = { body: INACTIVE };
  await page.getByRole('button', { name: 'Refresh' }).click();
  await waitForText(page, 'No printing access is active');
  check('inactive shows Not active, with no reason given and no printing line', /Not active/.test(await screenText(page)) && !/Printing permitted/i.test(await screenText(page)));

  state.licence[ALPHA.id] = { body: SCHEDULED };
  await page.getByRole('button', { name: 'Refresh' }).click();
  await waitForText(page, 'next access starts');
  text = await screenText(page);
  const scheduledParas = await page.locator('.licence-status p').allInnerTexts();
  check('scheduled coverage: one Not active badge, the next start on its own line, no printing line', /Not active/.test(text) && !/Not active now/.test(text) && /No access is active now\./.test(text) && scheduledParas.some((p) => /^The next access starts \d{1,2} \w{3} \d{4}, \d{2}:\d{2} IST\.$/.test(p)) && !/Printing permitted/i.test(text));

  // ----- unavailable states: never shown as active -----
  state.licence[ALPHA.id] = { body: ACTIVE_DATED };
  await page.getByRole('button', { name: 'Refresh' }).click();
  await waitForText(page, 'Access until');

  state.licence[ALPHA.id] = { body: FORBIDDEN };
  await page.getByRole('button', { name: 'Refresh' }).click();
  await waitForText(page, 'cannot see the licence status');
  text = await screenText(page);
  check('forbidden reply is unavailable, and the old Access until line is gone', /Status unavailable/.test(text) && !/Access until/.test(text) && !/\bActive\b/.test(text));
  check('forbidden reply shows no printing line', !/Printing permitted/i.test(await screenText(page)));

  state.licence[ALPHA.id] = { body: { ok: true, active: true } };
  await page.getByRole('button', { name: 'Refresh' }).click();
  await waitForText(page, 'cannot read');
  check('malformed reply is unavailable, never active', /Status unavailable/.test(await screenText(page)) && !/Access until/.test(await screenText(page)));

  state.licence[ALPHA.id] = { abort: true };
  await page.getByRole('button', { name: 'Refresh' }).click();
  await waitForText(page, 'could not be reached');
  text = await screenText(page);
  check('network failure is unavailable, distinct from inactive', /Status unavailable/.test(text) && !/No printing access is active/.test(text) && !/Access until/.test(text));

  state.licence[ALPHA.id] = { status: 503 };
  await page.getByRole('button', { name: 'Refresh' }).click();
  await waitForText(page, 'busy or unavailable');
  check('server failure is unavailable, with a retry hint', /Status unavailable/.test(await screenText(page)));

  // ----- offline: no request is sent -----
  state.licence[ALPHA.id] = { body: ACTIVE_DATED };
  await page.getByRole('button', { name: 'Refresh' }).click();
  await waitForText(page, 'Access until');
  await context.setOffline(true);
  const beforeOffline = licenceCalls().length;
  await page.getByRole('button', { name: 'Refresh' }).click();
  await waitForText(page, 'This device is offline');
  check('offline shows its own message, not inactive', /Status unavailable/.test(await screenText(page)) && !/No printing access/.test(await screenText(page)));
  check('offline sends no licence request', licenceCalls().length === beforeOffline);
  await context.setOffline(false);

  // ----- shop switching: a late reply for shop A must not reach shop B -----
  state.licence[ALPHA.id] = { body: ACTIVE_DATED, delayMs: 900 };
  state.licence[BETA.id] = { body: SCHEDULED };
  // Start from the shop list, so each licence visit is a real navigation (same-hash goto does nothing).
  await page.goto(`${BASE}#/owner`);
  await page.getByRole('button', { name: 'Sign out' }).waitFor();
  const beforeSwitch = licenceCalls().length;
  await page.goto(`${BASE}#/owner/shop/${ALPHA.slug}/licence`);
  await waitForCalls(beforeSwitch + 1);
  await page.goto(`${BASE}#/owner/shop/${BETA.slug}/licence`);
  await waitForText(page, 'next access starts');
  await sleep(1300); // long enough for Alpha's late reply to arrive
  text = await screenText(page);
  check('shop switch: Beta shows its own status after Alpha replies late', /Beta Print/.test(text) && /next access starts/.test(text) && !/Access until/.test(text), text.split('\n').slice(0, 3).join(' | '));

  // ----- sign-out during a check: nothing from the licence stays on screen -----
  state.licence[BETA.id] = { body: ACTIVE_LIFETIME, delayMs: 900 };
  await page.goto(`${BASE}#/owner`);
  await page.getByRole('button', { name: 'Sign out' }).waitFor();
  const beforeSignOutCheck = licenceCalls().length;
  await page.goto(`${BASE}#/owner/shop/${BETA.slug}/licence`);
  await waitForCalls(beforeSignOutCheck + 1);
  await page.goto(`${BASE}#/owner`);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.locator('#auth-form').waitFor();
  await sleep(1300);
  const afterSignOut = await page.evaluate(() => sessionStorage.getItem('qrquick.owner.session'));
  text = await page.locator('#app').innerText();
  check('sign-out clears the stored session', afterSignOut === null);
  check('sign-out leaves no licence text on screen, even after a late reply', !/Lifetime access|Access until|Next access|Not active|Status unavailable/.test(text));

  // ----- staff: no licence link, no request -----
  // Sign-out cleared the session in memory too, so restore it and reload the app.
  await page.evaluate((s) => sessionStorage.setItem('qrquick.owner.session', JSON.stringify(s)), SESSION);
  await page.goto(`${BASE}#/owner`);
  await page.reload();
  state.role = 'staff';
  const beforeStaff = licenceCalls().length;
  await page.goto(`${BASE}#/owner/shop/${ALPHA.slug}`);
  await page.getByRole('link', { name: 'Statistics', exact: true }).waitFor();
  check('staff see no Licence link on the shop page', (await page.getByRole('link', { name: 'Licence', exact: true }).count()) === 0);
  await page.goto(`${BASE}#/owner/shop/${ALPHA.slug}/licence`);
  await waitForText(page, 'shown to the shop owner only');
  check('staff who open the licence page directly are told it is for owners', /shown to the shop owner only/.test(await screenText(page)) && !/Access until|Lifetime access|Not active/.test(await screenText(page)));
  check('staff open page sends no licence request', licenceCalls().length === beforeStaff);
  state.role = 'owner';

  // ----- layout and errors -----
  await page.goto(`${BASE}#/owner`);
  await page.getByRole('button', { name: 'Sign out' }).waitFor();
  await page.goto(`${BASE}#/owner/shop/${ALPHA.slug}/licence`);
  await waitForText(page, 'Access until');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no horizontal scroll at phone width (390px)', overflow <= 0, `overflow=${overflow}px`);
  check('no JavaScript errors in the browser', problems.length === 0, problems.join(' | '));

  // ----- Android owner bundle (config.ownerApp = true): the licence view is off -----
  // A fresh context, so no copy of the normal config.js is cached. config.js is served
  // with ownerApp switched on, the same change mobile/scripts/copy-web.mjs makes.
  const androidContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await androidContext.addInitScript((session) => {
    if (!sessionStorage.getItem('__licence_smoke_seeded')) {
      sessionStorage.setItem('qrquick.owner.session', JSON.stringify(session));
      sessionStorage.setItem('__licence_smoke_seeded', '1');
    }
  }, SESSION);
  const android = await androidContext.newPage();
  android.setDefaultTimeout(8000);
  const androidProblems = [];
  android.on('pageerror', (err) => androidProblems.push(`pageerror: ${err.message}`));
  android.on('console', (msg) => {
    const text = msg.text();
    const expected = /Failed to load resource|net::ERR_FAILED|simulated server failure/.test(text);
    if (msg.type() === 'error' && !expected && !/favicon/i.test(text)) androidProblems.push(`console: ${text}`);
  });
  await android.route(/supabase\.co/, handleSupabase);
  await android.route(/\/config\.js(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: readFileSync(CONFIG_PATH, 'utf8').replace(/ownerApp:\s*false/, 'ownerApp: true'),
    })
  );

  const beforeAndroid = licenceCalls().length;
  await android.goto(`${BASE}#/owner/shop/${ALPHA.slug}`);
  await android.getByRole('link', { name: 'Statistics', exact: true }).waitFor();
  check('Android bundle: the owner-only switch is on', (await android.evaluate(() => window.PRINTNEST_CONFIG?.ownerApp)) === true);
  check('Android bundle: the shop page has no Licence link', (await android.getByRole('link', { name: 'Licence', exact: true }).count()) === 0);
  check('Android bundle: the rest of the owner shop page still shows', (await android.getByRole('link', { name: 'Statistics', exact: true }).count()) === 1);
  await android.goto(`${BASE}#/owner/shop/${ALPHA.slug}/licence`);
  await waitForText(android, 'Services and prices');
  text = await screenText(android);
  check('Android bundle: the licence address shows the shop page, not the licence screen',
    !/Access until|Lifetime access|No printing access|Not active|Status unavailable|Checking/.test(text));
  check('Android bundle: opening the licence address sends no licence request', licenceCalls().length === beforeAndroid, `new=${licenceCalls().length - beforeAndroid}`);
  check('Android bundle: no JavaScript errors in the browser', androidProblems.length === 0, androidProblems.join(' | '));

  await browser.close();
  console.log(`\n${results.length - failures} of ${results.length} checks passed.`);
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error('Smoke run failed:', err);
  process.exit(2);
});
