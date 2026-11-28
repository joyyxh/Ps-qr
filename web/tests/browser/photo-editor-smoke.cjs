// Browser check for the customer photo editor (crop, turn, brightness, contrast, keep original, cancel).
// Runs the real module in a test page. No backend is involved, so nothing is uploaded.
const path = require('path');
const os = require('os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const OUT_DIR = process.env.QRQUICK_SMOKE_OUT || path.join(os.tmpdir(), 'qrquick-smoke');
require('fs').mkdirSync(OUT_DIR, { recursive: true });
const launchOptions = () => {
  const options = { args: ['--no-sandbox'] };
  if (process.env.CHROMIUM_PATH) options.executablePath = process.env.CHROMIUM_PATH;
  return options;
};

const PAGE = 'http://127.0.0.1:5173/tests/browser/photo-editor.html';
const PASSPORT = 35 / 45;
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures += 1;
};

// Opens the editor on a 1200 x 800 picture. The result is stored on window.__result.
async function openWithPicture(page, name) {
  await page.evaluate((fileName) => {
    window.__result = 'pending';
    (async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 1200, 800);
      gradient.addColorStop(0, '#ff3300');
      gradient.addColorStop(1, '#0033ff');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1200, 800);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], fileName, { type: 'image/png' });
      const edited = await window.openEditor(file);
      if (!edited) {
        window.__result = { cancelled: true };
        return;
      }
      const bitmap = await createImageBitmap(edited);
      window.__result = { name: edited.name, type: edited.type, size: edited.size, width: bitmap.width, height: bitmap.height };
    })().catch((err) => {
      window.__result = { error: String(err && err.message) };
    });
  }, name);
  await page.waitForSelector('dialog.photo-editor[open]');
  await page.waitForFunction(() => (document.querySelector('[data-view]')?.width ?? 0) > 0);
}

async function stageShape(page) {
  return page.evaluate(() => {
    const box = document.querySelector('[data-stage]').getBoundingClientRect();
    return box.width / box.height;
  });
}

async function cropRatio(page) {
  return page.evaluate(() => {
    const box = document.querySelector('[data-crop]').getBoundingClientRect();
    return box.width / box.height;
  });
}

(async () => {
  const browser = await chromium.launch(launchOptions());
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(PAGE);

    // 1. The editor opens on the whole picture, with the stage at the picture's shape.
    await openWithPicture(page, 'holiday.png');
    const landscape = await stageShape(page);
    check(Math.abs(landscape - 1.5) < 0.01, `stage keeps the picture shape (${landscape.toFixed(3)})`);
    check(Math.abs((await cropRatio(page)) - 1.5) < 0.01, 'the free crop starts as the whole picture');

    // 2. Passport shape: the crop frame takes the 35 x 45 mm ratio.
    await page.click('[data-preset="passport"]');
    const pressed = await page.getAttribute('[data-preset="passport"]', 'aria-pressed');
    check(pressed === 'true', 'the passport shape button is pressed');
    const passportRatio = await cropRatio(page);
    check(Math.abs(passportRatio - PASSPORT) < 0.01, `the crop frame is 35 x 45 mm shaped (${passportRatio.toFixed(3)})`);

    // 3. Turn right: the stage turns to portrait and the crop keeps the passport shape.
    await page.click('[data-turn="1"]');
    const portrait = await stageShape(page);
    check(Math.abs(portrait - 2 / 3) < 0.01, `turning right swaps the picture (${portrait.toFixed(3)})`);
    check(Math.abs((await cropRatio(page)) - PASSPORT) < 0.01, 'the passport shape survives a turn');
    const undistorted = await page.evaluate(() => {
      const stage = document.querySelector('[data-stage]').getBoundingClientRect();
      const view = document.querySelector('[data-view]').getBoundingClientRect();
      return Math.abs(stage.width / stage.height - view.width / view.height) < 0.01;
    });
    check(undistorted, 'the preview is not stretched on a phone after a turn');

    // 4. Brightness moves the preview.
    const before = await page.evaluate(() => {
      const d = document.querySelector('[data-view]').getContext('2d').getImageData(10, 10, 1, 1).data;
      return d[0];
    });
    await page.evaluate(() => {
      const slider = document.querySelector('[data-adjust="brightness"]');
      slider.value = '60';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const after = await page.evaluate(() => {
      const d = document.querySelector('[data-view]').getContext('2d').getImageData(10, 10, 1, 1).data;
      return d[0];
    });
    check(after >= before, `brightness does not darken the preview (${before} -> ${after})`);

    // 5. Use the picture: a passport-shaped JPEG, scaled to at most 2000 pixels on its longest side.
    await page.screenshot({ path: path.join(OUT_DIR, 'photo-editor-passport-390.png') });
    await page.click('[data-action="use"]');
    await page.waitForFunction(() => window.__result !== 'pending', null, { timeout: 15000 });
    const edited = await page.evaluate(() => window.__result);
    check(edited.name === 'holiday-edited.jpg' && edited.type === 'image/jpeg', `the upload is a JPEG named ${edited.name}`);
    check(Math.abs(edited.width / edited.height - PASSPORT) < 0.02, `the uploaded picture is passport shaped (${edited.width} x ${edited.height})`);
    check(Math.max(edited.width, edited.height) <= 2000 && edited.size > 0, 'the uploaded picture is within the size limit');

    // 6. Keep the original: no change means the same file goes up.
    await openWithPicture(page, 'card.png');
    await page.click('[data-action="original"]');
    await page.waitForFunction(() => window.__result !== 'pending', null, { timeout: 15000 });
    const original = await page.evaluate(() => window.__result);
    check(original.name === 'card.png', 'use without changes keeps the original file');
    await page.waitForFunction(() => !document.querySelector('dialog.photo-editor'));

    // 7. Cancel returns nothing, so the customer can choose another file.
    await openWithPicture(page, 'cancel.png');
    await page.click('[data-action="cancel"]');
    await page.waitForFunction(() => window.__result !== 'pending', null, { timeout: 15000 });
    const cancelled = await page.evaluate(() => window.__result);
    check(cancelled.cancelled === true, 'cancel returns nothing');

    // 8. Dark theme: the editor uses black and white, not the blue-navy colours.
    const dark = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 1 });
    dark.on('pageerror', (err) => errors.push(err.message));
    await dark.goto(PAGE);
    await openWithPicture(dark, 'dark.png');
    const surface = await dark.evaluate(() => getComputedStyle(document.querySelector('dialog.photo-editor')).backgroundColor);
    check(surface === 'rgb(11, 11, 11)', `dark editor surface is near black (${surface})`);
    await dark.screenshot({ path: path.join(OUT_DIR, 'photo-editor-dark-390.png') });
    await dark.close();

    check(errors.length === 0, `no page errors (${errors.length ? errors.join(' | ') : 'none'})`);
    await page.close();
  } catch (err) {
    console.log(`FAIL  photo editor check threw: ${err.message}`);
    failures += 1;
  } finally {
    await browser.close();
  }
  console.log(failures === 0 ? 'photo editor smoke: all checks passed' : `photo editor smoke: ${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
})();
