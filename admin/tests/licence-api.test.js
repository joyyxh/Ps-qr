import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ACTIONS,
  ALLOWED_KEYS,
  buildLicencePayload,
  callLicenceRpc,
  createRequestTracker,
  rpcName,
  stableStringify,
} from '../src/licence-api.js';

const SHOP = '8f14e45f-ceea-4b7a-9c1d-2a3b4c5d6e7f';
const COVERAGE = '3b241101-e2bb-4255-8caf-4136c566a962';
const CONFIG = { supabaseUrl: 'https://project-ref.supabase.co', publishableKey: 'sb_publishable_example_only' };
const SQL = readFileSync(new URL('../../supabase/migrations/0016_licence_admin_rpcs.sql', import.meta.url), 'utf8');

function raw(overrides = {}) {
  return {
    shop_id: SHOP,
    expected_state_version: '3',
    confirm: true,
    reason: '  Cash received at counter  ',
    grant_kind: 'one_month',
    start: '',
    end: '',
    backdate_confirm: false,
    extension_unit: 'month',
    target_coverage_id: COVERAGE,
    ...overrides,
  };
}

// ---------- allowed keys match the server ----------

function serverAllowedKeys() {
  const block = SQL.slice(SQL.indexOf('function public.licence_admin_allowed_keys'));
  const body = block.slice(0, block.indexOf('$$;', block.indexOf('$$')))
  const result = {};
  for (const match of body.matchAll(/when '(grant|extend|revoke|replace)'\s+then array\[([^\]]*)\]/g)) {
    result[match[1]] = [...match[2].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  }
  return result;
}

test('ALLOWED_KEYS equals licence_admin_allowed_keys() in migration 0016, action by action', () => {
  const server = serverAllowedKeys();
  assert.deepEqual(Object.keys(server).sort(), [...ACTIONS].sort());
  for (const action of ACTIONS) {
    assert.deepEqual(ALLOWED_KEYS[action], server[action], `drift for ${action}`);
  }
});

test('RPC names match the four approved 7C admin RPCs', () => {
  assert.equal(rpcName('grant'), 'licence_admin_grant');
  assert.equal(rpcName('extend'), 'licence_admin_extend');
  assert.equal(rpcName('revoke'), 'licence_admin_revoke');
  assert.equal(rpcName('replace'), 'licence_admin_replace');
  for (const action of ACTIONS) {
    assert.ok(SQL.includes(`create or replace function public.licence_admin_${action}(`), `${action} exists in 0016`);
  }
});

// ---------- payload building ----------

test('grant payload has exactly the grant keys, trimmed reason, lower-case shop ID and null optionals', () => {
  const built = buildLicencePayload('grant', raw({ shop_id: SHOP.toUpperCase() }));
  assert.equal(built.ok, true);
  assert.deepEqual(Object.keys(built.payload).sort(), [...ALLOWED_KEYS.grant].sort());
  assert.equal(built.payload.shop_id, SHOP);
  assert.equal(built.payload.expected_state_version, 3);
  assert.equal(built.payload.reason, 'Cash received at counter');
  assert.equal(built.payload.start, null);
  assert.equal(built.payload.end, null);
  assert.equal(built.payload.backdate_confirm, false);
  assert.equal(built.payload.confirm, true);
  assert.equal('target_coverage_id' in built.payload, false, 'grant must not send a target coverage ID');
});

test('extend payload never includes licence-type, date or target fields', () => {
  const built = buildLicencePayload('extend', raw({ extension_unit: 'year' }));
  assert.equal(built.ok, true);
  assert.deepEqual(Object.keys(built.payload).sort(), [...ALLOWED_KEYS.extend].sort());
  assert.equal(built.payload.extension_unit, 'year');
  for (const key of ['grant_kind', 'start', 'end', 'target_coverage_id', 'backdate_confirm']) {
    assert.equal(key in built.payload, false, `extend must not send ${key}`);
  }
});

test('revoke payload carries the coverage ID and no grant fields', () => {
  const built = buildLicencePayload('revoke', raw());
  assert.equal(built.ok, true);
  assert.equal(built.payload.target_coverage_id, COVERAGE);
  assert.deepEqual(Object.keys(built.payload).sort(), [...ALLOWED_KEYS.revoke].sort());
});

test('replace payload carries the target and the grant fields', () => {
  const built = buildLicencePayload('replace', raw({ grant_kind: 'custom', start: '2026-11-08', end: '2027-02-01' }));
  assert.equal(built.ok, true);
  assert.deepEqual(Object.keys(built.payload).sort(), [...ALLOWED_KEYS.replace].sort());
  assert.equal(built.payload.grant_kind, 'custom');
  assert.equal(built.payload.start, '2026-11-08');
  assert.equal(built.payload.end, '2027-02-01');
});

test('missing confirmation, reason, version or shop each produce a field error', () => {
  const built = buildLicencePayload('grant', raw({ confirm: false, reason: '  ', expected_state_version: 'x', shop_id: 'nope' }));
  assert.equal(built.ok, false);
  assert.equal(built.payload, null);
  assert.deepEqual(Object.keys(built.errors).sort(), ['confirm', 'expected_state_version', 'reason', 'shop_id']);
});

test('unknown action is refused without a payload', () => {
  const built = buildLicencePayload('disable', raw());
  assert.equal(built.ok, false);
  assert.ok(built.errors.action);
});

test('the client never sends a hash, a user ID or a request ID inside the payload', () => {
  for (const action of ACTIONS) {
    const built = buildLicencePayload(action, raw({ grant_kind: 'lifetime', extension_unit: 'month' }));
    if (!built.ok) continue;
    const text = JSON.stringify(built.payload);
    assert.equal(/payload_hash|user_id|request_id|actor/.test(text), false, action);
  }
});

// ---------- request tracker: retry reuses only an identical unknown request ----------

test('an identical retry after an unknown outcome reuses the request ID', () => {
  let n = 0;
  const tracker = createRequestTracker(() => `id-${++n}`);
  const built = buildLicencePayload('grant', raw()).payload;
  const first = tracker.requestIdFor('grant', built);
  tracker.settle(false);
  assert.equal(tracker.requestIdFor('grant', { ...built }), first);
});

test('a changed payload gets a new request ID', () => {
  let n = 0;
  const tracker = createRequestTracker(() => `id-${++n}`);
  const a = buildLicencePayload('grant', raw()).payload;
  const b = buildLicencePayload('grant', raw({ reason: 'Different reason' })).payload;
  const first = tracker.requestIdFor('grant', a);
  tracker.settle(false);
  assert.notEqual(tracker.requestIdFor('grant', b), first);
});

test('a committed outcome clears the pending ID, so the same payload later is a new operation', () => {
  let n = 0;
  const tracker = createRequestTracker(() => `id-${++n}`);
  const payload = buildLicencePayload('grant', raw()).payload;
  const first = tracker.requestIdFor('grant', payload);
  tracker.settle(true);
  assert.notEqual(tracker.requestIdFor('grant', payload), first);
});

test('stableStringify ignores key order', () => {
  assert.equal(stableStringify({ b: 1, a: [2, { d: null, c: true }] }), stableStringify({ a: [2, { c: true, d: null }], b: 1 }));
});

// ---------- RPC call classification ----------

function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { fn, calls };
}

function json(status, body) {
  return new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const PAYLOAD = buildLicencePayload('grant', raw()).payload;

test('a committed success is returned as a result with the expected headers, path and body', async () => {
  const { fn, calls } = fakeFetch(() => json(200, { ok: true, replay: false, action: 'grant', coverage_id: COVERAGE, state_version_after: 4 }));
  const out = await callLicenceRpc({ config: CONFIG, fetchImpl: fn, accessToken: 'token-value', action: 'grant', requestId: COVERAGE, payload: PAYLOAD });
  assert.equal(out.kind, 'result');
  assert.equal(out.data.state_version_after, 4);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://project-ref.supabase.co/rest/v1/rpc/licence_admin_grant');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.apikey, 'sb_publishable_example_only');
  assert.equal(calls[0].init.headers.authorization, 'Bearer token-value');
  assert.deepEqual(JSON.parse(calls[0].init.body), { p_request_id: COVERAGE, p_payload: PAYLOAD });
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].url.includes('token-value'), false, 'no token in the URL');
});

test('a committed rejection (ok false) is a result, not an error', async () => {
  const { fn } = fakeFetch(() => json(200, { ok: false, code: 'stale_state_version' }));
  const out = await callLicenceRpc({ config: CONFIG, fetchImpl: fn, accessToken: 't', action: 'grant', requestId: COVERAGE, payload: PAYLOAD });
  assert.deepEqual(out, { kind: 'result', data: { ok: false, code: 'stale_state_version' } });
});

test('401 asks for a new sign-in; 5xx, timeout and network failure are unknown outcomes', async () => {
  const a = await callLicenceRpc({ config: CONFIG, fetchImpl: fakeFetch(() => json(401, {})).fn, accessToken: 't', action: 'grant', requestId: COVERAGE, payload: PAYLOAD });
  assert.equal(a.kind, 'session');
  const b = await callLicenceRpc({ config: CONFIG, fetchImpl: fakeFetch(() => json(503, {})).fn, accessToken: 't', action: 'grant', requestId: COVERAGE, payload: PAYLOAD });
  assert.equal(b.kind, 'unknown');
  const c = await callLicenceRpc({ config: CONFIG, fetchImpl: fakeFetch(() => { throw new TypeError('Failed to fetch'); }).fn, accessToken: 't', action: 'grant', requestId: COVERAGE, payload: PAYLOAD });
  assert.equal(c.kind, 'unknown');
});

test('a non-5xx HTTP error is an error that committed nothing; a malformed 200 is unknown', async () => {
  const a = await callLicenceRpc({ config: CONFIG, fetchImpl: fakeFetch(() => json(400, { code: 'P0001' })).fn, accessToken: 't', action: 'grant', requestId: COVERAGE, payload: PAYLOAD });
  assert.equal(a.kind, 'error');
  const b = await callLicenceRpc({ config: CONFIG, fetchImpl: fakeFetch(() => new Response('<html>', { status: 200 })).fn, accessToken: 't', action: 'grant', requestId: COVERAGE, payload: PAYLOAD });
  assert.equal(b.kind, 'unknown');
});

test('no request is sent when the configuration is empty', async () => {
  const { fn, calls } = fakeFetch(() => json(200, { ok: true }));
  const out = await callLicenceRpc({ config: { supabaseUrl: '', publishableKey: '' }, fetchImpl: fn, accessToken: 't', action: 'grant', requestId: COVERAGE, payload: PAYLOAD });
  assert.equal(out.kind, 'error');
  assert.equal(calls.length, 0);
});

test('an unknown action is refused before any request', async () => {
  const { fn, calls } = fakeFetch(() => json(200, { ok: true }));
  const out = await callLicenceRpc({ config: CONFIG, fetchImpl: fn, accessToken: 't', action: 'disable', requestId: COVERAGE, payload: {} });
  assert.equal(out.kind, 'error');
  assert.equal(calls.length, 0);
});
