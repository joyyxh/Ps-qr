// Owner account check, in the browser: the public Terms and Privacy pages, sign-up with a username,
// the one-time recovery codes, the Security page, sign-out, a reset with a recovery code, and the
// sign-in that follows. Email is not used anywhere in this flow.
//
// Supabase and the owner-auth function are replaced by an in-memory mock (page.route). This checks
// what the screens do with each answer. It does not prove that the server enforces the rules (the
// unit tests and the staging checks do that), and it does not test a real device.
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

const SLUG = 'demo-xerox';
const USERNAME = 'new_owner';
const TAKEN = 'taken_name';
const PASSWORD = 'Correct-Horse-9';
const NEW_PASSWORD = 'Fresh-Horse-42';
const POLICY_VERSION = '2026-11-22.1';
const POLICIES = {
  terms: { version: POLICY_VERSION, title: 'Terms and Conditions', effective_at: '2026-11-22T00:00:00Z' },
  privacy: { version: POLICY_VERSION, title: 'Privacy Policy', effective_at: '2026-11-22T00:00:00Z' },
};
// Recovery codes use the 31-symbol alphabet (no I, L, O, 0 or 1). The client normalises what is typed,
// so a code is compared without its dashes. VALID_RECOVERY is the normalised form of AAAA-BBBB-CCCC-DDDD.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const VALID_RECOVERY = 'AAAABBBBCCCCDDDD';
const codesFrom = (offset) =>
  Array.from({ length: 10 }, (_, i) => {
    const chars = Array.from({ length: 16 }, (_, k) => ALPHABET[(i * 7 + k * 5 + offset) % ALPHABET.length]).join('');
    return chars.match(/.{4}/g).join('-');
  });
const SHOP = {
  id: 'bbbbbbbb-0000-0000-0000-000000000001',
  slug: SLUG,
  name: 'Demo Xerox Centre',
  phone: '+91 98765 00001',
  address: 'Main Road, Ranchi',
  is_open: true,
  features: { colour_printing: true },
  payment_qr_path: null,
};
const TAB_NAMES = ['Home', 'Orders', 'Prices', 'Stats', 'More'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
};

// What the mock account looks like. The mock keeps the password the owner set, so a reset changes what sign-in accepts.
const state = {
  username: null,
  password: null,
  signedIn: false,
  codes: [],
  signups: 0,
  resets: 0,
  regenerations: 0,
  logouts: 0,
  unmocked: [],
};

function session() {
  return {
    access_token: `reg-token-${Date.now()}`,
    refresh_token: 'reg-refresh-1',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: 'owner-reg-1', username: state.username },
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
    if (url.searchParams.get('grant_type') === 'refresh_token' && state.signedIn) return json(200, session());
    return json(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
  }
  if (url.pathname === '/auth/v1/logout') {
    state.signedIn = false;
    state.logouts += 1;
    return json(204, null);
  }
  if (url.pathname.startsWith('/functions/v1/owner-auth/')) {
    const action = url.pathname.slice('/functions/v1/owner-auth/'.length);
    if (action === 'policies') return json(200, POLICIES);
    if (action === 'signup') {
      if (body.accept?.terms !== POLICY_VERSION || body.accept?.privacy !== POLICY_VERSION) {
        return json(400, { code: 'terms_required', message: 'Accept the current Terms and Privacy Policy.' });
      }
      if (body.username === TAKEN) {
        return json(409, { code: 'username_taken', message: 'That username is already taken. Choose another.' });
      }
      if (typeof body.password !== 'string' || body.password.length < 10) {
        return json(400, { code: 'weak_password', message: 'Your password does not meet all the rules.' });
      }
      state.signups += 1;
      state.username = body.username;
      state.password = body.password;
      state.signedIn = true;
      state.codes = codesFrom(0);
      return json(201, { username: body.username, recovery_codes: state.codes, session: session() });
    }
    if (action === 'signin') {
      if (body.username !== state.username || body.password !== state.password) {
        return json(401, { code: 'invalid_credentials', message: 'That username or password is not right.' });
      }
      state.signedIn = true;
      return json(200, { username: state.username, session: session() });
    }
    if (action === 'reset') {
      if (body.username !== state.username || body.recovery_code !== VALID_RECOVERY) {
        return json(401, { code: 'reset_failed', message: 'That username or recovery code is not right.' });
      }
      state.resets += 1;
      state.password = body.new_password;
      state.signedIn = true;
      state.codes = codesFrom(3);
      return json(200, { username: state.username, recovery_codes: state.codes, session: session() });
    }
    if (action === 'codes/regenerate') {
      if (body.current_password !== state.password) {
        return json(401, { code: 'password_incorrect', message: 'The current password is not right.' });
      }
      state.regenerations += 1;
      state.codes = codesFrom(5);
      return json(200, { username: state.username, recovery_codes: state.codes });
    }
    return json(404, { code: 'not_found', message: 'Not found.' });
  }
  if (url.pathname === '/rest/v1/shop_memberships') {
    return json(200, state.signedIn ? [{ role: 'owner', shop: { ...SHOP } }] : []);
  }
  if (url.pathname === '/rest/v1/services' || url.pathname === '/rest/v1/orders') return json(200, []);
  if (url.pathname === '/rest/v1/feature_catalog') return json(200, []);
  if (url.pathname === '/rest/v1/rpc/owner_print_status') return json(200, { is_owner: true, agents: [], jobs: [] });
  if (url.pathname.startsWith('/rest/v1/rpc/shop_stats') || url.pathname === '/rest/v1/rpc/shop_recent_activity') {
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
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const results = [];
  const problems = [];
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
  const heading = (text) => page.locator('h1', { hasText: text });
  const codeItems = () => page.locator('.recovery-codes li').count();
  const authError = async () => (await page.locator('#auth-form [data-error]').innerText()).trim();
  // Every value the browser holds, so a test can prove a code or a session was not kept.
  const browserStorage = () =>
    page.evaluate(() => {
      const out = [];
      for (const store of [localStorage, sessionStorage]) {
        for (let i = 0; i < store.length; i += 1) out.push(`${store.key(i)}=${store.getItem(store.key(i))}`);
      }
      return out.join('\n');
    });

  try {
    // ----- 1. Public pages, and protected pages without a session -----
    await page.goto(`${BASE}#/terms`);
    await heading('Terms and Conditions').waitFor();
    check('the Terms open without signing in', (await page.locator('#auth-form').count()) === 0);
    check('the Terms are marked as a draft', (await page.getByText('Draft for review', { exact: false }).count()) === 1);
    await page.goto(`${BASE}#/privacy`);
    await heading('Privacy Policy').waitFor();
    check('the Privacy Policy opens without signing in', true);
    check(
      'the Privacy Policy says customers give no name, phone number or address',
      (await page.getByText('do not ask customers for a name, phone number or address', { exact: false }).count()) === 1
    );
    check('the owner tab bar is hidden on the public pages', (await tabbar.isHidden()) === true);

    await page.goto(`${BASE}#/owner/shop/${SLUG}/more`);
    await page.locator('#auth-form').waitFor();
    check('protected: More cannot be opened without a session', (await page.getByRole('button', { name: 'Sign out' }).count()) === 0);

    await page.goto(`${BASE}#/owner/verify`);
    await page.locator('#auth-form').waitFor();
    check('the retired code-screen address goes to sign in', (await page.evaluate(() => location.hash)) === '#/owner');
    await page.goto(`${BASE}#/owner/reset`);
    await page.locator('#auth-form').waitFor();
    check('the retired reset-screen address goes to sign in', (await page.evaluate(() => location.hash)) === '#/owner');

    // ----- 2. Sign-up: terms first, a taken username, then the one-time codes -----
    await page.click('[data-switch="register"]');
    await heading('Create an owner account').waitFor();
    check(
      'sign-up links to the Terms and the Privacy Policy',
      (await page.locator('a[href="#/terms"]').count()) === 1 && (await page.locator('a[href="#/privacy"]').count()) === 1
    );
    check('sign-up has no email field', (await page.locator('#auth-form input[name=email]').count()) === 0);
    await page.fill('#auth-form input[name=username]', USERNAME);
    await page.fill('#auth-form input[name=password]', PASSWORD);
    await page.fill('#auth-form input[name=confirm]', PASSWORD);
    const rulesMet = await page.locator('[data-rules] li.met').count();
    check('the password checklist marks all six rules as met', rulesMet === 6, `${rulesMet} of 6`);
    await page.click('#auth-form button[type=submit]');
    check('the terms must be accepted before the account is made', /Accept the Terms/.test(await authError()));
    check('no account request is sent before the terms are accepted', state.signups === 0);

    await page.check('#auth-form input[name=accept]');
    await page.fill('#auth-form input[name=username]', TAKEN);
    await page.click('#auth-form button[type=submit]');
    await page.locator('#auth-form [data-error]', { hasText: 'already taken' }).waitFor();
    check('a taken username is refused and makes no account', state.signups === 0);
    check('the passwords stay in the boxes after a refusal', (await page.locator('#auth-form input[name=password]').inputValue()) === PASSWORD);

    await page.fill('#auth-form input[name=username]', USERNAME);
    await page.click('#auth-form button[type=submit]');
    await heading('Save your recovery codes').waitFor();
    check('the new account shows ten recovery codes', (await codeItems()) === 10);
    check('Continue waits until the codes are confirmed as saved', await page.locator('[data-action="codes-done"]').isDisabled());
    const beforeConfirm = await browserStorage();
    check(
      'no session and no recovery code is kept in the browser before Continue',
      !beforeConfirm.includes('qrquick.owner.session') && !beforeConfirm.includes(codesFrom(0)[0])
    );
    await page.screenshot({ path: shot('codes-390.png'), fullPage: true });

    await page.check('[data-saved]');
    check('Continue is available once the codes are confirmed', await page.locator('[data-action="codes-done"]').isEnabled());
    await page.click('[data-action="codes-done"]');
    await tab('home').waitFor();
    const tabNames = await tabbar.locator('a span').allTextContents();
    check('Continue opens the owner home with the five tabs', JSON.stringify(tabNames) === JSON.stringify(TAB_NAMES), tabNames.join(', '));
    const stored = await page.evaluate(() => sessionStorage.getItem('qrquick.owner.session'));
    check('the session keeps the username and holds no email', stored !== null && stored.includes(`"username":"${USERNAME}"`) && !stored.includes('@'));

    // ----- 3. Making new codes from the Security page: a wrong password, then the right one -----
    await tab('more').click();
    await page.getByRole('heading', { name: 'Account' }).waitFor();
    await page.click('a[href="#/owner/security"]');
    await heading('Recovery codes').waitFor();
    await page.fill('#codes-form input[name=current]', 'Wrong-Horse-99');
    await page.click('#codes-form button[type=submit]');
    await page.locator('#codes-form [data-error]', { hasText: 'The current password is not right.' }).waitFor();
    check('making new codes needs the right current password', state.regenerations === 0);
    await page.fill('#codes-form input[name=current]', PASSWORD);
    await page.click('#codes-form button[type=submit]');
    await heading('Save your recovery codes').waitFor();
    check('new codes are shown once, ten of them', (await codeItems()) === 10);
    check(
      'the new codes say the old ones no longer work',
      (await page.getByText('The codes you had before no longer work', { exact: false }).count()) === 1
    );
    await page.check('[data-saved]');
    await page.click('[data-action="codes-done"]');
    await heading('Recovery codes').waitFor();
    check(
      'after Continue the Security page says the new codes are saved',
      (await page.locator('[data-notice]', { hasText: 'New recovery codes are saved' }).count()) === 1
    );
    check('the codes are not shown again on the Security page', (await codeItems()) === 0);

    // ----- 4. Sign out -----
    await tab('more').click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.locator('#auth-form').waitFor();
    check('sign out returns to the sign-in screen', (await heading('Shop owner sign in').count()) === 1);
    check('sign out is recorded by the server', state.logouts === 1);

    // ----- 5. Forgot password: a recovery code and a new password -----
    await page.click('[data-switch="forgot"]');
    await heading('Reset your password').waitFor();
    await page.fill('#auth-form input[name=username]', USERNAME);
    await page.fill('#auth-form input[name=code]', 'XYZ');
    await page.fill('#auth-form input[name=password]', NEW_PASSWORD);
    await page.fill('#auth-form input[name=confirm]', NEW_PASSWORD);
    await page.click('#auth-form button[type=submit]');
    check('a malformed recovery code is refused before the account is checked', /Enter a recovery code/.test(await authError()));
    check('a malformed code makes no reset request', state.resets === 0);

    await page.fill('#auth-form input[name=code]', 'ZZZZ-ZZZZ-ZZZZ-ZZZZ');
    await page.click('#auth-form button[type=submit]');
    await page.locator('#auth-form [data-error]', { hasText: 'That username or recovery code is not right.' }).waitFor();
    check('a wrong recovery code gets the generic message and resets nothing', state.resets === 0);

    await page.fill('#auth-form input[name=code]', 'AAAA-BBBB-CCCC-DDDD');
    await page.fill('#auth-form input[name=password]', 'short');
    await page.fill('#auth-form input[name=confirm]', 'short');
    await page.click('#auth-form button[type=submit]');
    check('a weak new password is refused on the page', /does not meet all the rules/.test(await authError()));
    check('a weak new password makes no reset request', state.resets === 0);

    await page.fill('#auth-form input[name=password]', NEW_PASSWORD);
    await page.fill('#auth-form input[name=confirm]', NEW_PASSWORD);
    await page.click('#auth-form button[type=submit]');
    await heading('Save your recovery codes').waitFor();
    check('a valid code and a new password reset the account', state.resets === 1);
    check(
      'the reset says the password changed and shows new codes',
      (await page.getByText('Your password has been changed', { exact: false }).count()) === 1 && (await codeItems()) === 10
    );
    await page.screenshot({ path: shot('reset-codes-390.png'), fullPage: true });
    await page.check('[data-saved]');
    await page.click('[data-action="codes-done"]');
    await tab('home').waitFor();
    check('after the reset the owner is signed in', true);

    // ----- 6. Sign in again: the old password is refused, the new one works -----
    await tab('more').click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.locator('#auth-form').waitFor();
    check('the second sign out is recorded by the server', state.logouts === 2);

    await page.fill('#auth-form input[name=username]', USERNAME);
    await page.fill('#auth-form input[name=password]', PASSWORD);
    await page.click('#auth-form button[type=submit]');
    await page.locator('#auth-form [data-error]', { hasText: 'That username or password is not right.' }).waitFor();
    check('the old password is refused after the reset', true);
    check('a refused sign-in clears the password box', (await page.locator('#auth-form input[name=password]').inputValue()) === '');
    check('a refused sign-in keeps no session', (await page.evaluate(() => sessionStorage.getItem('qrquick.owner.session'))) === null);

    await page.fill('#auth-form input[name=username]', USERNAME);
    await page.fill('#auth-form input[name=password]', NEW_PASSWORD);
    await page.click('#auth-form button[type=submit]');
    await tab('home').waitFor();
    check('the new password signs the owner in', true);

    check('one account, one reset and one new set of codes were made', state.signups === 1 && state.resets === 1 && state.regenerations === 1);
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
