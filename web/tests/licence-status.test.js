// Stage 7E: the licence status screen. These are MOCKED tests: no network and no
// database. The reply shapes in fixtures/licence-status-rpc.json were captured from the
// migration 0016 function on a local throwaway PostgreSQL (see the fixture's _source).
// They are not a run against Supabase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  REASON,
  STATE,
  VIEW,
  createLicenceStatusController,
  describeView,
  failureReason,
  formatIst,
  parseLicenceStatus,
  timeHasPassed,
} from '../src/licence-status.js';
import { createLicencePages } from '../src/owner-licence.js';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/licence-status-rpc.json', import.meta.url), 'utf8')).cases;
const src = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

// 8 Nov 2026, 10:00 IST. The fixed clock for every time-based check.
const NOW = Date.parse('2026-11-08T10:00:00+05:30');
const SHOP_A = 'shop-a';
const SHOP_B = 'shop-b';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const ACTIVE_DATED = { ok: true, active: true, no_expiry: false, access_end: '2028-01-01T00:00:00+05:30', next_start: null };
const ACTIVE_LIFETIME = { ok: true, active: true, no_expiry: true, access_end: null, next_start: null };
const SCHEDULED = { ok: true, active: false, no_expiry: false, access_end: null, next_start: '2026-12-02T00:00:00+05:30' };
const INACTIVE = { ok: true, active: false, no_expiry: false, access_end: null, next_start: null };

// ---------- 1. the reply contract ----------

test('fixture: lifetime coverage is active with no expiry', () => {
  const parsed = parseLicenceStatus(fixtures.owner_active_lifetime);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.state, STATE.ACTIVE);
  assert.equal(parsed.lifetime, true);
  assert.equal(parsed.accessEndMs, null);
});

test('fixture: dated coverage is active until its end, read as an instant', () => {
  const parsed = parseLicenceStatus(fixtures.owner_active_dated);
  assert.equal(parsed.state, STATE.ACTIVE);
  assert.equal(parsed.lifetime, false);
  // The database returns UTC with +00:00; 1 Jan 2028 00:00 IST is 31 Dec 2027 18:30 UTC.
  assert.equal(parsed.accessEndMs, Date.parse('2027-12-31T18:30:00+00:00'));
});

test('fixture: a scheduled reply carries the next start and is not active', () => {
  const parsed = parseLicenceStatus(fixtures.owner_scheduled);
  assert.equal(parsed.state, STATE.SCHEDULED);
  assert.equal(parsed.nextStartMs, Date.parse('2026-12-01T18:30:00+00:00'));
});

test('fixture: expired, revoked and no coverage give the same inactive result, which the RPC does not distinguish', () => {
  const expired = parseLicenceStatus(fixtures.owner_expired);
  const revoked = parseLicenceStatus(fixtures.owner_revoked);
  const none = parseLicenceStatus(fixtures.owner_none);
  assert.deepEqual(expired, revoked);
  assert.deepEqual(expired, none);
  assert.equal(expired.state, STATE.INACTIVE);
});

test('fixture: every denial reply is forbidden and none is read as a licence', () => {
  for (const name of ['staff_same_shop', 'stranger', 'anon_no_claims', 'null_shop_id']) {
    const parsed = parseLicenceStatus(fixtures[name]);
    assert.equal(parsed.ok, false, name);
    assert.equal(parsed.reason, REASON.FORBIDDEN, name);
  }
});

test('a reply that is not an object is malformed', () => {
  for (const raw of [null, undefined, 'OK', [], 42, true, '{"ok":true}']) {
    assert.deepEqual(parseLicenceStatus(raw), { ok: false, reason: REASON.MALFORMED }, String(raw));
  }
});

test('ok must be exactly true or a forbidden refusal', () => {
  assert.equal(parseLicenceStatus({}).reason, REASON.MALFORMED);
  assert.equal(parseLicenceStatus({ ...ACTIVE_LIFETIME, ok: 'true' }).reason, REASON.MALFORMED);
  assert.equal(parseLicenceStatus({ ...ACTIVE_LIFETIME, ok: 1 }).reason, REASON.MALFORMED);
  assert.equal(parseLicenceStatus({ ok: false, code: 'something_else' }).reason, REASON.MALFORMED);
  assert.equal(parseLicenceStatus({ ok: false }).reason, REASON.MALFORMED);
});

test('a missing field is never read as active', () => {
  assert.equal(parseLicenceStatus({ ok: true, active: true }).reason, REASON.MALFORMED);
  for (const key of ['active', 'no_expiry', 'access_end', 'next_start']) {
    const reply = { ...ACTIVE_LIFETIME };
    delete reply[key];
    assert.equal(parseLicenceStatus(reply).ok, false, `without ${key}`);
  }
});

test('wrong field types are malformed', () => {
  const bad = [
    { active: 'true' },
    { no_expiry: 'false' },
    { access_end: 123 },
    { next_start: {} },
    { active: 1, no_expiry: 0 },
  ];
  for (const change of bad) {
    assert.equal(parseLicenceStatus({ ...ACTIVE_DATED, ...change }).ok, false, JSON.stringify(change));
  }
});

test('active replies must be internally consistent', () => {
  // Active with a next start: an active coverage cannot also be the scheduled one.
  assert.equal(parseLicenceStatus({ ...ACTIVE_DATED, next_start: '2026-12-02T00:00:00+05:30' }).reason, REASON.MALFORMED);
  // Lifetime with an end time: a lifetime coverage has no end.
  assert.equal(parseLicenceStatus({ ...ACTIVE_LIFETIME, access_end: '2028-01-01T00:00:00+05:30' }).reason, REASON.MALFORMED);
  // Dated but with no end time.
  assert.equal(parseLicenceStatus({ ...ACTIVE_DATED, access_end: null }).reason, REASON.MALFORMED);
  // A dated end that is not a readable timestamp.
  for (const bad of ['soon', '', '2028-01-01', '2028-01-01 00:00:00+05:30', '2028-13-45T99:00:00+05:30']) {
    assert.equal(parseLicenceStatus({ ...ACTIVE_DATED, access_end: bad }).reason, REASON.MALFORMED, bad);
  }
});

test('a timestamp without a stated zone is malformed, so the device time zone cannot change the result', () => {
  assert.equal(parseLicenceStatus({ ...ACTIVE_DATED, access_end: '2028-01-01T00:00:00' }).reason, REASON.MALFORMED);
  assert.equal(parseLicenceStatus({ ...SCHEDULED, next_start: '2026-12-02T00:00:00' }).reason, REASON.MALFORMED);
});

test('inactive and scheduled replies must be internally consistent', () => {
  // Not active but still marked lifetime.
  assert.equal(parseLicenceStatus({ ...INACTIVE, no_expiry: true }).reason, REASON.MALFORMED);
  // Not active but carrying an end time.
  assert.equal(parseLicenceStatus({ ...INACTIVE, access_end: '2028-01-01T00:00:00+05:30' }).reason, REASON.MALFORMED);
  // Scheduled with an unreadable start.
  assert.equal(parseLicenceStatus({ ...SCHEDULED, next_start: 'tomorrow' }).reason, REASON.MALFORMED);
});

test('no reply shape can produce an active state unless it says active', () => {
  const replies = [
    { ok: true },
    { ok: true, access_end: '2028-01-01T00:00:00+05:30', no_expiry: false },
    { ok: true, active: false, no_expiry: true, access_end: null, next_start: null },
  ];
  for (const reply of replies) {
    const parsed = parseLicenceStatus(reply);
    assert.notEqual(parsed.state, STATE.ACTIVE, JSON.stringify(reply));
  }
});

// ---------- 2. why a request failed ----------

test('failure reasons separate offline, network, auth, server and unknown', () => {
  assert.equal(failureReason(new TypeError('Failed to fetch'), true), REASON.NETWORK);
  assert.equal(failureReason(new TypeError('Failed to fetch'), false), REASON.OFFLINE);
  assert.equal(failureReason(Object.assign(new Error('x'), { status: 500 }), false), REASON.OFFLINE, 'offline wins');
  assert.equal(failureReason(Object.assign(new Error('x'), { status: 401 })), REASON.AUTH);
  assert.equal(failureReason(Object.assign(new Error('x'), { status: 403 })), REASON.AUTH);
  assert.equal(failureReason(Object.assign(new Error('x'), { status: 404 })), REASON.SERVICE_MISSING);
  assert.equal(failureReason(Object.assign(new Error('x'), { code: 'PGRST202' })), REASON.SERVICE_MISSING);
  for (const status of [408, 429, 500, 502, 503]) {
    assert.equal(failureReason(Object.assign(new Error('x'), { status })), REASON.SERVER, String(status));
  }
  assert.equal(failureReason(Object.assign(new Error('x'), { status: 400 })), REASON.UNKNOWN);
  assert.equal(failureReason(new Error('boom')), REASON.UNKNOWN);
});

// ---------- 3. what the screen says ----------

test('IST formatting shows the exclusive end in Asia/Kolkata', () => {
  assert.equal(formatIst(Date.parse('2027-12-31T18:30:00Z')), '1 Jan 2028, 00:00 IST');
});

test('display: lifetime, dated and scheduled coverage show the approved labels', () => {
  const lifetime = describeView({ phase: VIEW.READY, status: parseLicenceStatus(fixtures.owner_active_lifetime), checkedAt: NOW }, NOW);
  assert.equal(lifetime.badge, 'Active');
  assert.equal(lifetime.summary, 'Lifetime access. No expiry.');
  assert.equal(lifetime.nextStart, '');
  assert.equal('printing' in lifetime, false);

  const dated = describeView({ phase: VIEW.READY, status: parseLicenceStatus(fixtures.owner_active_dated), checkedAt: NOW }, NOW);
  assert.equal(dated.badge, 'Active');
  assert.equal('printing' in dated, false);
  // The access line wording is approved by the owner (decision 2, 2026-11-09). Exact match, so any change shows up here.
  assert.equal(dated.summary, 'Access until 1 Jan 2028, 00:00 IST.');

  const scheduled = describeView({ phase: VIEW.READY, status: parseLicenceStatus(fixtures.owner_scheduled), checkedAt: NOW }, NOW);
  // One inactive badge. The next start is kept on its own line (owner, 2026-11-09).
  assert.equal(scheduled.badge, 'Not active');
  assert.equal(scheduled.tone, 'muted');
  assert.equal(scheduled.summary, 'No access is active now.');
  assert.equal(scheduled.nextStart, 'The next access starts 2 Dec 2026, 00:00 IST.');
  assert.equal('printing' in scheduled, false);
});

test('display: inactive shows no reason, because the RPC gives none', () => {
  const inactive = describeView({ phase: VIEW.READY, status: parseLicenceStatus(fixtures.owner_expired), checkedAt: NOW }, NOW);
  assert.equal(inactive.badge, 'Not active');
  assert.equal(inactive.nextStart, '');
  assert.equal('printing' in inactive, false);
  assert.doesNotMatch(inactive.summary, /expired|revoked|cancel/i);
});

test('display: an end time that has already passed asks for a refresh and is never shown as Active', () => {
  const status = parseLicenceStatus({ ...ACTIVE_DATED, access_end: '2026-11-08T09:00:00+05:30' });
  const model = describeView({ phase: VIEW.READY, status, checkedAt: NOW - 60_000 }, NOW);
  assert.equal(model.needsRefresh, true);
  assert.equal(model.badge, 'Check again');
  assert.notEqual(model.badge, 'Active');
  assert.equal('printing' in model, false);
});

test('display: a scheduled start that has already passed asks for a refresh', () => {
  const status = parseLicenceStatus({ ...SCHEDULED, next_start: '2026-11-08T09:00:00+05:30' });
  const model = describeView({ phase: VIEW.READY, status, checkedAt: NOW - 60_000 }, NOW);
  assert.equal(model.needsRefresh, true);
  assert.equal(model.badge, 'Check again');
});

test('display: every unavailable reason is never shown as active or as inactive', () => {
  for (const reason of Object.values(REASON)) {
    if (reason === REASON.FORBIDDEN || reason === REASON.MALFORMED) continue; // covered below
    const model = describeView({ phase: VIEW.UNAVAILABLE, reason, attemptedAt: NOW }, NOW);
    assert.equal(model.badge, 'Status unavailable', reason);
    assert.notEqual(model.badge, 'Active', reason);
    assert.notEqual(model.badge, 'Not active', reason);
    assert.match(model.checkedText, /No status from earlier checks is shown/, reason);
  }
});

test('display: forbidden and malformed replies are unavailable, not active', () => {
  for (const reason of [REASON.FORBIDDEN, REASON.MALFORMED]) {
    const model = describeView({ phase: VIEW.UNAVAILABLE, reason, attemptedAt: NOW }, NOW);
    assert.equal(model.badge, 'Status unavailable', reason);
    assert.notEqual(model.badge, 'Active', reason);
  }
});

test('display: offline and inactive are clearly different', () => {
  const offline = describeView({ phase: VIEW.UNAVAILABLE, reason: REASON.OFFLINE, attemptedAt: NOW }, NOW);
  const inactive = describeView({ phase: VIEW.READY, status: parseLicenceStatus(INACTIVE), checkedAt: NOW }, NOW);
  assert.notEqual(offline.badge, inactive.badge);
  assert.notEqual(offline.summary, inactive.summary);
  assert.match(offline.summary, /offline/);
  assert.doesNotMatch(inactive.summary, /offline|could not/i);
});

test('display: an auth failure offers a way back to sign in', () => {
  assert.equal(describeView({ phase: VIEW.UNAVAILABLE, reason: REASON.AUTH, attemptedAt: NOW }, NOW).signIn, true);
  assert.equal(describeView({ phase: VIEW.UNAVAILABLE, reason: REASON.NETWORK, attemptedAt: NOW }, NOW).signIn, false);
});

test('display: loading and idle show no licence facts', () => {
  const loading = describeView({ phase: VIEW.LOADING }, NOW);
  assert.equal(loading.busy, true);
  assert.equal('printing' in loading, false);
  assert.equal(loading.badge, 'Checking…');

  const idle = describeView({ phase: VIEW.IDLE }, NOW);
  assert.equal('printing' in idle, false);
  assert.equal(idle.badge, '');
  assert.equal('printing' in describeView(null, NOW), false);
});

test('display: the approved labels are exact in the screen code, and the removed printing line is gone', () => {
  const screen = src('licence-status.js') + src('owner-licence.js');
  for (const label of [
    'Lifetime access. No expiry.',
    'Access until ',
    'No access is active now.',
    'The next access starts ',
    'No printing access is active for this shop.',
    'Check again',
    'Status unavailable',
    'Checking…',
    'Refresh',
    'Last checked ',
    'Last attempt ',
    'The licence status is shown to the shop owner only.',
  ]) {
    assert.ok(screen.includes(label), label);
  }
  assert.match(screen, /badge: 'Not active'/);
  assert.doesNotMatch(screen, /Not active now/);
  assert.doesNotMatch(screen, /Printing permitted/);
  assert.doesNotMatch(screen, /licence-facts|printingText/);
});

test('timeHasPassed only flags a time that is in the past', () => {
  assert.equal(timeHasPassed(parseLicenceStatus(fixtures.owner_active_dated), NOW), false);
  assert.equal(timeHasPassed(parseLicenceStatus(fixtures.owner_active_lifetime), Date.parse('2099-01-01T00:00:00Z')), false);
  assert.equal(timeHasPassed(parseLicenceStatus(fixtures.owner_expired), Date.parse('2099-01-01T00:00:00Z')), false);
  assert.equal(timeHasPassed(parseLicenceStatus({ ...ACTIVE_DATED, access_end: '2026-11-08T09:00:00+05:30' }), NOW), true);
  assert.equal(timeHasPassed(parseLicenceStatus({ ...SCHEDULED, next_start: '2026-11-08T09:00:00+05:30' }), NOW), true);
});

// ---------- 4. the state controller ----------

function harness({ online = true } = {}) {
  const calls = [];
  const views = [];
  const pending = new Map(); // shopId -> the deferred for the newest call to it
  let loader = null; // optional: (shopId) => promise; default is a deferred per call
  const controller = createLicenceStatusController({
    loadStatus: (shopId) => {
      calls.push(shopId);
      if (loader) return loader(shopId);
      const d = deferred();
      pending.set(shopId, d);
      return d.promise;
    },
    now: () => NOW,
    isOnline: () => online,
    onChange: (view) => views.push(view),
  });
  return {
    controller,
    calls,
    views,
    pending,
    setLoader(fn) {
      loader = fn;
    },
    setOnline(value) {
      online = value;
    },
  };
}

test('controller: open shows loading, then the ready status with the check time', async () => {
  const h = harness();
  const done = h.controller.open(SHOP_A);
  assert.equal(h.controller.getView().phase, VIEW.LOADING);
  assert.equal(h.controller.getView().status, null);

  h.pending.get(SHOP_A).resolve(ACTIVE_DATED);
  const view = await done;
  assert.equal(view.phase, VIEW.READY);
  assert.equal(view.status.state, STATE.ACTIVE);
  assert.equal(view.checkedAt, NOW);
  assert.deepEqual(h.calls, [SHOP_A]);
});

test('controller: a malformed reply is unavailable and never active', async () => {
  const h = harness();
  h.setLoader(async () => ({ ok: true, active: true }));
  const view = await h.controller.open(SHOP_A);
  assert.equal(view.phase, VIEW.UNAVAILABLE);
  assert.equal(view.reason, REASON.MALFORMED);
  assert.equal(view.status, null);
});

test('controller: a forbidden reply is unavailable, with the forbidden reason', async () => {
  const h = harness();
  h.setLoader(async () => fixtures.staff_same_shop);
  const view = await h.controller.open(SHOP_A);
  assert.equal(view.phase, VIEW.UNAVAILABLE);
  assert.equal(view.reason, REASON.FORBIDDEN);
  assert.equal(view.status, null);
});

test('controller: request failures map to auth, network and server reasons, never to active', async () => {
  const cases = [
    [Object.assign(new Error('Please sign in again.'), { status: 401 }), REASON.AUTH],
    [new TypeError('Failed to fetch'), REASON.NETWORK],
    [Object.assign(new Error('busy'), { status: 503 }), REASON.SERVER],
  ];
  for (const [err, reason] of cases) {
    const h = harness();
    h.setLoader(async () => {
      throw err;
    });
    const view = await h.controller.open(SHOP_A);
    assert.equal(view.phase, VIEW.UNAVAILABLE, reason);
    assert.equal(view.reason, reason);
    assert.equal(view.status, null);
  }
});

test('controller: offline sends no request and says offline', async () => {
  const h = harness({ online: false });
  const view = await h.controller.open(SHOP_A);
  assert.deepEqual(h.calls, []);
  assert.equal(view.reason, REASON.OFFLINE);
  assert.equal(view.status, null);
});

test('controller: a shop switch drops the earlier shop\'s late reply', async () => {
  const h = harness();
  const first = h.controller.open(SHOP_A);
  const second = h.controller.open(SHOP_B);
  h.pending.get(SHOP_B).resolve(SCHEDULED);
  await second;
  // Shop A answers last, with an active licence. It must not appear.
  h.pending.get(SHOP_A).resolve(ACTIVE_LIFETIME);
  const after = await first;

  assert.equal(after.shopId, SHOP_B);
  assert.equal(after.status.state, STATE.SCHEDULED);
  const leaked = h.views.filter((v) => v.shopId === SHOP_A && v.status);
  assert.equal(leaked.length, 0, 'no view of shop A carries its status once B is open');
});

test('controller: a late failure for an earlier shop does not overwrite the current shop', async () => {
  const h = harness();
  const first = h.controller.open(SHOP_A);
  const second = h.controller.open(SHOP_B);
  h.pending.get(SHOP_B).resolve(INACTIVE);
  await second;
  h.pending.get(SHOP_A).reject(new TypeError('Failed to fetch'));
  const after = await first;
  assert.equal(after.shopId, SHOP_B);
  assert.equal(after.phase, VIEW.READY);
  assert.equal(after.reason, null);
});

test('controller: sign-out during a check drops the reply and keeps no licence data', async () => {
  const h = harness();
  const pendingOpen = h.controller.open(SHOP_A);
  h.controller.close();
  h.pending.get(SHOP_A).resolve(ACTIVE_LIFETIME);
  const after = await pendingOpen;

  assert.equal(after.phase, VIEW.IDLE);
  assert.equal(after.status, null);
  assert.equal(after.shopId, null);
  assert.equal(h.views.at(-1).phase, VIEW.IDLE, 'the last published view is the cleared one');
  assert.equal(h.views.filter((v) => v.status).length, 0);
});

test('controller: after close, refresh does nothing and sends no request', async () => {
  const h = harness();
  h.controller.close();
  await h.controller.refresh();
  assert.deepEqual(h.calls, []);
});

test('controller: overlapping refresh presses share one request', async () => {
  const h = harness();
  const first = h.controller.open(SHOP_A);
  const again = [h.controller.refresh(), h.controller.refresh(), h.controller.refresh()];
  assert.deepEqual(h.calls, [SHOP_A], 'one request while the first is running');

  h.pending.get(SHOP_A).resolve(ACTIVE_DATED);
  const results = await Promise.all([first, ...again]);
  assert.equal(h.calls.length, 1);
  for (const view of results) assert.equal(view.phase, VIEW.READY);
});

test('controller: a refresh after a finished check sends a new request', async () => {
  const h = harness();
  const first = h.controller.open(SHOP_A);
  h.pending.get(SHOP_A).resolve(ACTIVE_DATED);
  await first;

  const second = h.controller.refresh();
  assert.equal(h.calls.length, 2);
  h.pending.get(SHOP_A).resolve(SCHEDULED);
  const view = await second;
  assert.equal(view.status.state, STATE.SCHEDULED);
});

test('controller: a refresh clears the earlier status, so old data is not shown as freshly checked', async () => {
  const h = harness();
  const first = h.controller.open(SHOP_A);
  h.pending.get(SHOP_A).resolve(ACTIVE_LIFETIME);
  await first;

  h.controller.refresh();
  const during = h.controller.getView();
  assert.equal(during.phase, VIEW.LOADING);
  assert.equal(during.status, null);
  assert.equal(during.checkedAt, null);
});

test('controller: a failed refresh after a success shows no status', async () => {
  const h = harness();
  const first = h.controller.open(SHOP_A);
  h.pending.get(SHOP_A).resolve(ACTIVE_LIFETIME);
  await first;

  const second = h.controller.refresh();
  h.pending.get(SHOP_A).reject(Object.assign(new Error('busy'), { status: 503 }));
  const view = await second;
  assert.equal(view.phase, VIEW.UNAVAILABLE);
  assert.equal(view.reason, REASON.SERVER);
  assert.equal(view.status, null);
});

test('controller: the view is a copy, so a caller cannot change the state by editing it', async () => {
  const h = harness();
  const first = h.controller.open(SHOP_A);
  h.pending.get(SHOP_A).resolve(ACTIVE_LIFETIME);
  const view = await first;
  view.phase = VIEW.IDLE;
  view.status.state = STATE.INACTIVE;
  assert.equal(h.controller.getView().phase, VIEW.READY);
  assert.equal(h.controller.getView().status.state, STATE.ACTIVE);
});

// ---------- 5. static guards: what the browser code may and may not reach ----------

test('the browser reads licence status through one owner RPC and never the licence tables', () => {
  const api = src('owner-api.js');
  const page = src('owner-licence.js');
  const logic = src('licence-status.js');
  const forbidden = /licence_(coverages|config|denial|admin|audit|lock|replay|canon)|shop_licence_state|licence_admin|\/licence_/;
  for (const [name, text] of [['owner-api.js', api], ['owner-licence.js', page], ['licence-status.js', logic]]) {
    assert.doesNotMatch(text, forbidden, `${name} must not name a licence table, helper or admin RPC`);
  }
  const licenceRpcs = api.match(/rpc\/[a-z_]*licence[a-z_]*/g) ?? [];
  assert.deepEqual(licenceRpcs, ['rpc/shop_licence_status'], 'the only licence call is the owner read');
});

test('the licence screen has one action, Refresh, and no grant, extend, revoke or replace control', () => {
  const page = src('owner-licence.js');
  const actions = [...page.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(actions)], ['licence-refresh']);
  // Only the code is checked: the header comment names these words to say they are absent.
  assert.doesNotMatch(page.replace(/\/\/.*$/gm, ''), /grant|extend|revoke|replace/i);
});

test('the shop page links to the licence screen only for owners, and sign-out and navigation clear it', () => {
  const owner = src('owner.js');
  assert.match(owner, /shop\.role === 'owner' && licenceEnabled \? `<a class="button" href="#\/owner\/shop\/\$\{encodeURIComponent\(shop\.slug\)\}\/licence">Licence<\/a>` : ''/);
  assert.match(owner, /if \(section === 'licence' && licenceEnabled\) return licencePages\.open\(shop\);/);
  assert.match(owner, /licencePages\.close\(\); \/\/ leaving the licence page/);
  assert.match(owner, /async function signOut\(\) \{\s*licencePages\.close\(\);/);
});

test('the licence view is switched off in the Android owner bundle (config.ownerApp), and only there', () => {
  const owner = src('owner.js');
  assert.match(owner, /const licenceEnabled = config\.ownerApp !== true;/);
  assert.match(owner, /createLicencePages\(\{ app, ownerApi, enabled: licenceEnabled \}\)/);
  // The copy script is what sets ownerApp for the Android bundle; the web default stays false.
  const copyScript = readFileSync(new URL('../../mobile/scripts/copy-web.mjs', import.meta.url), 'utf8');
  assert.match(copyScript, /ownerApp:\s*true/);
  const config = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
  assert.match(config, /ownerApp: false,/);
});

// ---------- 6. the Android owner bundle: the licence view is off ----------

test('with the view switched off, opening it for an owner sends no request and draws nothing', async () => {
  const calls = [];
  const app = { innerHTML: 'unchanged' };
  const pages = createLicencePages({
    app,
    ownerApi: {
      shopLicenceStatus: async (shopId) => {
        calls.push(shopId);
        return ACTIVE_DATED;
      },
    },
    enabled: false,
    now: () => NOW,
    isOnline: () => true,
  });
  await pages.open({ id: SHOP_A, slug: 'alpha', name: 'Alpha', role: 'owner' });
  assert.deepEqual(calls, []);
  assert.equal(app.innerHTML, 'unchanged');
});

test('with the view on, the owner gets one check and staff get none (control for the test above)', async () => {
  const calls = [];
  const app = { innerHTML: '', querySelector: () => null };
  const pages = createLicencePages({
    app,
    ownerApi: {
      shopLicenceStatus: async (shopId) => {
        calls.push(shopId);
        return ACTIVE_DATED;
      },
    },
    now: () => NOW,
    isOnline: () => true,
  });
  await pages.open({ id: SHOP_A, slug: 'alpha', name: 'Alpha', role: 'owner' });
  assert.deepEqual(calls, [SHOP_A]);
  assert.match(app.innerHTML, /Access until 1 Jan 2028, 00:00 IST\./);
  await pages.open({ id: SHOP_B, slug: 'beta', name: 'Beta', role: 'staff' });
  assert.deepEqual(calls, [SHOP_A], 'staff send no request');
  assert.match(app.innerHTML, /shown to the shop owner only/);
});
