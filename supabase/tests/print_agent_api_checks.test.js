// Checks for the print-agent edge function's pure parts. They need no network and no
// Supabase project. Run with:  node --test supabase/tests/print_agent_api_checks.test.js
//
// The database behaviour is covered by supabase/tests/stage8_print_tests.sql.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../functions/print-agent/index.ts', import.meta.url), 'utf8');

// The browser-side and edge-side rules must agree with public.print_code_hash.
// The SQL keeps letters and digits and upper-cases them, so do the same here.
function normaliseCode(code) {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

test('a pairing code is compared without dashes and in capitals', () => {
  assert.equal(normaliseCode('abcd-2345'), 'ABCD2345');
  assert.equal(normaliseCode(' ab cd-23 45 '), 'ABCD2345');
  const hash = createHash('sha256').update(normaliseCode('abcd-2345'), 'utf8').digest('hex');
  assert.equal(hash.length, 64);
});

test('the edge function hashes the code with the same rule as the database', () => {
  assert.match(source, /code\.replace\(\/\[\^A-Za-z0-9\]\/g, ""\)\.toUpperCase\(\)/);
});

test('the raw token never reaches the database call', () => {
  // The rpc calls pass p_token_hash, which is computed with sha256Hex(token).
  assert.match(source, /p_token_hash: await sha256Hex\(token\)/);
  assert.match(source, /p_token_hash: tokenHash/);
  assert.doesNotMatch(source, /p_token: /);
});

test('storage paths are removed from the claim response before it reaches the agent', () => {
  assert.match(source, /const \{ storage_path: _path, \.\.\.safe \} = job;/);
});

test('database error text is never returned to the agent', () => {
  assert.match(source, /console\.error\(`print-agent: \$\{name\} failed/);
  assert.doesNotMatch(source, /message: String\(.*\)\s*\}\)/);
});

test('only the five agent actions are routed', () => {
  assert.match(source, /new Set\(\["pair", "heartbeat", "claim", "printing", "finish"\]\)/);
});

test('every agent call is rate limited per address and per token', () => {
  assert.match(source, /agent-ip:/);
  assert.match(source, /`agent:\$\{tokenHash\}`/);
  assert.match(source, /`pair:\$\{await sha256Hex\(clientIp\(req\)\)\}`/);
});
