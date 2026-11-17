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
const EMAIL = 'owner@example.com';
const PASSWORD = 'correct-horse';
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
    user: { id: 'owner-1', email: EMAIL },
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
    if (body.password !== PASSWORD) {
      return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    }
    state.signedIn = true;
    return json(200, session());
  }
  if (url.pathname === '/auth/v1/logout') {
    state.signedIn = false;
    state.logouts += 1;
    return json(204, null);
  }
  if (url.pathname === '/auth/v1/signup') {
    state.signups += 1;
    return json(200, { id: 'owner-2', email: body.email });
  }
  if (url.pathname === '/auth/v1/resend') return json(200, {});
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
    check('registration screen opens', (await page.locator('#auth-form input[name=email]').count()) === 1);
    check('registration asks for a password of at least 8 characters', (await page.locator('#auth-form input[name=password][minlength="8"]').count()) === 1);
    await page.screenshot({ path: shot('register-390.png'), fullPage: true });
    await page.fill('#auth-form input[name=email]', EMAIL);
    await page.fill('#auth-form input[name=password]', PASSWORD);
    await page.click('#auth-form button[type=submit]');
    await page.locator('h1', { hasText: 'Check your email' }).waitFor();
    check('sign-up sends the owner to the verification code screen', state.signups === 1);
    check('verification asks for the one-time code', (await page.locator('#auth-form input[name=token]').count()) === 1);
    await page.screenshot({ path: shot('verify-390.png'), fullPage: true });

    // ----- 2. Sign in and land on Home with five tabs -----
    // Reload: the same address would not redraw the verification screen.
    await page.reload();
    await page.locator('#auth-form').waitFor();
    await page.fill('#auth-form input[name=email]', EMAIL);
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
    check('More shows the account email', (await page.getByText(EMAIL).count()) >= 1);
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
