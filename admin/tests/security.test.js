// Static checks on the admin panel's own files. These do not replace server-side checks. They stop
// common mistakes from reaching a private deployment: HTML injection, secrets in the bundle,
// persistent token storage, third-party loads and an indexable page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADMIN = fileURLToPath(new URL('..', import.meta.url));

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'tests') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const SHIPPED = walk(ADMIN).filter((f) => /\.(js|html|css|txt|json|webmanifest)$/.test(f));
const SOURCE = SHIPPED.filter((f) => f.endsWith('.js'));
const read = (rel) => readFileSync(join(ADMIN, rel), 'utf8');

function relPath(f) {
  return relative(ADMIN, f);
}

test('no HTML sinks: server data is written with textContent only', () => {
  const sinks = /\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write|\beval\s*\(|new Function\s*\(|setTimeout\s*\(\s*['"`]/;
  for (const file of SOURCE) {
    assert.equal(sinks.test(readFileSync(file, 'utf8')), false, `HTML sink in ${relPath(file)}`);
  }
});

test('no persistent browser storage for tokens or any other state', () => {
  const storage = /localStorage|sessionStorage|indexedDB|document\.cookie|openDatabase/;
  for (const file of SHIPPED) {
    assert.equal(storage.test(readFileSync(file, 'utf8')), false, `storage use in ${relPath(file)}`);
  }
});

test('only the publishable key path exists: no secret key literal outside the guard', () => {
  for (const file of SHIPPED) {
    const text = readFileSync(file, 'utf8');
    const name = relPath(file);
    if (name === join('src', 'config-guard.js')) continue;
    assert.equal(/sb_secret_|service_role/.test(text), false, `secret-key reference in ${name}`);
  }
});

test('modules import only from inside the admin folder and never from the public web app', () => {
  for (const file of SOURCE) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      assert.match(match[1], /^\.\/[^']+\.js$/, `${relPath(file)} imports ${match[1]}`);
    }
    assert.equal(/\bweb\//.test(text), false, `${relPath(file)} refers to the public web folder`);
  }
});

test('the page sets a strict Content Security Policy and has no inline script or handlers', () => {
  const html = read('index.html');
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /connect-src 'self' https:\/\/\*\.supabase\.co/);
  assert.equal(/<script(?![^>]*\ssrc=)[^>]*>/i.test(html), false, 'inline script');
  assert.equal(/\son[a-z]+\s*=/i.test(html), false, 'inline event handler');
  assert.equal(/(src|href)="https?:\/\//i.test(html), false, 'external resource');
});

test('the page is private: noindex, no-referrer, and robots.txt disallows everything', () => {
  const html = read('index.html');
  assert.match(html, /name="robots" content="noindex, nofollow, noarchive"/);
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.match(read('robots.txt'), /^User-agent: \*\s*\nDisallow: \/\s*$/m);
});

test('the committed configuration is empty: this build targets no project', () => {
  const config = read('config.js');
  assert.match(config, /supabaseUrl: ''/);
  assert.match(config, /publishableKey: ''/);
});

test('no plain http URL is used anywhere in the panel', () => {
  for (const file of SHIPPED) {
    assert.equal(/http:\/\/(?!localhost)/.test(readFileSync(file, 'utf8')), false, `http URL in ${relPath(file)}`);
  }
});
