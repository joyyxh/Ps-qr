// Local browser smoke test for the admin panel. Run manually: node tests/browser-smoke.cjs
// Every network request is intercepted. The only hosts used are 127.0.0.1 (this static server) and
// smoke-stub.supabase.co (a stub inside Playwright; the hostname contains a hyphen, so it is not a valid project reference). No Supabase project, staging or production system is contacted.
// This is UI evidence only. It is not staging evidence and it does not verify the server RPCs.
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const ADMIN = path.resolve(__dirname, '..');
const STUB = 'https://smoke-stub.supabase.co';
const SHOP = '8f14e45f-ceea-4b7a-9c1d-2a3b4c5d6e7f';
const COVERAGE = '3b241101-e2bb-4255-8caf-4136c566a962';
const ACTOR = '11111111-2222-4333-8444-555555555555';
const SHOP_ROW = { shop_id: SHOP, slug: 'sunrise-print', name: 'Sunrise Print' };
// The stub returns pages of two, on purpose, so that the paging control is exercised.
const STUB_PAGE_SIZE = 2;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain' };

function jwt(claims) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.not-verified-by-client`;
}
const AAL1 = jwt({ sub: 'admin', aal: 'aal1', email: 'admin@example.test', exp: 9999999999 });
const AAL2 = jwt({ sub: 'admin', aal: 'aal2', email: 'admin@example.test', exp: 9999999999 });
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';

function entry(n, createdAt, action, reason) {
  return {
    entry_id: `00000000-0000-4000-8000-00000000000${n}`,
    created_at: createdAt,
    action,
    coverage_id: COVERAGE,
    reason,
    licence_start: null,
    licence_end: '2026-12-01T00:00:00+05:30',
    actor_user_id: ACTOR,
    before_state: {},
    after_state: {},
  };
}

// Newest first, as the server returns it.
function makeHistory() {
  return [
    entry(1, '2026-11-05T10:00:00+05:30', 'extend', 'Newest kept entry'),
    entry(2, '2026-11-04T10:00:00+05:30', 'grant', 'Second entry'),
    entry(3, '2026-11-03T10:00:00+05:30', 'grant', 'Oldest entry'),
  ];
}
const COMMITTED_ENTRY = entry(9, '2026-11-08T11:00:00+05:30', 'grant', 'Cash received at counter');

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
    if (urlPath === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    const file = path.join(ADMIN, path.normalize(urlPath));
    if (!file.startsWith(ADMIN) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function openPanel(browser, origin, { configured, viewport, supabase }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  const hosts = new Set();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('request', (r) => hosts.add(new URL(r.url()).host));
  await page.route('**/config.js', (route) => {
    if (!configured) return route.continue();
    return route.fulfill({
      contentType: 'text/javascript',
      body: `window.QRQUICK_ADMIN_CONFIG = { supabaseUrl: '${STUB}', publishableKey: 'sb_publishable_smoke_only' };`,
    });
  });
  if (supabase) await page.route(`${STUB}/**`, supabase);
  await page.goto(origin + '/', { waitUntil: 'load' });
  return { context, page, errors, hosts };
}

function check(name, condition, detail = '') {
  const status = condition ? 'PASS' : 'FAIL';
  console.log(`${status}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!condition) process.exitCode = 1;
}

async function scenarioUnconfigured(browser, origin) {
  const { context, page, errors, hosts } = await openPanel(browser, origin, { configured: false, viewport: { width: 1280, height: 800 } });
  check('unconfigured: shows the not-configured view', await page.locator('#view-config').isVisible());
  check('unconfigured: sign-in view hidden', !(await page.locator('#view-signin').isVisible()));
  check('unconfigured: no request leaves localhost', [...hosts].every((h) => h.startsWith('127.0.0.1')), [...hosts].join(','));
  check('unconfigured: no console or page errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

// Searches, chooses the shop, reads its audit history page by page, then reviews and sends a grant.
async function chooseShopAndGrant({ page, label, mode, rpcCalls }) {
  check(`${label}: nothing is filled in before a shop is chosen`, (await page.inputValue('#shop_id')) === '' && (await page.getAttribute('#shop_id', 'readonly')) !== null);
  check(`${label}: review is off before a licence view is loaded`, await page.isDisabled('#review-submit'));

  await page.fill('#shop-query', 'sun');
  await page.click('#shop-search-submit');
  await page.locator('#shop-results .pick').first().waitFor({ state: 'visible' });
  check(`${label}: search finds the shop by name`, (await page.textContent('#shop-results')).includes('Sunrise Print'));

  await page.click('#shop-results .pick');
  await page.waitForFunction(() => document.getElementById('expected_state_version').value === '3');
  check(`${label}: shop ID and state version come from the server, read-only`,
    (await page.inputValue('#shop_id')) === SHOP
    && (await page.getAttribute('#shop_id', 'readonly')) !== null
    && (await page.getAttribute('#expected_state_version', 'readonly')) !== null);
  check(`${label}: licence view shows the state and its version`, (await page.textContent('#licence-facts')).includes('State version'));
  check(`${label}: coverage ID is shown with its coverage`, (await page.textContent('#coverage-list')).includes(COVERAGE));

  await page.locator('#audit-list li').nth(1).waitFor({ state: 'visible' });
  check(`${label}: first audit page shows two entries and offers older ones`,
    (await page.locator('#audit-list li').count()) === 2 && (await page.isVisible('#audit-more')));
  await page.click('#audit-more');
  await page.waitForFunction(() => document.querySelectorAll('#audit-list li').length === 3);
  check(`${label}: older entries are appended and the paging control hides at the end`, await page.isHidden('#audit-more'));
  // N5 (open): the recording admin's ID is in the API response but must not appear on screen.
  const auditText = await page.textContent('#audit-list');
  check(`${label}: the audit list does not show the recording admin's user ID (N5)`,
    !auditText.includes(ACTOR) && !auditText.includes('Recorded by'));

  await page.check('#coverage-list input[type=radio]');
  check(`${label}: choosing a coverage fills its ID, read-only`, (await page.inputValue('#target_coverage_id')) === COVERAGE);

  await page.fill('#reason', '  Cash received at counter  ');
  await page.check('#confirm');
  await page.click('#review-submit');
  await page.locator('#review').waitFor({ state: 'visible' });
  const review = await page.textContent('#review-list');
  check(`${label}: review shows the shop, the version and the reason before sending`,
    review.includes('Sunrise Print') && review.includes('Expected state version') && review.includes('Cash received at counter'));
  await page.click('#review-confirm');

  if (mode === 'unknown') {
    await page.locator('#result-actions').waitFor({ state: 'visible' });
    check(`${label}: a dropped request is reported as unknown, not as done`, (await page.textContent('#result-text')).includes('not known'));
    await page.click('#retry');
    await page.waitForFunction(() => document.getElementById('result-text').textContent.includes('already been committed'));
    check(`${label}: retry returns the stored result (replay), no double write`, true);
    check(`${label}: both sends carry the same request ID`, rpcCalls.length === 2 && rpcCalls[0].p_request_id === rpcCalls[1].p_request_id, `${rpcCalls.length} calls`);
    check(`${label}: both sends carry an identical payload`, JSON.stringify(rpcCalls[0].p_payload) === JSON.stringify(rpcCalls[1].p_payload));
    check(`${label}: payload has only the grant keys and no hash or user field`, Object.keys(rpcCalls[0].p_payload).sort().join(',') === 'backdate_confirm,confirm,end,expected_state_version,grant_kind,reason,shop_id,start' && !JSON.stringify(rpcCalls[0]).includes('payload_hash'), Object.keys(rpcCalls[0].p_payload).join(','));
    await page.waitForFunction(() => document.getElementById('expected_state_version').value === '4');
    await page.waitForFunction(() => {
      const first = document.querySelector('#audit-list li');
      return first !== null && first.textContent.includes('Cash received at counter');
    });
    check(`${label}: after the commit the licence view and audit reload, with the new version and entry`, true);
  } else {
    await page.waitForFunction(() => document.getElementById('result-text').textContent.includes('changed'));
    check(`${label}: a stale version gives a plain message that names the change`, (await page.textContent('#result-text')).includes('nothing was changed'));
    check(`${label}: rejection shows the server code`, (await page.textContent('#result-list')).includes('stale_state_version'));
    await page.waitForFunction(() => !document.getElementById('review-submit').disabled);
    check(`${label}: the licence view is reloaded after a stale rejection, with the same version`, (await page.inputValue('#expected_state_version')) === '3');
    check(`${label}: the review is cleared after a rejection`, await page.isHidden('#review'));
  }
}

async function scenarioRpc({ browser, origin, mode, layoutCheck }) {
  const rpcCalls = [];
  let rpcCount = 0;
  let mfaVerified = false;
  let version = 3;
  let history = makeHistory();
  const factors = mode === 'enrol' ? [] : [{ id: 'f1', factor_type: 'totp', status: 'verified' }];

  const licenceView = () => ({
    ok: true,
    shop: SHOP_ROW,
    state_version: version,
    state: { state: 'ACTIVE', basis: 'admin_grant', access_until: '2026-12-01T00:00:00+05:30', next_start: null },
    coverages: [{
      coverage_id: COVERAGE,
      kind: 'admin_grant',
      status: 'current',
      starts_at: '2026-11-01T00:00:00+05:30',
      ends_at: '2026-12-01T00:00:00+05:30',
      reason: 'Cash received',
    }],
    coverages_truncated: false,
  });
  const auditPage = (body) => {
    const start = body.p_after_created_at === null ? 0 : history.findIndex((e) => e.entry_id === body.p_after_id) + 1;
    const items = history.slice(start, start + STUB_PAGE_SIZE);
    const last = items[items.length - 1];
    const more = start + STUB_PAGE_SIZE < history.length;
    return { ok: true, entries: items, next: more && last ? { created_at: last.created_at, entry_id: last.entry_id } : null };
  };

  const supabase = async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const reply = (status, body) => route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
    if (p === '/auth/v1/token') return reply(200, { access_token: AAL1, refresh_token: 'r1', expires_in: 3600 });
    if (p === '/auth/v1/user') return reply(200, { email: 'admin@example.test', factors: mfaVerified ? [{ id: 'f1', factor_type: 'totp', status: 'verified' }] : factors });
    if (p === '/auth/v1/factors' && req.method() === 'POST') return reply(200, { id: 'f9', totp: { qr_code: SVG, secret: 'ABC234DEF' } });
    if (p.endsWith('/challenge')) return reply(200, { id: 'c1' });
    if (p.endsWith('/verify')) { mfaVerified = true; return reply(200, { access_token: AAL2, refresh_token: 'r2', expires_in: 3600 }); }
    if (p === '/rest/v1/rpc/admin_search_shops') {
      const { p_query: query } = req.postDataJSON();
      return reply(200, { ok: true, shops: query.startsWith('sun') ? [SHOP_ROW] : [], has_more: false });
    }
    if (p === '/rest/v1/rpc/admin_shop_licence') return reply(200, licenceView());
    if (p === '/rest/v1/rpc/admin_shop_audit') return reply(200, auditPage(req.postDataJSON()));
    if (p.startsWith('/rest/v1/rpc/licence_admin_')) {
      rpcCount += 1;
      rpcCalls.push(req.postDataJSON());
      if (mode === 'unknown' && rpcCount === 1) return route.abort('failed');
      if (mode === 'unknown') {
        version = 4;
        history = [COMMITTED_ENTRY, ...history];
        return reply(200, { ok: true, replay: true, action: 'grant', coverage_id: COVERAGE, target_coverage_id: null, state_version_after: 4 });
      }
      return reply(200, { ok: false, code: 'stale_state_version' });
    }
    if (p === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' });
    return reply(404, {});
  };

  const viewport = layoutCheck ? { width: 375, height: 812 } : { width: 1280, height: 800 };
  const { context, page, errors, hosts } = await openPanel(browser, origin, { configured: true, viewport, supabase });
  const label = `${mode}${layoutCheck ? ' 375px' : ''}`;

  check(`${label}: sign-in view shown`, await page.locator('#view-signin').isVisible());
  await page.fill('#email', 'admin@example.test');
  await page.fill('#password', 'not-a-real-password');
  await page.click('#signin-submit');

  if (mode === 'enrol') {
    await page.locator('#view-enrol').waitFor({ state: 'visible' });
    const src = await page.getAttribute('#enrol-qr', 'src');
    check(`${label}: enrolment shows an SVG data image`, Boolean(src && src.startsWith('data:image/svg+xml')));
    check(`${label}: enrolment shows the manual key as text`, (await page.textContent('#enrol-secret')) === 'ABC234DEF');
    await page.fill('#totp-enrol', '123456');
    await page.click('#totp-form-enrol button[type=submit]');
  } else {
    await page.locator('#view-totp').waitFor({ state: 'visible' });
    check(`${label}: MFA step shown before the dashboard`, await page.locator('#view-dashboard').isHidden());
    await page.fill('#totp-code', '123456');
    await page.click('#totp-form button[type=submit]');
  }

  await page.locator('#view-dashboard').waitFor({ state: 'visible' });
  check(`${label}: dashboard shown after aal2`, true);
  check(`${label}: signed-in email shown`, (await page.textContent('#whoami')) === 'admin@example.test');

  // The blocked list shows only what is still not built.
  const blocked = await page.textContent('.blocked');
  check(`${label}: only payment entry is listed as not available`, blocked.includes('Payment entry') && !blocked.includes('Audit view') && !blocked.includes('Shop search'));

  if (mode !== 'enrol') {
    await chooseShopAndGrant({ page, label, mode, rpcCalls });
  }

  if (layoutCheck) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${label}: no horizontal page scroll`, overflow <= 0, `overflow ${overflow}px`);
    const shot = path.join(process.env.SMOKE_SHOT_DIR || os.tmpdir(), 'admin-dashboard-375.png');
    await page.screenshot({ path: shot, fullPage: true, scale: 'css' });
    console.log(`INFO  screenshot written to ${shot}`);
  }

  await page.click('#sign-out');
  await page.locator('#view-signin').waitFor({ state: 'visible' });
  check(`${label}: sign-out returns to sign-in and hides the dashboard`, await page.locator('#view-dashboard').isHidden());
  check(`${label}: sign-out clears the chosen shop from the page`, (await page.inputValue('#shop_id')) === '' && (await page.textContent('#audit-list')) === '');

  check(`${label}: all requests went to localhost or the stub only`, [...hosts].every((h) => h.startsWith('127.0.0.1') || h === 'smoke-stub.supabase.co'), [...hosts].join(','));
  // The unknown-outcome run aborts one RPC on purpose. The browser logs that abort as a resource error.
  // Only that one message is expected, and it is reported rather than hidden.
  const expected = mode === 'unknown' ? errors.filter((e) => e.includes('net::ERR_FAILED')) : [];
  const unexpected = errors.filter((e) => !expected.includes(e));
  if (expected.length) console.log(`INFO  ${label}: expected deliberate-abort log (${expected.length})`);
  check(`${label}: no unexpected console or page errors`, unexpected.length === 0, unexpected.join(' | '));
  await context.close();
}

async function main() {
  const server = await startServer();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    await scenarioUnconfigured(browser, origin);
    await scenarioRpc({ browser, origin, mode: 'unknown', layoutCheck: true });
    await scenarioRpc({ browser, origin, mode: 'rejection', layoutCheck: false });
    await scenarioRpc({ browser, origin, mode: 'enrol', layoutCheck: false });
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error('FAIL  smoke test crashed:', error.message);
  process.exitCode = 1;
});
