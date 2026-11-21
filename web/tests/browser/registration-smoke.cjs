// Owner registration check: a new owner registers, enters the code, and reaches the app.
// A wrong code, a refused address and an email limit each show their own message, and a reload
// on the code screen keeps the owner's place. The checks use the same mock as the other browser
// checks (page.route), so they show what the screens do with each answer from Supabase. They do
// not prove that any email arrives: that is the owner's real test, recorded in docs/OWNER_EMAIL_VERIFICATION.md.
//
// Environment:
//   QRQUICK_SHELL_BASE   address of the web build (default http://127.0.0.1:5173/)
//   QRQUICK_SMOKE_OUT    folder for screenshots (default: a temp folder)
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = process.env.QRQUICK_SHELL_BASE || 'http://127.0.0.1:5173/';
const OUT_DIR = process.env.QRQUICK_SMOKE_OUT || path.join(os.tmpdir(), 'qrquick-registration');
fs.mkdirSync(OUT_DIR, { recursive: true });
const shot = (name) => path.join(OUT_DIR, `registration-${name}`);

const EMAIL = 'new-owner@example.com';
const OTHER_EMAIL = 'second-owner@example.com';
const PASSWORD = 'correct-horse';
const CODE = '123456';
const PENDING_KEY = 'qrquick.owner.pendingSignup';
const SESSION_KEY = 'qrquick.owner.session';

// The messages the owner must see (web/src/logic.js).
const WRONG_CODE = 'That code is not right or has expired';
const NOT_AUTHORIZED = 'QRquick cannot send the code to this address yet';
const EMAIL_LIMIT = 'Wait about an hour';

const SESSION = {
  access_token: 'reg-access-1',
  refresh_token: 'reg-refresh-1',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'owner-new', email: EMAIL },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
};

const state = {
  signups: 0,
  verifyCalls: 0,
  resendCalls: 0,
  resendReply: null, // null: the code is sent. Otherwise { status, body } is returned to the app.
  passwordSaved: false,
  unmocked: [],
};

function reply(status, body) {
  return { status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: body === null ? '' : JSON.stringify(body) };
}

async function handleSupabase(route) {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
  let body = {};
  try {
    body = request.postDataJSON() ?? {};
  } catch {
    body = {};
  }

  if (url.pathname === '/auth/v1/signup') {
    state.signups += 1;
    return route.fulfill(reply(200, { id: 'owner-new', email: body.email, identities: [] }));
  }
  if (url.pathname === '/auth/v1/verify') {
    state.verifyCalls += 1;
    if (body.type !== 'signup' || body.token !== CODE) {
      return route.fulfill(reply(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }));
    }
    return route.fulfill(reply(200, SESSION));
  }
  if (url.pathname === '/auth/v1/resend') {
    state.resendCalls += 1;
    if (state.resendReply) return route.fulfill(reply(state.resendReply.status, state.resendReply.body));
    return route.fulfill(reply(200, {}));
  }
  if (url.pathname === '/auth/v1/user' && request.method() === 'PUT') {
    state.passwordSaved = body.password === PASSWORD;
    return route.fulfill(reply(200, SESSION.user));
  }
  if (url.pathname === '/auth/v1/token') {
    return route.fulfill(reply(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }));
  }
  if (url.pathname === '/rest/v1/shop_memberships') return route.fulfill(reply(200, []));

  state.unmocked.push(url.pathname);
  return route.fulfill(reply(404, { code: 'PGRST', message: `not mocked: ${url.pathname}` }));
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
  await context.route(/supabase\.co/, handleSupabase);
  const problems = [];
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push(Boolean(ok));
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? ` (${detail})` : ''}`);
  };
  const watch = (page) => {
    page.on('pageerror', (err) => problems.push(`page error: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) problems.push(`console: ${msg.text()}`);
    });
  };
  const storedText = (page) => page.evaluate(() => JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage }));
  const errorText = (page) => page.locator('#auth-form [data-error]').innerText();

  try {
    // ----- 1. Register, read the code screen, then a wrong code -----
    const page = await context.newPage();
    watch(page);
    await page.goto(`${BASE}#/owner`);
    await page.locator('#auth-form').waitFor();
    await page.click('[data-switch="register"]');
    await page.locator('h1', { hasText: 'Create an owner account' }).waitFor();
    await page.fill('#auth-form input[name=email]', EMAIL);
    await page.fill('#auth-form input[name=password]', PASSWORD);
    await page.click('#auth-form button[type=submit]');
    await page.locator('h1', { hasText: 'Check your email' }).waitFor();
    check('registration sends the owner to the code screen', state.signups === 1);
    check('the code screen names the address', (await page.getByText(EMAIL).count()) >= 1);
    check('the password is not kept in browser storage', !(await storedText(page)).includes(PASSWORD));

    await page.fill('#auth-form input[name=token]', '000000');
    await page.click('#auth-form button[type=submit]');
    await page.locator('#auth-form [data-error]', { hasText: WRONG_CODE }).waitFor();
    check('a wrong code shows the code message and stays on the code screen', (await errorText(page)).includes(WRONG_CODE) && (await page.locator('#auth-form input[name=token]').count()) === 1);
    await page.screenshot({ path: shot('wrong-code-390.png'), fullPage: true });

    // ----- 2. The right code opens the account; the password chosen at registration is saved -----
    await page.fill('#auth-form input[name=token]', CODE);
    await page.click('#auth-form button[type=submit]');
    await page.waitForFunction((key) => sessionStorage.getItem(key) !== null, SESSION_KEY);
    check('the right code signs the owner in', (await page.locator('h1', { hasText: 'Check your email' }).count()) === 0);
    check('the password chosen at registration is saved to the account', state.passwordSaved === true);
    check('the session is kept for this tab', (await storedText(page)).includes('reg-access-1'));
    check('the registration waiting for its code is cleared', !(await storedText(page)).includes(PENDING_KEY));
    await page.close();

    // ----- 3. A reload on the code screen keeps the place; a refused address and an email limit each say what to do -----
    const second = await context.newPage();
    watch(second);
    await second.goto(`${BASE}#/owner`);
    await second.locator('#auth-form').waitFor();
    await second.click('[data-switch="register"]');
    await second.locator('h1', { hasText: 'Create an owner account' }).waitFor();
    await second.fill('#auth-form input[name=email]', OTHER_EMAIL);
    await second.fill('#auth-form input[name=password]', PASSWORD);
    await second.click('#auth-form button[type=submit]');
    await second.locator('h1', { hasText: 'Check your email' }).waitFor();
    // Pretend the code went out two minutes ago, so the resend button is available after the reload.
    await second.evaluate(
      ({ key, email }) => sessionStorage.setItem(key, JSON.stringify({ email, sentAtMs: Date.now() - 120_000 })),
      { key: PENDING_KEY, email: OTHER_EMAIL }
    );
    await second.reload();
    await second.locator('h1', { hasText: 'Check your email' }).waitFor();
    check('a reload keeps the code screen and the address', (await second.getByText(OTHER_EMAIL).count()) >= 1);

    state.resendReply = {
      status: 400,
      body: { code: 400, error_code: 'email_address_not_authorized', msg: `Email address "${OTHER_EMAIL}" is not authorized` },
    };
    await second.click('[data-action="resend"]');
    await second.locator('#auth-form [data-error]', { hasText: NOT_AUTHORIZED }).waitFor();
    check('an address the built-in sender refuses gets the setup message, not a code wait', (await errorText(second)).includes(NOT_AUTHORIZED));
    await second.screenshot({ path: shot('not-authorized-390.png'), fullPage: true });

    state.resendReply = { status: 429, body: { code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' } };
    await second.click('[data-action="resend"]');
    await second.locator('#auth-form [data-error]', { hasText: EMAIL_LIMIT }).waitFor();
    check('the email limit says to wait about an hour', (await errorText(second)).includes(EMAIL_LIMIT));

    await second.close();
  } catch (err) {
    problems.push(`run stopped: ${err.message.split('\n')[0]}`);
  }

  check('no page errors or console errors', problems.length === 0, problems.join(' | '));
  check('every Supabase call was expected by the test', state.unmocked.length === 0, state.unmocked.join(', '));
  await browser.close();

  const passed = results.filter(Boolean).length;
  console.log(`${passed} of ${results.length} checks passed.`);
  if (problems.length) console.log(`problems: ${problems.join(' | ')}`);
  process.exitCode = passed === results.length ? 0 : 1;
}

main();
