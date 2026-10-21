import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuth, parseAuthCallbackHash } from '../src/auth.js';
import { createSessionStore, isFresh, SESSION_KEY, toSession } from '../src/session.js';

const config = {
  supabaseUrl: 'https://example-project.supabase.co/',
  publishableKey: 'sb_publishable_TEST',
};

// A minimal sessionStorage stand-in. _data lets tests inspect what was saved.
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    _data: data,
  };
}

function tokenBody(overrides = {}) {
  return {
    access_token: 'access-1',
    refresh_token: 'refresh-1',
    expires_in: 3600,
    user: { id: 'owner-1', email: 'owner@example.com' },
    ...overrides,
  };
}

// Answers each request with the next scripted response, and records the request.
// An Error entry is thrown instead, to simulate a network failure.
function scriptedFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const next = queue.shift();
    if (next instanceof Error) throw next;
    const { status = 200, body = null } = next;
    return new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { calls, fetchImpl };
}

test('signIn posts the password to the password grant and keeps the session', async () => {
  const storage = memoryStorage();
  const { calls, fetchImpl } = scriptedFetch([{ body: tokenBody() }]);
  const auth = createAuth({
    config,
    store: createSessionStore(storage),
    fetchImpl,
    nowMs: () => 1_000_000,
  });

  const session = await auth.signIn('owner@example.com', 'correct-horse');

  assert.equal(calls[0].url, 'https://example-project.supabase.co/auth/v1/token?grant_type=password');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.apikey, 'sb_publishable_TEST');
  assert.equal(calls[0].init.headers.Authorization, undefined, 'no user token before sign-in');
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: 'owner@example.com', password: 'correct-horse' });

  assert.equal(session.user.id, 'owner-1');
  assert.equal(session.expires_at, 1000 + 3600);

  const saved = storage._data.get(SESSION_KEY);
  assert.equal(JSON.parse(saved).access_token, 'access-1');
  assert.equal(saved.includes('correct-horse'), false, 'the password is never stored');
});

test('signIn passes on the server message for a wrong password', async () => {
  const { fetchImpl } = scriptedFetch([
    { status: 400, body: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' } },
  ]);
  const auth = createAuth({ config, store: createSessionStore(memoryStorage()), fetchImpl });

  await assert.rejects(auth.signIn('owner@example.com', 'wrong'), (err) => {
    assert.equal(err.message, 'Invalid login credentials');
    assert.equal(err.status, 400);
    assert.equal(err.code, 'invalid_credentials');
    return true;
  });
});

test('signUp reports when the owner must confirm their email first', async () => {
  const storage = memoryStorage();
  const { calls, fetchImpl } = scriptedFetch([{ body: { id: 'owner-2', email: 'new@example.com' } }]);
  const auth = createAuth({ config, store: createSessionStore(storage), fetchImpl });

  const result = await auth.signUp('new@example.com', 'long-password');

  assert.equal(calls[0].url, 'https://example-project.supabase.co/auth/v1/signup');
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: 'new@example.com', password: 'long-password' });
  assert.equal(result.confirmationNeeded, true);
  assert.equal(result.session, null);
  assert.equal(storage._data.has(SESSION_KEY), false, 'no session without confirmation');
});

test('signUp keeps the session when the project signs the owner in straight away', async () => {
  const storage = memoryStorage();
  const { fetchImpl } = scriptedFetch([{ body: tokenBody({ user: { id: 'owner-3', email: 'x@example.com' } }) }]);
  const auth = createAuth({ config, store: createSessionStore(storage), fetchImpl, nowMs: () => 0 });

  const result = await auth.signUp('x@example.com', 'long-password');

  assert.equal(result.confirmationNeeded, false);
  assert.equal(result.session.user.id, 'owner-3');
  assert.equal(storage._data.has(SESSION_KEY), true);
});

test('signUp sends the configured HTTPS callback and never localhost', async () => {
  const { calls, fetchImpl } = scriptedFetch([{ body: { id: 'owner-4', email: 'x@example.com' } }]);
  const auth = createAuth({
    config: { ...config, authRedirectUrl: 'https://printnest.example/' },
    store: createSessionStore(memoryStorage()),
    fetchImpl,
  });

  await auth.signUp('x@example.com', 'long-password');

  assert.deepEqual(JSON.parse(calls[0].init.body), {
    email: 'x@example.com',
    password: 'long-password',
    redirect_to: 'https://printnest.example/',
  });
  assert.equal(JSON.stringify(calls[0].init.body).includes('localhost'), false);
});

test('confirmation callback fetches the user and persists a usable owner session', async () => {
  const storage = memoryStorage();
  const { calls, fetchImpl } = scriptedFetch([
    { body: { id: 'owner-5', email: 'confirmed@example.com' } },
  ]);
  const auth = createAuth({ config, store: createSessionStore(storage), fetchImpl, nowMs: () => 1_000_000 });
  const callback = await auth.consumeCallback(
    '#access_token=access-callback&refresh_token=refresh-callback&expires_in=3600&type=signup'
  );

  assert.equal(callback.session.user.id, 'owner-5');
  assert.equal(calls[0].url, 'https://example-project.supabase.co/auth/v1/user');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer access-callback');
  assert.equal(JSON.parse(storage._data.get(SESSION_KEY)).refresh_token, 'refresh-callback');
});

test('customer and route hashes are not mistaken for auth callbacks', () => {
  assert.deepEqual(parseAuthCallbackHash('#/s/demo-xerox'), { handled: false });
  assert.deepEqual(parseAuthCallbackHash('#/track/ABC123'), { handled: false });
  assert.equal(parseAuthCallbackHash('#error=access_denied&error_description=expired').handled, true);
});

test('a fresh session is reused without any network call', async () => {
  const storage = memoryStorage();
  const store = createSessionStore(storage);
  const signIn = scriptedFetch([{ body: tokenBody() }]);
  await createAuth({ config, store, fetchImpl: signIn.fetchImpl, nowMs: () => 1_000_000 }).signIn('a@b.co', 'pw');

  // A new page load: the auth object reads the saved session.
  const later = scriptedFetch([]);
  const auth = createAuth({ config, store, fetchImpl: later.fetchImpl, nowMs: () => 1_060_000 });
  const session = await auth.getSession();

  assert.equal(session.access_token, 'access-1');
  assert.equal(later.calls.length, 0);
});

test('an expired session is refreshed once, even when two requests ask at the same moment', async () => {
  const storage = memoryStorage();
  const store = createSessionStore(storage);
  const signIn = scriptedFetch([{ body: tokenBody() }]);
  await createAuth({ config, store, fetchImpl: signIn.fetchImpl, nowMs: () => 0 }).signIn('a@b.co', 'pw');

  const refresh = scriptedFetch([
    { body: tokenBody({ access_token: 'access-2', refresh_token: 'refresh-2' }) },
  ]);
  const auth = createAuth({ config, store, fetchImpl: refresh.fetchImpl, nowMs: () => 3_600_000 });
  const [first, second] = await Promise.all([auth.getSession(), auth.getSession()]);

  assert.equal(refresh.calls.length, 1, 'only one refresh request is sent');
  assert.equal(refresh.calls[0].url, 'https://example-project.supabase.co/auth/v1/token?grant_type=refresh_token');
  assert.deepEqual(JSON.parse(refresh.calls[0].init.body), { refresh_token: 'refresh-1' });
  assert.equal(first.access_token, 'access-2');
  assert.equal(second.access_token, 'access-2');
  assert.equal(JSON.parse(storage._data.get(SESSION_KEY)).refresh_token, 'refresh-2');
});

test('a refresh the server rejects signs the owner out', async () => {
  const storage = memoryStorage();
  const store = createSessionStore(storage);
  const signIn = scriptedFetch([{ body: tokenBody() }]);
  await createAuth({ config, store, fetchImpl: signIn.fetchImpl, nowMs: () => 0 }).signIn('a@b.co', 'pw');

  const refresh = scriptedFetch([
    { status: 400, body: { error: 'invalid_grant', error_description: 'Invalid Refresh Token' } },
  ]);
  const auth = createAuth({ config, store, fetchImpl: refresh.fetchImpl, nowMs: () => 3_600_000 });

  assert.equal(await auth.getSession(), null);
  assert.equal(storage._data.has(SESSION_KEY), false);
});

test('a refresh that fails because the network is down keeps the session for a retry', async () => {
  const storage = memoryStorage();
  const store = createSessionStore(storage);
  const signIn = scriptedFetch([{ body: tokenBody() }]);
  await createAuth({ config, store, fetchImpl: signIn.fetchImpl, nowMs: () => 0 }).signIn('a@b.co', 'pw');

  const refresh = scriptedFetch([new TypeError('fetch failed')]);
  const auth = createAuth({ config, store, fetchImpl: refresh.fetchImpl, nowMs: () => 3_600_000 });

  await assert.rejects(auth.getSession(), TypeError);
  assert.equal(storage._data.has(SESSION_KEY), true, 'the owner is not signed out by a dropped connection');
});

test('signOut clears the session even when the server call fails', async () => {
  const storage = memoryStorage();
  const store = createSessionStore(storage);
  const signIn = scriptedFetch([{ body: tokenBody() }]);
  await createAuth({ config, store, fetchImpl: signIn.fetchImpl, nowMs: () => 0 }).signIn('a@b.co', 'pw');

  const logout = scriptedFetch([new TypeError('offline')]);
  const auth = createAuth({ config, store, fetchImpl: logout.fetchImpl, nowMs: () => 1_000 });
  await auth.signOut();

  assert.equal(logout.calls[0].url, 'https://example-project.supabase.co/auth/v1/logout');
  assert.equal(logout.calls[0].init.headers.Authorization, 'Bearer access-1');
  assert.equal(storage._data.has(SESSION_KEY), false);
  assert.equal(await auth.getSession(), null);
});

test('the session store survives blocked or corrupt storage', () => {
  const blocked = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('denied');
    },
    removeItem() {
      throw new Error('denied');
    },
  };
  const store = createSessionStore(blocked);
  assert.equal(store.load(), null);
  assert.doesNotThrow(() => store.save({ access_token: 'x' }));
  assert.doesNotThrow(() => store.clear());

  const corrupt = memoryStorage({ [SESSION_KEY]: '{not json' });
  assert.equal(createSessionStore(corrupt).load(), null);
});

test('toSession refuses a token response without a user', () => {
  assert.throws(() => toSession({ access_token: 'a', refresh_token: 'r' }), /usable session/);
});

test('isFresh keeps a one minute safety margin', () => {
  const session = { access_token: 'a', refresh_token: 'r', expires_at: 1000 };
  assert.equal(isFresh(session, 900_000), true); // 900 s, margin ends at 940 s
  assert.equal(isFresh(session, 950_000), false); // 950 s, past the margin
  assert.equal(isFresh(null, 0), false);
});
