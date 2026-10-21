import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function text(name) {
  return readFile(new URL(name, root), 'utf8');
}

test('QRquick shell is customer-first and no longer defaults to a demo shop', async () => {
  const html = await text('index.html');
  const app = await text('src/app.js');
  assert.match(html, /QRquick/);
  assert.match(html, /#\/scan/);
  assert.match(html, /#\/owner/);
  assert.match(app, /if \(!kind \|\| kind === 'home'\) return renderHome\(\)/);
  assert.match(app, /return renderNotFound\(\)/);
  assert.doesNotMatch(app, /DEFAULT_SHOP/);
});

test('QRquick manifest opens the customer home and supports any orientation', async () => {
  const manifest = JSON.parse(await text('manifest.webmanifest'));
  assert.equal(manifest.name, 'QRquick');
  assert.equal(manifest.short_name, 'QRquick');
  assert.match(manifest.start_url, /#\/home$/);
  assert.equal(manifest.orientation, 'any');
});

test('shop entry allow-lists slug-shaped routes and does not navigate to arbitrary origins', async () => {
  const app = await text('src/app.js');
  assert.match(app, /url\.origin !== window\.location\.origin/);
  assert.match(app, /\^\[a-z0-9\]\(\?:\[a-z0-9-\]\{0,48\}\[a-z0-9\]\)\?\$/);
});

test('theme selection is persisted under the QRquick namespace', async () => {
  const app = await text('src/app.js');
  const css = await text('styles.css');
  assert.match(app, /qrquick\.theme/);
  assert.match(css, /data-theme='dark'/);
  assert.match(css, /prefers-reduced-motion/);
});
