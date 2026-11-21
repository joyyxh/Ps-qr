// Owner app against the qrquick-staging Supabase project. The backend is REAL: nothing here mocks
// Supabase. It runs only where STAGING_SUPABASE_URL and STAGING_PUBLISHABLE_KEY are set (CI sets them).
//
// Safety rules for this script:
//   - Only the publishable key is accepted (sb_publishable_...). Service-role and legacy keys are refused.
//   - It never confirms an email address, never edits a database row, and never prints a password.
//   - It creates an account only when STAGING_SIGNUP_EMAIL and STAGING_SIGNUP_PASSWORD are both set,
//     and it signs in to a dashboard only when STAGING_OWNER_EMAIL and STAGING_OWNER_PASSWORD are both set.
//
// Environment:
//   STAGING_SUPABASE_URL      https://<staging-ref>.supabase.co
//   STAGING_PUBLISHABLE_KEY   sb_publishable_...
//   STAGING_APP_URL           where web/ is served, for example http://127.0.0.1:5175/
//   PLAYWRIGHT_MODULE         path to the playwright package (default: playwright)
//   QRQUICK_SMOKE_OUT         folder for screenshots and the result file
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const OUT = process.env.QRQUICK_SMOKE_OUT || path.join(os.tmpdir(), 'qrquick-staging-smoke');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.STAGING_APP_URL || 'http://127.0.0.1:5175/';
const SUPABASE_URL = process.env.STAGING_SUPABASE_URL || '';
const PUBLISHABLE_KEY = process.env.STAGING_PUBLISHABLE_KEY || '';
const SIGNUP_EMAIL = process.env.STAGING_SIGNUP_EMAIL || '';
const SIGNUP_PASSWORD = process.env.STAGING_SIGNUP_PASSWORD || '';
const OWNER_EMAIL = process.env.STAGING_OWNER_EMAIL || '';
const OWNER_PASSWORD = process.env.STAGING_OWNER_PASSWORD || '';

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`);
};
const info = (name, detail) => {
  results.push({ name, ok: true, info: true, detail });
  console.log(`INFO ${name} :: ${detail}`);
};

const COLUMN_ERROR = /does not exist|is not a function|TypeError|undefined is not|Cannot read/i;

async function main() {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    console.error('set STAGING_SUPABASE_URL and STAGING_PUBLISHABLE_KEY');
    process.exit(2);
  }
  if (!PUBLISHABLE_KEY.startsWith('sb_publishable_')) {
    console.error('refused: STAGING_PUBLISHABLE_KEY must be a publishable key (sb_publishable_...)');
    process.exit(2);
  }
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(SUPABASE_URL)) {
    console.error('refused: STAGING_SUPABASE_URL must be https://<ref>.supabase.co');
    process.exit(2);
  }

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // Replace web/config.js for this run only, so no staging value is committed to the repository.
  const configJs = `window.PRINTNEST_CONFIG = ${JSON.stringify({
    supabaseUrl: SUPABASE_URL,
    publishableKey: PUBLISHABLE_KEY,
    publicBaseUrl: BASE,
    authRedirectUrl: BASE,
    ownerApp: true,
  })};`;
  await context.route('**/config.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: configJs })
  );

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  try {
    // 1. The sign-in screen loads from the staging configuration.
    await page.goto(BASE + '#/owner', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#auth-form', { timeout: 30000 });
    const heading = (await page.textContent('h1')) || '';
    record('owner sign-in screen loads with the staging configuration', /Shop owner sign in/i.test(heading), heading.trim());
    await page.screenshot({ path: path.join(OUT, '01-signin.png'), fullPage: true });

    // 2. An unknown account is refused with a readable message, not a database error.
    await page.fill('#auth-form input[name=email]', 'no-such-owner.qrquick@example.com');
    await page.fill('#auth-form input[name=password]', 'WrongPassword-2026');
    await page.click('#auth-form button[type=submit]');
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-error]');
      return el && el.textContent.trim().length > 0;
    }, null, { timeout: 30000 });
    const refusal = ((await page.textContent('[data-error]')) || '').trim();
    record('unknown owner is refused with a readable message', refusal.length > 0 && !COLUMN_ERROR.test(refusal), refusal);
    await page.screenshot({ path: path.join(OUT, '02-refused.png'), fullPage: true });

    // 3. Registration: the code screen appears, or the restricted-recipient message shows.
    if (SIGNUP_EMAIL && SIGNUP_PASSWORD) {
      // A query string makes each load a full navigation, so the sign-in state from step 2 is not reused.
      await page.goto(BASE + '?run=register#/owner', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-switch=register]', { timeout: 30000 });
      await page.click('[data-switch=register]');
      await page.waitForSelector('#auth-form input[name=password][minlength]', { timeout: 30000 });
      await page.fill('#auth-form input[name=email]', SIGNUP_EMAIL);
      await page.fill('#auth-form input[name=password]', SIGNUP_PASSWORD);
      await page.click('#auth-form button[type=submit]');
      await page.waitForFunction(() => {
        if (document.querySelector('[data-action="resend"]')) return true;
        const el = document.querySelector('[data-error]');
        return el && el.textContent.trim().length > 0;
      }, null, { timeout: 60000 });
      const codeScreen = (await page.$('[data-action="resend"]')) !== null;
      const message = codeScreen ? 'verification code screen shown' : ((await page.textContent('[data-error]')) || '').trim();
      if (codeScreen) {
        record('registration shows the code screen', true, message);
      } else {
        // The built-in Supabase email service sends to the project's team addresses only. This message
        // is the real outcome for any other address, and it is reported, not hidden.
        info('registration outcome for the test address', message);
        record('registration gives a clear outcome (no database error)', message.length > 0 && !COLUMN_ERROR.test(message), message);
      }
      await page.screenshot({ path: path.join(OUT, '03-register.png'), fullPage: true });
    } else {
      info('registration', 'skipped: STAGING_SIGNUP_EMAIL and STAGING_SIGNUP_PASSWORD are not set');
    }

    // 4. A verified owner signs in and every dashboard tab renders.
    if (OWNER_EMAIL && OWNER_PASSWORD) {
      await page.goto(BASE + '?run=owner#/owner', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#auth-form', { timeout: 30000 });
      await page.fill('#auth-form input[name=email]', OWNER_EMAIL);
      await page.fill('#auth-form input[name=password]', OWNER_PASSWORD);
      await page.click('#auth-form button[type=submit]');
      await page.waitForSelector('[data-tab]', { timeout: 60000 });
      const tabs = await page.$$eval('[data-tab]', (els) => [...new Set(els.map((e) => e.dataset.tab))]);
      record('owner dashboard opens after sign-in', tabs.length > 0, tabs.join(', '));
      await page.screenshot({ path: path.join(OUT, '04-dashboard.png'), fullPage: true });
      for (const tab of tabs) {
        await page.click(`[data-tab="${tab}"]`);
        await page.waitForTimeout(1000);
        const body = (await page.innerText('body')).replace(/\s+/g, ' ');
        const bad = body.match(COLUMN_ERROR);
        record(`dashboard tab "${tab}" renders without a data error`, !bad, bad ? body.slice(0, 160) : '');
        await page.screenshot({ path: path.join(OUT, `05-tab-${tab}.png`), fullPage: true });
      }
    } else {
      info('owner dashboard', 'skipped: STAGING_OWNER_EMAIL and STAGING_OWNER_PASSWORD are not set');
    }

    record('no uncaught page errors during the run', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  } catch (err) {
    record('the smoke run completed', false, String(err && err.message ? err.message : err).slice(0, 300));
    await page.screenshot({ path: path.join(OUT, 'zz-failure.png'), fullPage: true }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok && !r.info);
  console.log(`== ${results.length - failed.length} passed, ${failed.length} failed (results: ${path.join(OUT, 'results.json')})`);
  process.exit(failed.length ? 1 : 0);
}

main();
