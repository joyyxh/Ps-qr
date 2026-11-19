// Schema contract: the database objects the browser asks for must be created by a migration.
//
// Why this exists: on 2026-11-19 the live project stopped at migration 0009, but the owner app
// (built from this branch) selects shops.auto_print_enabled at sign-in. PostgREST answered
// "column shops_1.auto_print_enabled does not exist", so no owner could open a shop. This file
// checks the repository half of that contract. The database half is run by
// supabase/tests/owner_catch_up/run_catch_up.sh, which reproduces the error on the 0001-0009 state
// and then applies the catch-up on a clean PostgreSQL 16 database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');

const migrations = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => ({ name, text: readFileSync(path.join(MIGRATIONS, name), 'utf8') }));
const allSql = migrations.map((m) => m.text).join('\n');

const ownerApi = readFileSync(path.join(ROOT, 'web', 'src', 'owner-api.js'), 'utf8');
const customerApi = readFileSync(path.join(ROOT, 'web', 'src', 'api.js'), 'utf8');

function functionDefined(name) {
  return new RegExp(`create\\s+(or\\s+replace\\s+)?function\\s+public\\.${name}\\s*\\(`, 'i').test(allSql);
}

// Columns of public.shops: the create table in 0001, plus every later "add column" on shops.
function shopsColumns() {
  const block = allSql.match(/create table public\.shops \(([\s\S]*?)\n\);/);
  assert.ok(block, 'migration 0001 must create public.shops');
  const keywords = new Set(['constraint', 'primary', 'unique', 'check', 'foreign']);
  const columns = new Set();
  for (const line of block[1].split('\n')) {
    const match = line.match(/^\s+([a-z_]+)\s+/);
    if (match && !keywords.has(match[1])) columns.add(match[1]);
  }
  // One alter statement may add several columns ("add column a ..., add column b ..."), so read
  // every clause of every statement, not only the first.
  for (const statement of allSql.matchAll(/alter table public\.shops([\s\S]*?);/g)) {
    for (const clause of statement[1].matchAll(/add column (?:if not exists )?([a-z_]+)/g)) {
      columns.add(clause[1]);
    }
  }
  return columns;
}

test('every RPC the owner app calls is created by a migration', () => {
  const names = new Set([...ownerApi.matchAll(/rpc\/([a-z_]+)/g)].map((m) => m[1]));
  assert.ok(names.size >= 10, 'expected the owner app to call its RPCs; the pattern may be wrong');
  const missing = [...names].filter((name) => !functionDefined(name));
  assert.deepEqual(missing, [], `owner app calls RPCs that no migration creates: ${missing.join(', ')}`);
});

test('every RPC the customer app calls is created by a migration', () => {
  const names = new Set([...customerApi.matchAll(/rpc\('([a-z_]+)'/g)].map((m) => m[1]));
  assert.ok(names.size >= 3, 'expected the customer app to call its RPCs; the pattern may be wrong');
  const missing = [...names].filter((name) => !functionDefined(name));
  assert.deepEqual(missing, [], `customer app calls RPCs that no migration creates: ${missing.join(', ')}`);
});

test('the shop columns the owner sign-in query embeds all exist', () => {
  // listMyShops: shop:shops(id,slug,...,auto_print_enabled). Each name must be a column of public.shops.
  const embed = ownerApi.match(/shop:shops\(([^)]*)\)/);
  assert.ok(embed, 'listMyShops must embed shops(...) with explicit columns');
  const wanted = embed[1].split(',').map((c) => c.trim()).filter(Boolean);
  const have = shopsColumns();
  const missing = wanted.filter((column) => !have.has(column));
  assert.deepEqual(missing, [], `owner sign-in selects shops columns no migration creates: ${missing.join(', ')}`);
});

test('auto_print_enabled is added by migration 0018 as an owner switch, off by default', () => {
  const adds = migrations.filter((m) => /add column (if not exists )?auto_print_enabled\b/.test(m.text)).map((m) => m.name);
  assert.deepEqual(adds, ['0018_auto_print.sql'], 'exactly one migration may add auto_print_enabled');
  const sql = migrations.find((m) => m.name === '0018_auto_print.sql').text;
  assert.match(sql, /alter table public\.shops\s+add column if not exists auto_print_enabled boolean not null default false;/);
});

test('0018 is applied after 0010, which creates the print tables its trigger writes to', () => {
  // 0018 applied alone would install a trigger that inserts into print_jobs, a table that does not
  // exist until 0010. The catch-up runbook therefore applies 0010 first; this keeps the order.
  const names = migrations.map((m) => m.name);
  assert.ok(names.indexOf('0010_print_agents.sql') < names.indexOf('0018_auto_print.sql'));
  assert.match(allSql, /create table public\.print_jobs/);
});
