// The owner sign-in client (auth.js) against a fake owner-auth function and a fake Auth server.
// Checks: no email is sent, recovery codes stay in memory until the owner confirms them, sessions
// keep the username, refresh and sign-out behave, and failures keep their code.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuth } from '../src/auth.js';
import { createSessionStore, toSession } from '../src/session.js';

const NOW = 1_800_000_000_000;
const BASE = 'https://proj.example.test';
const config = { supabaseUrl: BASE, publishableKey: 'sb_publishable_test_key' };
const CODES = Array.from({ length: 10 }, (_, i) => `ABCD-EFGH-JKMN-PQR${i % 10}`);

function memoryStorage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function tokens(username = 'ada_01', access = 'access-1', expiresInSeconds = 3600) {
  return {
    access_token: access,
    refresh_token: `refresh-${access}`,
    expires_in: expiresInSeconds,
    expires_at: NOW / 1000 + expiresInSeconds,
    token_type: 'bearer',
    user: { id: 'user-1', username },
  };
}

// Routes by "METHOD path". A route is a Response or a function of the call.
function fakeServer(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const parsed = new URL(url);
    const key = `${init.method ?? 'GET'} ${parsed.pathname}`;
    const call = {
      key,
      search: parsed.search,
      headers: init.headers ?? {},
      body: init.body ? JSON.parse(init.body) : null,
    };
    calls.push(call);
    const route = routes[key];
    if (!route) return json(404, { code: 'not_found', message: `no route for ${key}` });
    if (typeof route === 'function') return route(call);
    if (route instanceof Error) throw route;
    return route;
  };
  return { fetchImpl, calls };
}

function makeAuth(routes, { storage = memoryStorage() } = {}) {
  const server = fakeServer(routes);
  const store = createSessionStore(storage);
  const auth = createAuth({ config, store, fetchImpl: server.fetchImpl, nowMs: () => NOW });
  return { auth, store, storage, calls: server.calls };
}

const FUNCTION = '/functions/v1/owner-auth';

test('sign-up sends username, password and accepted versions, and never an email', async () => {
  const { auth, calls } = makeAuth({
    [`POST ${FUNCTION}/signup`]: json(201, { username: 'ada_01', recovery_codes: CODES, session: tokens('ada_01') }),
  });
  await auth.signUp({ username: 'ada_01', password: 'Correct-Horse-9', accept: { terms: 'v1', privacy: 'v1' } });
  const body = calls[0].body;
  assert.deepEqual(Object.keys(body).sort(), ['accept', 'password', 'username']);
  assert.deepEqual(body.accept, { terms: 'v1', privacy: 'v1' });
  assert.equal(calls[0].headers.apikey, config.publishableKey);
  assert.equal(calls[0].headers.Authorization, undefined, 'no session is needed to sign up');
});

test('recovery codes wait in memory, and the session is kept only after the owner confirms', async () => {
  const { auth, store, storage } = makeAuth({
    [`POST ${FUNCTION}/signup`]: json(201, { username: 'ada_01', recovery_codes: CODES, session: tokens('ada_01') }),
  });
  const pending = await auth.signUp({ username: 'ada_01', password: 'Correct-Horse-9', accept: { terms: 'v1', privacy: 'v1' } });
  assert.equal(pending.recoveryCodes.length, 10);
  assert.equal(pending.signedIn, true);
  assert.equal(auth.hasPendingCodes(), true);
  assert.equal(store.load(), null, 'no session is stored before the codes are confirmed');
  assert.equal(storage.data.size, 0, 'nothing reaches browser storage');

  const session = await auth.acknowledgeCodes();
  assert.equal(session.user.username, 'ada_01');
  assert.equal(store.load().user.username, 'ada_01');
  assert.equal(auth.pendingCodes(), null, 'the codes are gone from memory once confirmed');
});

test('sign-up failure keeps the server code and stores nothing', async () => {
  const { auth, store } = makeAuth({
    [`POST ${FUNCTION}/signup`]: json(409, { code: 'username_taken', message: 'That username is already taken.' }),
  });
  await assert.rejects(
    auth.signUp({ username: 'ada_01', password: 'Correct-Horse-9', accept: { terms: 'v1', privacy: 'v1' } }),
    (err) => err.code === 'username_taken' && err.status === 409
  );
  assert.equal(auth.hasPendingCodes(), false);
  assert.equal(store.load(), null);
});

test('a claim sends the old email, the code, the new username and password, and holds the new codes like a sign-up', async () => {
  const { auth, calls, store } = makeAuth({
    [`POST ${FUNCTION}/claim`]: json(200, { username: 'ravi_prints', recovery_codes: CODES, session: tokens('ravi_prints') }),
  });
  const pending = await auth.claim({
    email: 'ravi@example.com',
    claimCode: 'KMNPQRSTUVWXYZ23',
    username: 'ravi_prints',
    password: 'Correct-Horse-9',
    accept: { terms: 'v1', privacy: 'v1' },
  });
  assert.deepEqual(Object.keys(calls[0].body).sort(), ['accept', 'claim_code', 'email', 'password', 'username']);
  assert.equal(calls[0].body.claim_code, 'KMNPQRSTUVWXYZ23');
  assert.equal(calls[0].headers.Authorization, undefined, 'no session is needed to claim');
  assert.equal(pending.recoveryCodes.length, 10);
  assert.equal(store.load(), null, 'the session is kept only after the owner confirms the codes');
});

test('a refused claim keeps the server code and stores nothing', async () => {
  const { auth, store } = makeAuth({
    [`POST ${FUNCTION}/claim`]: json(401, { code: 'claim_failed', message: 'no' }),
  });
  await assert.rejects(
    auth.claim({ email: 'a@b.c', claimCode: 'KMNPQRSTUVWXYZ23', username: 'ravi_prints', password: 'Correct-Horse-9', accept: {} }),
    (err) => err.code === 'claim_failed' && err.status === 401
  );
  assert.equal(store.load(), null);
  assert.equal(auth.pendingCodes(), null);
});

test('sign-in stores the session with the username and no email', async () => {
  const { auth, store } = makeAuth({
    [`POST ${FUNCTION}/signin`]: json(200, { username: 'ada_01', session: tokens('ada_01') }),
  });
  const session = await auth.signIn('ada_01', 'Correct-Horse-9');
  assert.equal(session.user.username, 'ada_01');
  assert.equal(session.user.email, undefined);
  assert.equal(store.load().user.username, 'ada_01');
});

test('a wrong password is refused with the generic code and stores nothing', async () => {
  const { auth, store } = makeAuth({
    [`POST ${FUNCTION}/signin`]: json(401, { code: 'invalid_credentials', message: 'That username or password is not right.' }),
  });
  await assert.rejects(auth.signIn('ada_01', 'wrong'), (err) => err.code === 'invalid_credentials');
  assert.equal(store.load(), null);
});

test('an expired access token is refreshed and the username is kept', async () => {
  const storage = memoryStorage();
  createSessionStore(storage).save(toSession(tokens('ada_01', 'old', 5), NOW));
  const { auth, store } = makeAuth(
    {
      'POST /auth/v1/token': (call) => {
        assert.equal(call.search, '?grant_type=refresh_token');
        return json(200, tokens('someone_else', 'fresh'));
      },
    },
    { storage }
  );
  const session = await auth.getSession();
  assert.equal(session.access_token, 'fresh');
  assert.equal(session.user.username, 'ada_01', 'the username stays the one the owner signed in with');
  assert.equal(store.load().access_token, 'fresh');
});

test('a refused refresh token ends the local session', async () => {
  const storage = memoryStorage();
  createSessionStore(storage).save(toSession(tokens('ada_01', 'old', 5), NOW));
  const { auth, store } = makeAuth(
    { 'POST /auth/v1/token': json(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }) },
    { storage }
  );
  assert.equal(await auth.getSession(), null);
  assert.equal(store.load(), null);
});

test('a network failure during refresh keeps the session for a retry', async () => {
  const storage = memoryStorage();
  createSessionStore(storage).save(toSession(tokens('ada_01', 'old', 5), NOW));
  const { auth, store } = makeAuth({ 'POST /auth/v1/token': new TypeError('Failed to fetch') }, { storage });
  await assert.rejects(auth.getSession(), TypeError);
  assert.equal(store.load().access_token, 'old');
});

test('sign-out ends the session here and asks the server for a local logout only', async () => {
  const storage = memoryStorage();
  createSessionStore(storage).save(toSession(tokens('ada_01', 'live'), NOW));
  const { auth, store, calls } = makeAuth(
    { 'POST /auth/v1/logout': new Response(null, { status: 204 }) },
    { storage }
  );
  await auth.signOut();
  assert.equal(store.load(), null);
  const logout = calls.find((c) => c.key === 'POST /auth/v1/logout');
  assert.equal(logout.search, '?scope=local');
  assert.equal(logout.headers.Authorization, 'Bearer live');
});

test('sign-out still clears the session when the server cannot be reached', async () => {
  const storage = memoryStorage();
  createSessionStore(storage).save(toSession(tokens('ada_01', 'live'), NOW));
  const { auth, store } = makeAuth({ 'POST /auth/v1/logout': new TypeError('offline') }, { storage });
  await auth.signOut();
  assert.equal(store.load(), null);
});

test('a reset ends the local session and holds the new codes until they are confirmed', async () => {
  const storage = memoryStorage();
  createSessionStore(storage).save(toSession(tokens('ada_01', 'old'), NOW));
  const { auth, store, calls } = makeAuth(
    {
      [`POST ${FUNCTION}/reset`]: json(200, { username: 'ada_01', recovery_codes: CODES, session: tokens('ada_01', 'new') }),
    },
    { storage }
  );
  const pending = await auth.resetPassword({ username: 'ada_01', recoveryCode: 'ABCDEFGHJKMNPQRS', newPassword: 'New-Horse-77' });
  assert.equal(pending.purpose, 'reset');
  assert.equal(store.load(), null, 'the old session is gone at once');
  assert.deepEqual(calls[0].body, { username: 'ada_01', recovery_code: 'ABCDEFGHJKMNPQRS', new_password: 'New-Horse-77' });

  await auth.acknowledgeCodes();
  assert.equal(store.load().access_token, 'new');
});

test('regenerating codes needs a session, sends a fresh token and keeps the session', async () => {
  const storage = memoryStorage();
  createSessionStore(storage).save(toSession(tokens('ada_01', 'live'), NOW));
  const { auth, store, calls } = makeAuth(
    { [`POST ${FUNCTION}/codes/regenerate`]: json(200, { username: 'ada_01', recovery_codes: CODES }) },
    { storage }
  );
  const made = await auth.regenerateCodes('Correct-Horse-9');
  assert.equal(made.recoveryCodes.length, 10);
  assert.equal(calls[0].headers.Authorization, 'Bearer live');
  assert.equal(store.load().access_token, 'live', 'the session is not replaced');
});

test('regenerating codes without a session makes no request', async () => {
  const { auth, calls } = makeAuth({});
  await assert.rejects(auth.regenerateCodes('Correct-Horse-9'), (err) => err.code === 'session_required');
  assert.equal(calls.length, 0);
});

test('the terms can be read without signing in', async () => {
  const { auth, calls } = makeAuth({
    [`GET ${FUNCTION}/policies`]: json(200, {
      terms: { version: 'v1', title: 'Terms and Conditions', effective_at: '2026-11-22T00:00:00Z' },
      privacy: { version: 'v1', title: 'Privacy Policy', effective_at: '2026-11-22T00:00:00Z' },
    }),
  });
  const policies = await auth.policies();
  assert.equal(policies.terms.version, 'v1');
  assert.equal(calls[0].headers.Authorization, undefined);
});

test('toSession keeps the username and drops any email', () => {
  const session = toSession({ ...tokens('ada_01'), user: { id: 'user-1', username: 'ada_01', email: 'x@y.test' } }, NOW);
  assert.deepEqual(session.user, { id: 'user-1', username: 'ada_01' });
});
