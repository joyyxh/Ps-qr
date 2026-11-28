import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AUDIT_PAGE_SIZE,
  READ_PARAMS,
  READ_RPCS,
  SEARCH_LIMIT,
  buildAuditBody,
  buildLicenceBody,
  buildSearchBody,
  callReadRpc,
  hasReadShape,
} from '../src/read-api.js';

// Parameter names are read from the migration itself, so a renamed or reordered argument fails here.
const SQL = readFileSync(new URL('../../supabase/migrations/0017_licence_admin_read_rpcs.sql', import.meta.url), 'utf8');
const CONFIG = { supabaseUrl: 'https://project-ref.supabase.co', publishableKey: 'sb_publishable_example_only' };
const TOKEN = 'access-token-example-only';
const SHOP = '8f14e45f-ceea-4b7a-9c1d-2a3b4c5d6e7f';
const COVERAGE = '3b241101-e2bb-4255-8caf-4136c566a962';
const ENTRY = '5e1c2d3a-0000-4000-8000-000000000001';
const ACTOR = '11111111-2222-4333-8444-555555555555';

const SHOP_ITEM = { shop_id: SHOP, slug: 'sunrise-print', name: 'Sunrise Print' };
const LICENCE = {
  ok: true,
  shop: SHOP_ITEM,
  state_version: 3,
  state: { state: 'ACTIVE', basis: 'admin_grant', access_until: '2026-12-01T00:00:00+05:30', next_start: null },
  coverages: [{
    coverage_id: COVERAGE,
    kind: 'admin_grant',
    status: 'current',
    starts_at: '2026-11-01T00:00:00.123456+05:30',
    ends_at: '2026-12-01T00:00:00+05:30',
    reason: 'Cash received',
  }],
  coverages_truncated: false,
};
const AUDIT_ENTRY = {
  entry_id: ENTRY,
  created_at: '2026-11-08T10:00:00.5+05:30',
  action: 'grant',
  coverage_id: COVERAGE,
  reason: 'Cash received',
  licence_start: null,
  licence_end: '2026-12-01T00:00:00+05:30',
  actor_user_id: ACTOR,
  before_state: {},
  after_state: {},
};

function sqlParams(name) {
  const head = `function public.${name}(`;
  const start = SQL.indexOf(head);
  assert.notEqual(start, -1, `${name} is not defined in 0017`);
  const open = start + head.length;
  const close = SQL.indexOf(')', open);
  return SQL.slice(open, close)
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function fakeFetch(respond) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return respond(url, init);
  };
  return { fn, calls };
}

// ---------- the functions the client calls ----------

test('the parameter lists match the 0017 function signatures, in the same order', () => {
  assert.deepEqual(Object.values(READ_RPCS).sort(), Object.keys(READ_PARAMS).sort());
  for (const rpc of Object.values(READ_RPCS)) {
    assert.deepEqual([...READ_PARAMS[rpc]], sqlParams(rpc), rpc);
  }
});

test('0017 grants the three reads to authenticated only, and the gate to no client role', () => {
  assert.match(SQL, /revoke all on function public\.licence_admin_read_gate\(text\)\s+from public, anon, authenticated, service_role;/);
  assert.match(SQL, /revoke execute on function[\s\S]*?from public, anon, service_role;/);
  assert.match(SQL, /grant execute on function[\s\S]*?to authenticated;/);
});

// ---------- request shaping ----------

test('search trims the query and counts characters, not UTF-16 units, as the server does', () => {
  const ok = buildSearchBody('  Sunrise  ');
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.body, { p_query: 'Sunrise', p_limit: SEARCH_LIMIT });
  assert.deepEqual(Object.keys(ok.body), ['p_query', 'p_limit']);

  assert.equal(buildSearchBody('a').ok, false, 'one character is too short');
  assert.equal(buildSearchBody('   ').ok, false, 'blank is too short');
  assert.equal(buildSearchBody(null).ok, false);
  assert.equal(buildSearchBody('😀').ok, false, 'one emoji is one character');
  assert.equal(buildSearchBody('😀😀').ok, true, 'two emoji are two characters');
  assert.equal(buildSearchBody('x'.repeat(80)).ok, true);
  assert.equal(buildSearchBody('x'.repeat(81)).ok, false);
});

test('a licence view needs a UUID shop ID and sends only p_shop_id', () => {
  const ok = buildLicenceBody(SHOP);
  assert.deepEqual(ok, { ok: true, body: { p_shop_id: SHOP } });
  assert.equal(buildLicenceBody('not-a-uuid').ok, false);
  assert.equal(buildLicenceBody(undefined).ok, false);
});

test('audit pages: the first page sends null cursor fields; a later page sends the cursor pair', () => {
  const first = buildAuditBody(SHOP);
  assert.equal(first.ok, true);
  assert.deepEqual(Object.keys(first.body), ['p_shop_id', 'p_after_created_at', 'p_after_id', 'p_limit']);
  assert.equal(first.body.p_after_created_at, null);
  assert.equal(first.body.p_after_id, null);
  assert.equal(first.body.p_limit, AUDIT_PAGE_SIZE);

  const next = buildAuditBody(SHOP, { created_at: '2026-11-08T10:00:00.5+05:30', entry_id: ENTRY });
  assert.equal(next.ok, true);
  assert.equal(next.body.p_after_created_at, '2026-11-08T10:00:00.5+05:30');
  assert.equal(next.body.p_after_id, ENTRY);

  assert.equal(buildAuditBody(SHOP, { created_at: '2026-11-08T10:00:00+05:30' }).ok, false, 'cursor needs both fields');
  assert.equal(buildAuditBody(SHOP, { created_at: 'yesterday', entry_id: ENTRY }).ok, false);
  assert.equal(buildAuditBody(SHOP, { created_at: '2026-11-08T10:00:00+05:30', entry_id: 'nope' }).ok, false);
  assert.equal(buildAuditBody('nope').ok, false);
});

// ---------- the call ----------

test('a read is never sent without a configuration, a known name or the exact parameter keys', async () => {
  const { fn, calls } = fakeFetch(() => json(200, { ok: true, shops: [], has_more: false }));
  const body = buildSearchBody('sun').body;

  assert.equal((await callReadRpc({ config: {}, fetchImpl: fn, accessToken: TOKEN, rpc: READ_RPCS.search, body })).kind, 'error');
  assert.equal((await callReadRpc({ config: CONFIG, fetchImpl: fn, accessToken: TOKEN, rpc: 'licence_admin_grant', body })).kind, 'error');
  assert.equal((await callReadRpc({
    config: CONFIG, fetchImpl: fn, accessToken: TOKEN, rpc: READ_RPCS.search,
    body: { ...body, p_request_id: 'x' },
  })).kind, 'error', 'a request ID is never sent to a read');
  assert.equal((await callReadRpc({
    config: CONFIG, fetchImpl: fn, accessToken: TOKEN, rpc: READ_RPCS.search,
    body: { p_limit: 10, p_query: 'sun' },
  })).kind, 'error', 'key order must match the signature');
  assert.equal(calls.length, 0, 'nothing was sent');
});

test('a successful read is posted with the token in a header only, never in the URL', async () => {
  const { fn, calls } = fakeFetch(() => json(200, { ok: true, shops: [SHOP_ITEM], has_more: false }));
  const body = buildSearchBody('sun').body;
  const out = await callReadRpc({ config: CONFIG, fetchImpl: fn, accessToken: TOKEN, rpc: READ_RPCS.search, body });

  assert.deepEqual(out, { kind: 'result', data: { ok: true, shops: [SHOP_ITEM], has_more: false } });
  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call.url, `${CONFIG.supabaseUrl}/rest/v1/rpc/admin_search_shops`);
  assert.equal(call.url.includes(TOKEN), false, 'token must not be in the URL');
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.headers.authorization, `Bearer ${TOKEN}`);
  assert.equal(call.init.headers.apikey, CONFIG.publishableKey);
  assert.equal(call.init.credentials, 'omit');
  assert.equal(call.init.cache, 'no-store');
  assert.equal(call.init.referrerPolicy, 'no-referrer');
  assert.deepEqual(JSON.parse(call.init.body), body);
});

test('the response is classified: committed rejection, session refused, or error (never unknown for a read)', async () => {
  const body = buildLicenceBody(SHOP).body;
  const run = (respond) => callReadRpc({
    config: CONFIG, fetchImpl: fakeFetch(respond).fn, accessToken: TOKEN, rpc: READ_RPCS.licence, body,
  });

  assert.deepEqual(await run(() => json(200, { ok: false, code: 'shop_not_found' })), { kind: 'rejected', code: 'shop_not_found' });
  assert.deepEqual(await run(() => json(200, { ok: false, code: 'forbidden' })), { kind: 'rejected', code: 'forbidden' });
  assert.equal((await run(() => json(401, {}))).kind, 'session');
  assert.equal((await run(() => json(500, {}))).kind, 'error', 'a 5xx is a plain error for a read');
  assert.equal((await run(() => json(403, {}))).kind, 'error');
  assert.equal((await run(() => { throw new TypeError('network'); })).kind, 'error');
  assert.equal((await run(() => new Response('not json', { status: 200 }))).kind, 'error');
  assert.equal((await run(() => json(200, { ok: true, shops: 'x' }))).kind, 'error', 'wrong shape for the licence view');
});

test('a read is sent once: a failed read is not retried', async () => {
  const { fn, calls } = fakeFetch(() => json(500, {}));
  await callReadRpc({
    config: CONFIG, fetchImpl: fn, accessToken: TOKEN, rpc: READ_RPCS.audit, body: buildAuditBody(SHOP).body,
  });
  assert.equal(calls.length, 1);
});

// ---------- response shape ----------

test('the search response needs a shop list, has_more and well-formed shops', () => {
  assert.equal(hasReadShape(READ_RPCS.search, { ok: true, shops: [SHOP_ITEM], has_more: false }), true);
  assert.equal(hasReadShape(READ_RPCS.search, { ok: true, shops: [] }), false, 'has_more is required');
  assert.equal(hasReadShape(READ_RPCS.search, { ok: true, shops: [{ ...SHOP_ITEM, shop_id: 'x' }], has_more: false }), false);
  assert.equal(hasReadShape(READ_RPCS.search, { ok: true, shops: 'none', has_more: false }), false);
});

test('the licence response needs a version, a state, coverages and the truncation flag', () => {
  assert.equal(hasReadShape(READ_RPCS.licence, LICENCE), true);
  assert.equal(hasReadShape(READ_RPCS.licence, { ...LICENCE, state_version: -1 }), false);
  assert.equal(hasReadShape(READ_RPCS.licence, { ...LICENCE, state_version: 1.5 }), false);
  assert.equal(hasReadShape(READ_RPCS.licence, { ...LICENCE, state: { ...LICENCE.state, state: 'BOGUS' } }), false);
  assert.equal(hasReadShape(READ_RPCS.licence, { ...LICENCE, state: { ...LICENCE.state, access_until: 'soon' } }), false);
  assert.equal(hasReadShape(READ_RPCS.licence, { ...LICENCE, coverages: [{ ...LICENCE.coverages[0], kind: 'other' }] }), false);
  assert.equal(hasReadShape(READ_RPCS.licence, { ...LICENCE, coverages: [{ ...LICENCE.coverages[0], starts_at: '2026-11-01' }] }), false, 'a date alone is not a timestamp');
  assert.equal(hasReadShape(READ_RPCS.licence, { ...LICENCE, coverages: [{ ...LICENCE.coverages[0], ends_at: null }] }), true, 'a lifetime coverage has no end');
  const { coverages_truncated: _omitted, ...withoutFlag } = LICENCE;
  assert.equal(hasReadShape(READ_RPCS.licence, withoutFlag), false);
});

test('the audit response needs entries and a next cursor or null', () => {
  assert.equal(hasReadShape(READ_RPCS.audit, { ok: true, entries: [AUDIT_ENTRY], next: null }), true);
  assert.equal(hasReadShape(READ_RPCS.audit, { ok: true, entries: [], next: { created_at: '2026-11-08T10:00:00+05:30', entry_id: ENTRY } }), true);
  assert.equal(hasReadShape(READ_RPCS.audit, { ok: true, entries: [], next: { created_at: 'x', entry_id: ENTRY } }), false);
  assert.equal(hasReadShape(READ_RPCS.audit, { ok: true, entries: [{ ...AUDIT_ENTRY, action: 'delete' }], next: null }), false);
  assert.equal(hasReadShape(READ_RPCS.audit, { ok: true, entries: [{ ...AUDIT_ENTRY, created_at: '2026-11-08T10:00:00' }], next: null }), false, 'a timestamp needs a zone');
  assert.equal(hasReadShape(READ_RPCS.audit, { ok: true, entries: [{ ...AUDIT_ENTRY, licence_end: null }], next: null }), true);
  assert.equal(hasReadShape(READ_RPCS.audit, { ok: true, entries: [{ ...AUDIT_ENTRY, actor_user_id: 'me' }], next: null }), false);
});

test('an unknown RPC name has no response shape', () => {
  assert.equal(hasReadShape('licence_admin_grant', { ok: true }), false);
});
