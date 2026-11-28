// Owner app shell check: what a shop owner sees before and after sign-in.
// Covers the pre-login screens, sign-up, sign-in, the five owner tabs (Home, Orders, Prices,
// Stats, More), back and forward, the printing computer page, sign-out, protected routes,
// touch target sizes, dark mode and screenshots.
//
// Supabase is replaced by an in-memory mock (page.route). This checks the front end only.
// It does not prove that Supabase sends email, that a printer prints, or that a phone
// installs the app. Those are checked elsewhere and reported as not tested here.
//
// Environment:
//   QRQUICK_SHELL_BASE   address of the build to test (default http://127.0.0.1:5173/, the web build)
//   QRQUICK_SHELL_MODE   'web' (default) or 'owner-only' (the Android bundle, mobile/www on port 5175)
//   QRQUICK_SMOKE_OUT    folder for screenshots (default: a temp folder)
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = process.env.QRQUICK_SHELL_BASE || 'http://127.0.0.1:5173/';
const MODE = process.env.QRQUICK_SHELL_MODE || 'web';
const OUT_DIR = process.env.QRQUICK_SMOKE_OUT || path.join(os.tmpdir(), 'qrquick-shell');
fs.mkdirSync(OUT_DIR, { recursive: true });
const shot = (name) => path.join(OUT_DIR, `${MODE}-${name}`);

const SHOP_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const SLUG = 'demo-xerox';
const USERNAME = 'owner_demo';
const TAKEN_USERNAME = 'taken_name';
const PASSWORD = 'Correct-Horse-9';
const POLICY_VERSION = '2026-11-22.1';
const POLICIES = {
  terms: { version: POLICY_VERSION, title: 'Terms and Conditions', effective_at: '2026-11-22T00:00:00Z' },
  privacy: { version: POLICY_VERSION, title: 'Privacy Policy', effective_at: '2026-11-22T00:00:00Z' },
};
const VALID_RECOVERY = 'ABCDEFGHJKMNPQRS';
const RECOVERY_CODES = Array.from({ length: 10 }, (_, i) => `ABCD-EFGH-JKMN-P${String(i).padStart(3, '0')}`);
const TAB_NAMES = ['Home', 'Orders', 'Prices', 'Stats', 'More'];

const state = {
  signedIn: false,
  signups: 0,
  logouts: 0,
  unmocked: [],
  shops: [
    {
      id: SHOP_ID,
      slug: SLUG,
      name: 'Demo Xerox Centre',
      phone: '+91 98765 00001',
      address: 'Main Road, Ranchi',
      is_open: true,
      features: { colour_printing: true },
      payment_qr_path: null,
    },
  ],
  services: [
    { id: 'svc-1', name: 'Document printing', pricing_unit: 'per_side', bw_price_paise: 200, colour_price_paise: 1000, is_active: true },
    { id: 'svc-2', name: 'Old inkjet print', pricing_unit: 'per_side', bw_price_paise: 300, colour_price_paise: null, is_active: false },
  ],
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
};

function session() {
  return {
    access_token: 'owner-token-1',
    refresh_token: 'owner-refresh-1',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: 'owner-1', username: USERNAME },
  };
}

async function handleSupabase(route) {
  const req = route.request();
  const url = new URL(req.url());
  const json = (status, data) =>
    route.fulfill({
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: data === null ? '' : JSON.stringify(data),
    });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
  let body = {};
  try {
    body = JSON.parse(req.postData() || '{}');
  } catch {
    body = {};
  }

  if (url.pathname === '/auth/v1/token') {
    // The owner app only refreshes through Auth now. Sign-in goes through owner-auth below.
    if (url.searchParams.get('grant_type') === 'refresh_token' && state.signedIn) return json(200, session());
    return json(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
  }
  if (url.pathname === '/auth/v1/logout') {
    state.signedIn = false;
    state.logouts += 1;
    return json(204, null);
  }
  if (url.pathname.startsWith('/functions/v1/owner-auth/')) {
    // The owner-auth function: sign-in, sign-up, recovery and the public Terms versions.
    const action = url.pathname.slice('/functions/v1/owner-auth/'.length);
    if (action === 'policies') return json(200, POLICIES);
    if (action === 'signin') {
      if (body.username !== USERNAME || body.password !== PASSWORD) {
        return json(401, { code: 'invalid_credentials', message: 'That username or password is not right.' });
      }
      state.signedIn = true;
      return json(200, { username: USERNAME, session: session() });
    }
    if (action === 'signup') {
      if (body.accept?.terms !== POLICY_VERSION || body.accept?.privacy !== POLICY_VERSION) {
        return json(400, { code: 'terms_required', message: 'Accept the current Terms and Privacy Policy.' });
      }
      if (body.username === TAKEN_USERNAME) {
        return json(409, { code: 'username_taken', message: 'That username is already taken. Choose another.' });
      }
      if (typeof body.password !== 'string' || body.password.length < 10) {
        return json(400, { code: 'weak_password', message: 'Your password does not meet all the rules.' });
      }
      state.signups += 1;
      state.signedIn = true;
      return json(201, { username: body.username, recovery_codes: RECOVERY_CODES, session: session() });
    }
    if (action === 'reset') {
      if (body.recovery_code !== VALID_RECOVERY) {
        return json(401, { code: 'reset_failed', message: 'That username or recovery code is not right.' });
      }
      state.signedIn = true;
      return json(200, { username: USERNAME, recovery_codes: RECOVERY_CODES, session: session() });
    }
    if (action === 'codes/regenerate') {
      if (body.current_password !== PASSWORD) {
        return json(401, { code: 'password_incorrect', message: 'The current password is not right.' });
      }
      return json(200, { username: USERNAME, recovery_codes: RECOVERY_CODES });
    }
    return json(404, { code: 'not_found', message: 'Not found.' });
  }
  if (url.pathname === '/rest/v1/shop_memberships') {
    return json(200, state.signedIn ? state.shops.map((shop) => ({ role: 'owner', shop: { ...shop } })) : []);
  }
  if (url.pathname === '/rest/v1/services') return json(200, state.services);
  if (url.pathname === '/rest/v1/feature_catalog') {
    return json(200, [{ key: 'colour_printing', label: 'Colour printing', affects_orders: true, sort_order: 1 }]);
  }
  if (url.pathname === '/rest/v1/orders') return json(200, []);
  if (url.pathname === '/rest/v1/rpc/owner_print_status') {
    return json(200, { is_owner: true, agents: [], jobs: [] });
  }
  if (url.pathname.startsWith('/rest/v1/rpc/shop_stats') || url.pathname === '/rest/v1/rpc/shop_recent_activity') {
    // The statistics numbers are checked by owner-stats tests. Here the tab only has to open.
    return json(200, []);
  }
  state.unmocked.push(url.pathname);
  return json(404, { code: 'PGRST', message: `not mocked: ${url.pathname}` });
}

async function main() {
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const problems = [];
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push(Boolean(ok));
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? ` (${detail})` : ''}`);
  };
  page.on('pageerror', (err) => problems.push(`page error: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) problems.push(`console: ${msg.text()}`);
  });
  await page.route(/supabase\.co/, handleSupabase);

  const tabbar = page.locator('#owner-tabbar');
  const tab = (key) => page.locator(`#owner-tabbar a[data-tab="${key}"]`);

  try {
    // ----- 1. Before sign-in: no owner navigation, owner pages are protected -----
    await page.goto(`${BASE}#/owner`);
    await page.locator('#auth-form').waitFor();
    check('signed out: the sign-in screen is shown', (await page.locator('h1', { hasText: 'Shop owner sign in' }).count()) === 1);
    check('signed out: the owner tab bar is hidden', (await tabbar.isHidden()) === true);
    check('signed out: the QRquick brand is in the top bar', /QRquick/.test(await page.locator('.topbar .brand').innerText()));
    if (MODE === 'owner-only') {
      const navLinks = await page.locator('.topbar nav a:visible').count();
      check('owner-only build: no customer links in the top bar before sign-in', navLinks === 0, `visible links ${navLinks}`);
    }
    await page.screenshot({ path: shot('signin-390.png'), fullPage: true });

    await page.goto(`${BASE}#/owner/shop/${SLUG}/more`);
    await page.locator('#auth-form').waitFor();
    check('protected: More cannot be opened without a session', (await page.getByRole('button', { name: 'Sign out' }).count()) === 0);
    check('protected: no owner tabs without a session', (await tabbar.isHidden()) === true);

    await page.goto(`${BASE}#/owner`);
    await page.locator('#auth-form').waitFor();
    await page.click('[data-switch="register"]');
    await page.locator('h1', { hasText: 'Create an owner account' }).waitFor();
    check('registration asks for a username, a password and a confirmation', (await page.locator('#auth-form input[name=username]').count()) === 1 && (await page.locator('#auth-form input[name=password]').count()) === 1 && (await page.locator('#auth-form input[name=confirm]').count()) === 1);
    check('registration has no email field', (await page.locator('#auth-form input[name=email]').count()) === 0);
    check('registration shows the six password rules', (await page.locator('[data-rules] li').count()) === 6);
    check('registration links to the Terms and the Privacy Policy', (await page.locator('a[href="#/terms"]').count()) === 1 && (await page.locator('a[href="#/privacy"]').count()) === 1);
    // Back (the browser Back button, which Android Back also uses) returns to sign in, not out of the app.
    await page.goBack();
    await page.locator('h1', { hasText: 'Shop owner sign in' }).waitFor();
    check('Back from registration returns to sign in', (await page.locator('#auth-form input[name=username]').count()) === 1);
    await page.click('[data-switch="register"]');
    await page.locator('h1', { hasText: 'Create an owner account' }).waitFor();
    await page.screenshot({ path: shot('register-390.png'), fullPage: true });

    // Each refusal shows its own message and sends no account request.
    const errorText = async () => (await page.locator('#auth-form [data-error]').innerText()).trim();
    await page.fill('#auth-form input[name=username]', USERNAME);
    await page.fill('#auth-form input[name=password]', 'short');
    await page.fill('#auth-form input[name=confirm]', 'short');
    await page.click('#auth-form button[type=submit]');
    check('a weak password is refused on the page', /does not meet all the rules/.test(await errorText()));
    await page.fill('#auth-form input[name=password]', PASSWORD);
    await page.fill('#auth-form input[name=confirm]', 'Different-Horse-9');
    await page.click('#auth-form button[type=submit]');
    check('a mismatched confirmation is refused', /do not match/.test(await errorText()));
    await page.fill('#auth-form input[name=confirm]', PASSWORD);
    await page.click('#auth-form button[type=submit]');
    check('the terms must be accepted before the account is made', /Accept the Terms/.test(await errorText()));
    check('no account request is sent before the terms are accepted', state.signups === 0);
    await page.check('#auth-form input[name=accept]');
    await page.fill('#auth-form input[name=username]', TAKEN_USERNAME);
    await page.click('#auth-form button[type=submit]');
    await page.locator('#auth-form [data-error]', { hasText: 'already taken' }).waitFor();
    check('a taken username is reported on the page', true);
    check('a taken username makes no account', state.signups === 0);

    await page.fill('#auth-form input[name=username]', USERNAME);
    await page.click('#auth-form button[type=submit]');
    await page.locator('h1', { hasText: 'Save your recovery codes' }).waitFor();
    check('the new account shows ten recovery codes', (await page.locator('.recovery-codes li').count()) === 10);
    check('Continue waits until the codes are confirmed as saved', await page.locator('[data-action="codes-done"]').isDisabled());
    check('no session is kept before the codes are confirmed', (await page.evaluate(() => sessionStorage.getItem('qrquick.owner.session'))) === null);
    await page.screenshot({ path: shot('codes-390.png'), fullPage: true });

    // A reload loses the codes (they are kept nowhere in the browser), so the owner signs in again.
    await page.reload();
    await page.locator('#auth-form').waitFor();
    check('a reload does not show the codes again', (await page.locator('.recovery-codes').count()) === 0);

    // ----- 2. Sign in and land on Home with five tabs -----
    await page.fill('#auth-form input[name=username]', USERNAME);
    await page.fill('#auth-form input[name=password]', PASSWORD);
    await page.click('#auth-form button[type=submit]');
    await tab('home').waitFor();
    check('signed in: five owner tabs in order', JSON.stringify(await tabbar.locator('a span').allTextContents()) === JSON.stringify(TAB_NAMES));
    check('signed in: Home is the current tab', (await tab('home').getAttribute('aria-current')) === 'page');
    check('signed in: Home shows the open-orders and printing summary', (await page.getByText('Needs you now').count()) === 1 && (await page.getByText('Printing computers').count()) === 1);
    await page.screenshot({ path: shot('home-390.png'), fullPage: true });

    // ----- 3. Each tab opens its own screen -----
    await tab('orders').click();
    await page.waitForURL(new RegExp(`#/owner/shop/${SLUG}/orders$`));
    await page.locator('#owner-tabbar a[data-tab="orders"][aria-current="page"]').waitFor();
    check('Orders tab opens the orders route and is marked current', (await tab('orders').getAttribute('aria-current')) === 'page');
    await page.screenshot({ path: shot('orders-390.png'), fullPage: true });

    await tab('prices').click();
    await page.getByRole('heading', { name: 'Services and prices' }).waitFor();
    check('Prices tab lists both services, hidden one included', (await page.locator('table.breakdown tbody tr').count()) === 2);
    check('Prices tab shows the open state read-only', (await page.getByText('Open for orders').count()) === 1);
    await page.screenshot({ path: shot('prices-390.png'), fullPage: true });

    // Passport photos switched on with no passport service: the Prices tab says so, and the quick start fills the form.
    state.shops[0].features.passport_photos = true;
    await page.reload();
    await page.getByRole('heading', { name: 'Services and prices' }).waitFor();
    const banner = await page.locator('p.banner', { hasText: 'Passport photos is switched on' }).count();
    check('Prices tab warns when passport photos is on but has no service', banner === 1);
    await page.click('[data-preset="passport"]');
    const presetName = await page.locator('#service-form input[name="name"]').inputValue();
    const presetUnit = await page.locator('#service-form select[name="pricingUnit"]').inputValue();
    check('the passport quick start fills the name and unit (price left for the owner)', presetName === 'Passport photo sheet' && presetUnit === 'per_copy', `${presetName} / ${presetUnit}`);
    state.shops[0].features.passport_photos = false;

    await tab('stats').click();
    await page.waitForURL(new RegExp(`#/owner/shop/${SLUG}/stats$`));
    await page.locator('#owner-tabbar a[data-tab="stats"][aria-current="page"]').waitFor();
    check('Stats tab opens the statistics route and is marked current', (await tab('stats').getAttribute('aria-current')) === 'page');
    await page.screenshot({ path: shot('stats-390.png'), fullPage: true });

    await tab('more').click();
    await page.getByRole('heading', { name: 'Account' }).waitFor();
    await page.locator('#owner-tabbar a[data-tab="more"][aria-current="page"]').waitFor();
    check('More shows the shop QR code', (await page.getByRole('heading', { name: 'Shop QR code' }).count()) === 1);
    check('More shows the shop details form', (await page.locator('#details-form').count()) === 1);
    check('More shows the username', (await page.getByText(USERNAME, { exact: false }).count()) >= 1);
    check('More links to the recovery codes', (await page.locator('a[href="#/owner/security"]').count()) === 1);
    check('More is the current tab', (await tab('more').getAttribute('aria-current')) === 'page');
    await page.screenshot({ path: shot('more-390.png'), fullPage: true });

    // ----- 4. Back and forward move through the tabs -----
    await page.goBack();
    await page.waitForURL(new RegExp(`#/owner/shop/${SLUG}/stats$`));
    check('back from More returns to Stats', true);
    await page.goForward();
    await page.waitForURL(new RegExp(`#/owner/shop/${SLUG}/more$`));
    check('forward returns to More', true);

    // ----- 5. Printing computer page, reached from More -----
    await page.click(`a[href="#/owner/shop/${SLUG}/printer"]`);
    // The More page also has a "Printing computer" heading, so wait for an element only the printer page renders.
    await page.locator('[data-action="refresh-printer"]').waitFor();
    check('printing page explains the computer is needed', (await page.getByText('No computer is connected for printing yet.').count()) === 1);
    check('printing page offers pairing to the owner', (await page.locator('[data-print-action="pair"]').count()) === 1);
    await page.screenshot({ path: shot('printer-390.png'), fullPage: true });
    await page.click('a:has-text("← More")');
    await page.getByRole('heading', { name: 'Account' }).waitFor();
    check('the printing page links back to More', true);

    // ----- 6. Layout on a phone: 44px touch targets, no sideways scrolling -----
    const boxes = await tabbar.locator('a').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    check('tab bar targets are at least 44px tall', boxes.length === 5 && boxes.every((h) => h >= 44), JSON.stringify(boxes));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('no sideways scrolling at 390px wide', overflow <= 0, `overflow ${overflow}px`);
    check('the tab bar sits at the bottom of the screen', await tabbar.evaluate((el) => Math.round(el.getBoundingClientRect().bottom) === window.innerHeight));

    // ----- 7. Dark mode follows the system and keeps the tab bar readable -----
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await tab('more').waitFor();
    const dark = await page.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      bar: getComputedStyle(document.querySelector('#owner-tabbar')).backgroundColor,
    }));
    // Dark theme is black surfaces (not blue-navy): page #000, cards and tab bar #0b0b0b.
    check('dark system theme: page background is black', dark.body === 'rgb(0, 0, 0)', JSON.stringify(dark));
    check('dark system theme: tab bar uses the card colour', dark.bar === 'rgb(11, 11, 11)', JSON.stringify(dark));
    await page.screenshot({ path: shot('more-dark-390.png'), fullPage: true });
    await page.emulateMedia({ colorScheme: 'light' });

    // ----- 8. Sign out returns to the signed-out experience; routes stay protected -----
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.locator('#auth-form').waitFor();
    check('sign out: the sign-in screen returns', (await page.locator('h1', { hasText: 'Shop owner sign in' }).count()) === 1);
    check('sign out: the tab bar is hidden', (await tabbar.isHidden()) === true);
    check('sign out: the server was told', state.logouts === 1);
    await page.goto(`${BASE}#/owner/shop/${SLUG}/orders`);
    await page.locator('#auth-form').waitFor();
    check('after sign out, Orders needs a sign-in again', (await tabbar.isHidden()) === true);
    await page.goto(`${BASE}#/owner/shop/${SLUG}/more`);
    await page.locator('#auth-form').waitFor();
    check('after sign out, More needs a sign-in again', (await page.getByRole('button', { name: 'Sign out' }).count()) === 0);
  } catch (err) {
    problems.push(`run stopped: ${err.message.split('\n')[0]}`);
  }

  check('no page errors or console errors', problems.length === 0, problems.join(' | '));
  const unexpected = state.unmocked.filter((p) => !/shop_stats|recent_activity/.test(p));
  check('every Supabase call was expected by the test', unexpected.length === 0, unexpected.join(', '));
  await browser.close();

  const passed = results.filter(Boolean).length;
  console.log(`${passed} of ${results.length} checks passed.`);
  if (problems.length) console.log(`problems: ${problems.join(' | ')}`);
  process.exitCode = passed === results.length ? 0 : 1;
}

main();
