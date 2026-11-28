// Customer pages against the REAL qrquick-staging backend: shop page, upload, price, place order, tracking.
// Nothing here mocks Supabase. Runs only with STAGING_SUPABASE_URL and STAGING_PUBLISHABLE_KEY set.
//
// It places a real order on the staging project (a test order on a QA shop). It never edits or deletes rows.
//
// Environment:
//   STAGING_SUPABASE_URL      https://<staging-ref>.supabase.co
//   STAGING_PUBLISHABLE_KEY   sb_publishable_...
//   STAGING_APP_URL           where the website copy is served, for example http://127.0.0.1:5176/
//   STAGING_SHOP_SLUG         a QA shop on staging with active services (default qa-print-one)
//   STAGING_USE_SERVED_CONFIG=1  keep the served copy's own config.js (must have ownerApp false)
//   PLAYWRIGHT_MODULE, QRQUICK_SMOKE_OUT  as in staging-owner-smoke.cjs
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const OUT = process.env.QRQUICK_SMOKE_OUT || path.join(os.tmpdir(), 'qrquick-staging-customer');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.STAGING_APP_URL || 'http://127.0.0.1:5176/';
const SUPABASE_URL = process.env.STAGING_SUPABASE_URL || '';
const PUBLISHABLE_KEY = process.env.STAGING_PUBLISHABLE_KEY || '';
const SLUG = process.env.STAGING_SHOP_SLUG || 'qa-print-one';
const SERVED = process.env.STAGING_USE_SERVED_CONFIG === '1';

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`);
};
const info = (name, detail) => {
  results.push({ name, ok: true, info: true, detail });
  console.log(`INFO ${name} :: ${detail}`);
};

// A valid one-page PDF, built here so no binary fixture is needed.
function onePagePdf() {
  const stream = 'BT /F1 24 Tf 72 720 Td (QRquick staging test) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << >> >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const COLUMN_ERROR = /does not exist|is not a function|TypeError|undefined is not|Cannot read|null is not/i;

async function noHorizontalScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

async function uploadPdf(page) {
  await page.setInputFiles('#file-input', { name: 'test-one-page.pdf', mimeType: 'application/pdf', buffer: onePagePdf() });
  await page.waitForFunction(() => {
    const err = document.getElementById('item-error');
    if (err && err.textContent.trim()) return true;
    const status = document.getElementById('upload-status');
    return status && status.textContent.trim() && !/Uploading/i.test(status.textContent);
  }, null, { timeout: 60000 });
  const error = ((await page.textContent('#item-error')) || '').trim();
  const status = ((await page.textContent('#upload-status')) || '').trim();
  return { error, status };
}

async function addFileWithService(page) {
  const values = await page.$$eval('#service-select option', (os) =>
    os.filter((o) => !o.disabled && o.value).map((o) => o.value)
  );
  if (!values.length) throw new Error('the shop has no active services to choose');
  await page.selectOption('#service-select', values[0]);
  await page.waitForFunction(() => {
    const b = document.getElementById('add-item');
    return b && !b.disabled;
  }, null, { timeout: 30000 });
  await page.click('#add-item');
  await page.waitForFunction(() => document.querySelectorAll('#cart li').length > 0 && !/No items yet/.test(document.getElementById('cart').textContent), null, { timeout: 30000 });
  await page.waitForFunction(() => /₹/.test(document.getElementById('quote')?.textContent || ''), null, { timeout: 30000 });
  return ((await page.textContent('#quote')) || '').replace(/\s+/g, ' ').trim();
}

async function placeOrder(page, method) {
  await page.selectOption('#payment-method', method);
  await page.waitForFunction(() => {
    const b = document.getElementById('place');
    return b && !b.disabled;
  }, null, { timeout: 30000 });
  await page.click('#place');
  await page.waitForFunction(() => {
    const err = document.getElementById('order-error');
    if (err && err.textContent.trim()) return true;
    return /Order received/.test(document.querySelector('h1')?.textContent || '');
  }, null, { timeout: 60000 });
  // After a successful order the app replaces the whole screen, so #order-error is gone: read it only if present.
  const error = await page.evaluate(() => (document.getElementById('order-error')?.textContent || '').trim());
  if (error) return { error };
  const code = await page.evaluate(() => (document.querySelector('.confirm .code')?.textContent || '').trim());
  const body = await page.evaluate(() => (document.querySelector('.confirm')?.textContent || '').replace(/\s+/g, ' ').trim());
  return { code, body };
}

async function main() {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    console.error('set STAGING_SUPABASE_URL and STAGING_PUBLISHABLE_KEY');
    process.exit(2);
  }
  if (!PUBLISHABLE_KEY.startsWith('sb_publishable_')) {
    console.error('refused: STAGING_PUBLISHABLE_KEY must be a publishable key');
    process.exit(2);
  }

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  if (!SERVED) {
    const configJs = `window.PRINTNEST_CONFIG = ${JSON.stringify({
      supabaseUrl: SUPABASE_URL,
      publishableKey: PUBLISHABLE_KEY,
      publicBaseUrl: BASE,
      authRedirectUrl: BASE,
      ownerApp: false,
    })};`;
    await context.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: configJs }));
  }
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  try {
    // 1. The shop page opens on a phone and fits the width.
    await page.goto(`${BASE}?run=shop#/s/${encodeURIComponent(SLUG)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#file-input', { timeout: 40000 });
    const config = await page.evaluate(() => window.PRINTNEST_CONFIG || null);
    record('the website loads the staging backend with the customer pages on',
      !!config && config.supabaseUrl === SUPABASE_URL && config.ownerApp === false,
      config ? `ownerApp ${config.ownerApp}` : 'no config');
    const shopName = ((await page.textContent('h1')) || '').trim();
    record('the shop page shows the shop name from staging', shopName.length > 0, shopName);
    record('the shop page fits a 390px phone without sideways scrolling', await noHorizontalScroll(page));
    await page.screenshot({ path: path.join(OUT, '01-shop-phone.png'), fullPage: true });

    // 2. An unsupported file gets a readable message, not a crash.
    await page.setInputFiles('#file-input', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await page.waitForFunction(() => document.getElementById('item-error')?.textContent.trim().length > 0, null, { timeout: 30000 });
    const badFile = ((await page.textContent('#item-error')) || '').trim();
    record('an unsupported file is refused with a readable message', badFile.length > 0 && !COLUMN_ERROR.test(badFile), badFile);

    // 3. A real PDF uploads to staging, is counted, and can be priced.
    await page.goto(`${BASE}?run=shop2#/s/${encodeURIComponent(SLUG)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#file-input', { timeout: 40000 });
    const up = await uploadPdf(page);
    record('a PDF uploads to the staging storage and is counted', !up.error && /page/i.test(up.status), up.error || up.status);
    const quote = await addFileWithService(page);
    record('the staging server prices the file in the order', /₹/.test(quote), quote.slice(0, 160));
    await page.screenshot({ path: path.join(OUT, '02-priced-phone.png'), fullPage: true });

    // 4. Cash order is placed on staging and returns a tracking code.
    const cash = await placeOrder(page, 'cash');
    record('a cash order is placed and returns a tracking code', !cash.error && /^[A-Z0-9-]{6,}$/.test(cash.code || ''), cash.error || cash.code);
    if (cash.code) {
      // 5. The tracking page shows that order.
      const track = await context.newPage();
      await track.goto(`${BASE}?run=track#/track/${encodeURIComponent(cash.code)}`, { waitUntil: 'domcontentloaded' });
      await track.waitForFunction((c) => document.getElementById('track-result')?.textContent.includes(c), cash.code, { timeout: 40000 }).catch(() => {});
      const trackText = ((await track.textContent('#track-result')) || '').replace(/\s+/g, ' ').trim();
      record('the tracking page shows the placed order', trackText.includes(cash.code), trackText.slice(0, 160));
      record('the tracking page fits a 390px phone', await noHorizontalScroll(track));
      await track.close();
    }

    // 6. UPI is only offered when the shop has a payment QR. Test it when it is offered.
    await page.goto(`${BASE}?run=upi#/s/${encodeURIComponent(SLUG)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#file-input', { timeout: 40000 });
    const upiEnabled = await page.evaluate(() => {
      const o = document.querySelector('#payment-method option[value=upi]');
      return !!o && !o.disabled;
    });
    if (upiEnabled) {
      await uploadPdf(page);
      await addFileWithService(page);
      const upi = await placeOrder(page, 'upi');
      record('a UPI order is placed and marked as pending verification',
        !upi.error && /UPI payment is pending/.test(upi.body || ''), upi.error || upi.code);
    } else {
      info('UPI order', `not offered: shop ${SLUG} has no payment QR on staging, so UPI cannot be tested there`);
    }

    record('no uncaught page errors during the run', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  } catch (err) {
    record('the customer run completed', false, String(err && err.message ? err.message : err).slice(0, 300));
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
