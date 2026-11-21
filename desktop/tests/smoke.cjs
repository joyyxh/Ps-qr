// Desktop smoke test for the QRquick owner app (Windows and Linux). It starts the built executable with
// Playwright's Electron support and checks what the app itself shows. It does not sign in to any account.
//
// Environment:
//   PLAYWRIGHT_MODULE     path to the playwright package (CI installs playwright@1.63.0 outside the repository)
//   QRQUICK_EXECUTABLE    the built executable: the unpacked Linux binary, or the installed QRquick.exe
//   QRQUICK_MODE          production (default): the shipped build. Checks the sign-in screen and its configuration.
//                         staging-probe: the TEST-ONLY staging copy (QRQUICK_TEST_WEB_DIR). Submits one wrong
//                         password for a made-up address, to check the readable refusal.
//   QRQUICK_TEST_WEB_DIR  folder of the test-only copy (staging-probe mode only)
//   QRQUICK_SMOKE_OUT     folder for screenshots and results.json
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const MODE = process.env.QRQUICK_MODE || 'production';
const EXECUTABLE = process.env.QRQUICK_EXECUTABLE || '';
const OUT = process.env.QRQUICK_SMOKE_OUT || path.join(os.tmpdir(), 'qrquick-desktop-smoke');
const PRODUCTION_REF = 'qvnwqrevgyootaaunrto';
const STAGING_REF = 'nbzojqlqkrydcjtogwrb';
const PRODUCTION_PUBLIC_URL = 'https://joyyxh.github.io/Ps-qr/';
const COLUMN_ERROR = /does not exist|is not a function|TypeError|undefined is not|Cannot read/i;

fs.mkdirSync(OUT, { recursive: true });
const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`);
};

async function main() {
  if (!EXECUTABLE || !fs.existsSync(EXECUTABLE)) {
    console.error(`QRQUICK_EXECUTABLE is not set or does not exist: "${EXECUTABLE}"`);
    process.exit(2);
  }
  if (!['production', 'staging-probe'].includes(MODE)) {
    console.error(`QRQUICK_MODE must be production or staging-probe (got "${MODE}")`);
    process.exit(2);
  }

  const env = { ...process.env };
  delete env.QRQUICK_TEST_MODE;
  delete env.QRQUICK_WEB_DIR;
  if (MODE === 'staging-probe') {
    const dir = path.resolve(process.env.QRQUICK_TEST_WEB_DIR || '');
    if (!fs.existsSync(path.join(dir, 'config.js'))) {
      console.error(`QRQUICK_TEST_WEB_DIR has no config.js: "${dir}"`);
      process.exit(2);
    }
    env.QRQUICK_TEST_MODE = '1';
    env.QRQUICK_WEB_DIR = dir;
  }

  // --no-sandbox: the CI runners cannot grant Chromium's sandbox (Ubuntu's AppArmor restriction, and no setuid
  // helper in the unpacked Windows build). The packaged app itself keeps sandbox: true in its window settings.
  const app = await electron.launch({ executablePath: EXECUTABLE, args: ['--no-sandbox'], env, timeout: 120000 });
  const proc = app.process();
  const pageErrors = [];
  let page = null;
  try {
    page = await app.firstWindow({ timeout: 120000 });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.waitForSelector('#auth-form', { timeout: 60000 });

    const url = page.url();
    record('the app loads its own copy of the web app (not a web server)', url.startsWith('qrquick://app/'), url);

    const heading = ((await page.textContent('h1')) || '').trim();
    record('the sign-in screen renders', /Shop owner sign in/i.test(heading), heading);

    const served = await page.evaluate(() => window.PRINTNEST_CONFIG || null);
    if (MODE === 'production') {
      const ok =
        !!served &&
        served.supabaseUrl === `https://${PRODUCTION_REF}.supabase.co` &&
        served.ownerApp === true &&
        served.publicBaseUrl === PRODUCTION_PUBLIC_URL &&
        typeof served.publishableKey === 'string' &&
        served.publishableKey.startsWith('sb_publishable_') &&
        !JSON.stringify(served).includes(STAGING_REF);
      record(
        'the shipped configuration uses the production project, the owner app and the production QR address',
        ok,
        served ? `${served.supabaseUrl}, ownerApp ${served.ownerApp}, QR address ${served.publicBaseUrl}` : 'no config loaded'
      );
      await page.screenshot({ path: path.join(OUT, '01-signin-production.png'), fullPage: true });
    } else {
      record(
        'the test copy uses the staging project (test only, not in the release)',
        !!served && served.supabaseUrl === `https://${STAGING_REF}.supabase.co` && served.ownerApp === true,
        served ? served.supabaseUrl : 'no config loaded'
      );
      await page.fill('#auth-form input[name=email]', 'no-such-owner.qrquick@example.com');
      await page.fill('#auth-form input[name=password]', 'WrongPassword-2026');
      await page.click('#auth-form button[type=submit]');
      await page.waitForFunction(
        () => {
          const el = document.querySelector('[data-error]');
          return el && el.textContent.trim().length > 0;
        },
        null,
        { timeout: 60000 }
      );
      const refusal = ((await page.textContent('[data-error]')) || '').trim();
      record(
        'a wrong password gets a readable message, not a database error',
        refusal.length > 0 && !COLUMN_ERROR.test(refusal),
        refusal
      );
      await page.screenshot({ path: path.join(OUT, '02-refused-staging-probe.png'), fullPage: true });
    }

    // The app must still be running and responsive after 20 seconds.
    await page.waitForTimeout(20000);
    const stillRunning = proc.exitCode === null && proc.signalCode === null;
    const titleAfter = await page.evaluate(() => document.title).catch(() => null);
    record('the app is still running and responsive after 20 seconds', stillRunning && titleAfter !== null, `title "${titleAfter}"`);

    record('no uncaught page errors during the run', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  } catch (error) {
    record('the smoke run completed', false, String((error && error.message) || error).slice(0, 300));
    if (page) await page.screenshot({ path: path.join(OUT, 'zz-failure.png'), fullPage: true }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ mode: MODE, results }, null, 2));
    await app.close().catch(() => {});
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`== mode ${MODE}: ${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}

main();
