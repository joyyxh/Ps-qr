import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isServiceKey, isUsableConfig } from '../src/config-guard.js';
import { qrImageSource } from '../src/qr.js';
import { GENERIC_REJECTION, REJECTION_MESSAGES, rejectionMessage } from '../src/messages.js';

const SQL = readFileSync(new URL('../../supabase/migrations/0016_licence_admin_rpcs.sql', import.meta.url), 'utf8');
const URL_OK = 'https://project-ref.supabase.co';
const PUB = 'sb_publishable_example_only';

function jwt(claims) {
  return `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
}

test('a usable configuration needs an https URL and a non-empty publishable key', () => {
  assert.equal(isUsableConfig({ supabaseUrl: URL_OK, publishableKey: PUB }), true);
  assert.equal(isUsableConfig({ supabaseUrl: '', publishableKey: '' }), false, 'empty build is not configured');
  assert.equal(isUsableConfig({ supabaseUrl: 'http://project.example', publishableKey: PUB }), false);
  assert.equal(isUsableConfig({ supabaseUrl: URL_OK, publishableKey: '   ' }), false);
  assert.equal(isUsableConfig(null), false);
});

test('secret keys are refused in every form: sb_secret_ prefix or a service_role JWT', () => {
  assert.equal(isServiceKey('sb_secret_0000'), true);
  assert.equal(isServiceKey(jwt({ role: 'service_role' })), true);
  assert.equal(isServiceKey(jwt({ role: 'authenticated' })), false);
  assert.equal(isServiceKey(PUB), false);
  assert.equal(isUsableConfig({ supabaseUrl: URL_OK, publishableKey: 'sb_secret_0000' }), false);
  assert.equal(isUsableConfig({ supabaseUrl: URL_OK, publishableKey: jwt({ role: 'service_role' }) }), false);
});

test('the QR code is shown only as an SVG data image, never as markup or another URL', () => {
  assert.equal(qrImageSource('<svg xmlns="http://www.w3.org/2000/svg"></svg>').startsWith('data:image/svg+xml;charset=utf-8,'), true);
  assert.equal(qrImageSource('data:image/svg+xml,<svg></svg>'), 'data:image/svg+xml,<svg></svg>');
  assert.equal(qrImageSource('javascript:alert(1)'), '');
  assert.equal(qrImageSource('https://example.test/x.png'), '');
  assert.equal(qrImageSource(undefined), '');
});

test('every committed rejection code that 0016 can return has a plain-language message', () => {
  const codes = new Set();
  for (const m of SQL.matchAll(/licence_admin_reject\('([a-z_]+)'\)/g)) codes.add(m[1]);
  for (const m of SQL.matchAll(/'([a-z_]+)'::text,\s*null/g)) codes.add(m[1]);
  codes.add('forbidden');
  assert.ok(codes.size >= 20, `expected many codes, found ${codes.size}`);
  for (const code of codes) {
    assert.ok(Object.hasOwn(REJECTION_MESSAGES, code), `no message for ${code}`);
  }
});

test('unknown codes fall back to the generic message, never to the raw code', () => {
  assert.equal(rejectionMessage('something_new'), GENERIC_REJECTION);
  assert.equal(rejectionMessage('__proto__'), GENERIC_REJECTION);
  assert.match(rejectionMessage('overlap'), /overlaps/);
});

test('every code the admin read RPCs (0017) can return has a plain-language message', () => {
  const sql13 = readFileSync(new URL('../../supabase/migrations/0017_licence_admin_read_rpcs.sql', import.meta.url), 'utf8');
  const codes = new Set(['forbidden']); // returned by the shared denial helper in 0016
  for (const m of sql13.matchAll(/licence_admin_reject\('([a-z_]+)'\)/g)) codes.add(m[1]);
  assert.ok(codes.has('shop_not_found') && codes.has('invalid_request'), 'expected the read codes');
  for (const code of codes) {
    assert.ok(Object.hasOwn(REJECTION_MESSAGES, code), `no message for ${code}`);
  }
});

test('the read gate records the same three denial reasons as the write RPCs', () => {
  const sql13 = readFileSync(new URL('../../supabase/migrations/0017_licence_admin_read_rpcs.sql', import.meta.url), 'utf8');
  for (const reason of ['no_actor', 'not_platform_admin', 'aal_not_aal2']) {
    assert.match(sql13, new RegExp(`'${reason}'`), `0017 gate lacks ${reason}`);
    assert.match(SQL, new RegExp(`'${reason}'`), `0016 lacks ${reason}`);
  }
});
