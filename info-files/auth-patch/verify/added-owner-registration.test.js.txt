// Owner accounts: registration with a one-time email code, password sign-in for verified
// owners, unverified accounts, and password recovery. Also the pure helpers that shape
// the owner's messages (logic.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from '../src/auth.js';
import { createSessionStore, SESSION_KEY } from '../src/session.js';
import {
  OTP_RESEND_SECONDS,
  accountErrorMessage,
  isEmailAddress,
  isNewPassword,
  isOtpCode,
  otpErrorMessage,
  resendWaitSeconds,
} from '../src/logic.js';

const config = {
  supabaseUrl: 'https://example-project.supabase.co/',
  publishableKey: 'sb_publishable_TEST',
};

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    _data: data,
  };
}

// Answers each request with the next scripted response and records what was sent.
function scripted(responses) {
  const calls = [];
  const queue = [...responses];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const { status = 200, body = null } = queue.shift();
    return new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { calls, fetchImpl };
}

const sessionBody = {
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  expires_in: 3600,
  user: { id: 'owner-1', email: 'owner@example.com' },
};

function setup(responses, extra = {}) {
  const storage = memoryStorage();
  const { calls, fetchImpl } = scripted(responses);
  const auth = createAuth({
    config: { ...config, ...extra },
    store: createSessionStore(storage),
    fetchImpl,
    nowMs: () => 1_000_000,
  });
  return { auth, storage, calls };
}

// ---------- registration ----------

test('registration sends email and password to signup and emails a code, with no session yet', async () => {
  const { auth, storage, calls } = setup([{ body: { id: 'owner-2', email: 'new@example.com', email_confirmed_at: null } }]);

  const result = await auth.signUp('new@example.com', 'long-password');

  assert.equal(calls[0].url, 'https://example-project.supabase.co/auth/v1/signup');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.apikey, 'sb_publishable_TEST');
  assert.equal(calls[0].init.headers.Authorization, undefined, 'no user token before verification');
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: 'new@example.com', password: 'long-password' });
  assert.equal(result.confirmationNeeded, true);
  assert.equal(storage._data.has(SESSION_KEY), false, 'no session until the code is verified');
});

test('registration refuses a session reply, which would mean verification is switched off', async () => {
  const { auth, storage } = setup([{ body: sessionBody }]);

  await assert.rejects(auth.signUp('owner@example.com', 'long-password'), (err) => {
    assert.equal(err.code, 'confirmation_disabled');
    assert.match(err.message, /Email confirmation is turned off/);
    return true;
  });
  assert.equal(storage._data.has(SESSION_KEY), false, 'an unverified session is never kept');
});

test('registration asks for the HTTPS callback only when one is configured, never localhost', async () => {
  const { auth, calls } = setup([{ body: { id: 'owner-4' } }], { authRedirectUrl: 'https://printnest.example/' });

  await auth.signUp('x@example.com', 'long-password');

  assert.deepEqual(JSON.parse(calls[0].init.body), {
    email: 'x@example.com',
    password: 'long-password',
    redirect_to: 'https://printnest.example/',
  });
});

// ---------- one-time verification ----------

// A small stand-in for Supabase Auth. Like Supabase, it keeps the first password of an
// address that has not been verified, sends a session only for a correct code, and refuses
// password sign-in until the address is verified.
function fakeAuthServer({ code = '123456' } = {}) {
  const accounts = new Map(); // email -> { id, password, confirmed }
  const tokens = new Map(); // access token -> email
  const requests = [];
  let seq = 0;
  const reply = (status, body) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const sessionFor = (email) => {
    seq += 1;
    const access = `access-${seq}`;
    tokens.set(access, email);
    return {
      access_token: access,
      refresh_token: `refresh-${seq}`,
      expires_in: 3600,
      user: { id: accounts.get(email).id, email },
    };
  };
  const fetchImpl = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : {};
    requests.push({ path, method, body });
    if (path === '/auth/v1/signup') {
      if (!accounts.has(body.email)) {
        seq += 1;
        accounts.set(body.email, { id: `owner-${seq}`, password: body.password, confirmed: false });
      } // else the first password is kept, as Supabase does
      return reply(200, { id: accounts.get(body.email).id, email: body.email, email_confirmed_at: null });
    }
    if (path === '/auth/v1/resend') return reply(200, {});
    if (path === '/auth/v1/verify') {
      const account = accounts.get(body.email);
      if (!account || body.token !== code) {
        return reply(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      }
      account.confirmed = true;
      return reply(200, sessionFor(body.email));
    }
    if (path === '/auth/v1/user' && method === 'PUT') {
      const email = tokens.get(String(init.headers?.Authorization ?? '').replace('Bearer ', ''));
      if (!email) return reply(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
      if (String(body.password ?? '').length < 8) {
        return reply(422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 8 characters' });
      }
      accounts.get(email).password = body.password;
      return reply(200, { id: accounts.get(email).id, email });
    }
    if (path === '/auth/v1/token') {
      const account = accounts.get(body.email);
      if (!account || account.password !== body.password) {
        return reply(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      if (!account.confirmed) {
        return reply(400, { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
      }
      return reply(200, sessionFor(body.email));
    }
    return reply(404, { code: 404, error_code: 'not_found', msg: path });
  };
  return { accounts, requests, fetchImpl, expireTokens: () => tokens.clear() };
}

function serverAuth(server) {
  const storage = memoryStorage();
  const auth = createAuth({
    config,
    store: createSessionStore(storage),
    fetchImpl: server.fetchImpl,
    nowMs: () => 1_000_000,
  });
  return { auth, storage };
}

test('a correct registration code proves the address, but nothing is stored until the owner chooses a password', async () => {
  const server = fakeAuthServer();
  const { auth, storage } = serverAuth(server);
  await auth.signUp('owner@example.com', 'first-password');

  const result = await auth.verifySignupCode('owner@example.com', '123456');

  assert.equal(result.verified, true);
  assert.equal(auth.hasPendingSignup(), true);
  assert.equal(storage._data.has(SESSION_KEY), false, 'no session is stored before a password is saved');
  assert.equal(await auth.getSession(), null, 'the owner is not signed in yet');
});

test('the password chosen by the owner is saved, and the owner is then signed in', async () => {
  const server = fakeAuthServer();
  const { auth, storage } = serverAuth(server);
  await auth.signUp('owner@example.com', 'chosen-password');
  await auth.verifySignupCode('owner@example.com', '123456');

  const session = await auth.completeSignup('chosen-password');

  assert.equal(session.user.email, 'owner@example.com');
  assert.equal(auth.hasPendingSignup(), false);
  assert.equal(JSON.parse(storage._data.get(SESSION_KEY)).user.email, 'owner@example.com');
  assert.equal(server.accounts.get('owner@example.com').password, 'chosen-password');
});

test('a repeat registration of an unverified email makes the owner\'s own password the one that works', async () => {
  const server = fakeAuthServer();
  const { auth } = serverAuth(server);
  // Someone else registers the address first, with their own password.
  await auth.signUp('owner@example.com', 'someone-else-password');
  // The real owner registers the same address. Supabase keeps the first password and sends a new code.
  await auth.signUp('owner@example.com', 'owner-password');
  await auth.verifySignupCode('owner@example.com', '123456');
  await auth.completeSignup('owner-password');

  await assert.rejects(auth.signIn('owner@example.com', 'someone-else-password'), (err) => {
    assert.equal(err.code, 'invalid_credentials');
    return true;
  });
  const session = await auth.signIn('owner@example.com', 'owner-password');
  assert.equal(session.user.email, 'owner@example.com');
});

test('a password that cannot be saved keeps the owner signed out, and the owner can try again', async () => {
  const server = fakeAuthServer();
  const { auth, storage } = serverAuth(server);
  await auth.signUp('owner@example.com', 'first-password');
  await auth.verifySignupCode('owner@example.com', '123456');

  await assert.rejects(auth.completeSignup('short'), (err) => {
    assert.equal(err.code, 'weak_password');
    return true;
  });
  assert.equal(storage._data.has(SESSION_KEY), false, 'a failed password save stores no session');
  assert.equal(auth.hasPendingSignup(), true, 'the owner can try again');
  assert.equal(await auth.getSession(), null);

  await auth.completeSignup('long-enough-password');
  assert.equal(auth.hasPendingSignup(), false);
  assert.equal(storage._data.has(SESSION_KEY), true);
});

test('a confirmation that has expired ends safely: no session, and no further requests are sent', async () => {
  const server = fakeAuthServer();
  const { auth, storage } = serverAuth(server);
  await auth.signUp('owner@example.com', 'first-password');
  await auth.verifySignupCode('owner@example.com', '123456');
  server.expireTokens();

  await assert.rejects(auth.completeSignup('long-enough-password'), (err) => {
    assert.equal(err.code, 'signup_expired');
    assert.match(err.message, /Forgot password/);
    assert.match(err.message, /email is confirmed/);
    return true;
  });
  assert.equal(auth.hasPendingSignup(), false);
  assert.equal(storage._data.has(SESSION_KEY), false);

  const sent = server.requests.length;
  await assert.rejects(auth.completeSignup('long-enough-password'), (err) => err.code === 'signup_expired');
  assert.equal(server.requests.length, sent, 'nothing is sent once the confirmation has ended');
});

test('completeSignup with no confirmation in progress sends nothing and stores nothing', async () => {
  const server = fakeAuthServer();
  const { auth, storage } = serverAuth(server);

  await assert.rejects(auth.completeSignup('long-enough-password'), (err) => err.code === 'signup_expired');
  assert.equal(server.requests.length, 0);
  assert.equal(storage._data.has(SESSION_KEY), false);
});

test('an unverified owner cannot sign in with the password until the code is accepted', async () => {
  const server = fakeAuthServer();
  const { auth, storage } = serverAuth(server);
  await auth.signUp('owner@example.com', 'owner-password');

  await assert.rejects(auth.signIn('owner@example.com', 'owner-password'), (err) => {
    assert.equal(err.code, 'email_not_confirmed');
    return true;
  });
  assert.equal(storage._data.has(SESSION_KEY), false);
});

test('signing out drops a confirmation that has not finished', async () => {
  const server = fakeAuthServer();
  const { auth } = serverAuth(server);
  await auth.signUp('owner@example.com', 'owner-password');
  await auth.verifySignupCode('owner@example.com', '123456');

  await auth.signOut();

  assert.equal(auth.hasPendingSignup(), false);
  assert.equal(await auth.getSession(), null);
});

test('a confirmation link saves the chosen password before the owner is signed in', async () => {
  const { calls, fetchImpl } = scripted([
    { body: { id: 'owner-9', email: 'link@example.com' } }, // GET /auth/v1/user with the link's token
    { body: { id: 'owner-9', email: 'link@example.com' } }, // PUT /auth/v1/user with the chosen password
  ]);
  const storage = memoryStorage();
  const auth = createAuth({ config, store: createSessionStore(storage), fetchImpl, nowMs: () => 1_000_000 });

  const callback = await auth.consumeCallback(
    '#access_token=access-link&refresh_token=refresh-link&expires_in=3600&type=signup'
  );

  assert.equal(callback.pending, true);
  assert.equal(storage._data.has(SESSION_KEY), false, 'no session before a password is saved');

  await auth.completeSignup('link-password');

  assert.equal(calls[1].init.method, 'PUT');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer access-link');
  assert.deepEqual(JSON.parse(calls[1].init.body), { password: 'link-password' });
  assert.equal(JSON.parse(storage._data.get(SESSION_KEY)).refresh_token, 'refresh-link');
});

test('a wrong or expired registration code is refused and stores no session', async () => {
  const { auth, storage } = setup([
    { status: 403, body: { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' } },
  ]);

  await assert.rejects(auth.verifySignupCode('owner@example.com', '000000'), (err) => {
    assert.equal(err.status, 403);
    assert.equal(err.code, 'otp_expired');
    return true;
  });
  assert.equal(storage._data.has(SESSION_KEY), false);
});

test('resend asks Supabase for a new registration code and keeps no session', async () => {
  const { auth, storage, calls } = setup([{ body: {} }]);

  await auth.resendSignupCode('owner@example.com');

  assert.equal(calls[0].url, 'https://example-project.supabase.co/auth/v1/resend');
  assert.deepEqual(JSON.parse(calls[0].init.body), { type: 'signup', email: 'owner@example.com' });
  assert.equal(storage._data.has(SESSION_KEY), false);
});

// ---------- password sign-in ----------

test('password sign-in for a verified owner uses the password grant only, with no code', async () => {
  const { auth, calls } = setup([{ body: sessionBody }]);

  const session = await auth.signIn('owner@example.com', 'long-password');

  assert.equal(calls.length, 1, 'one request, no code step');
  assert.equal(calls[0].url, 'https://example-project.supabase.co/auth/v1/token?grant_type=password');
  assert.equal(session.user.id, 'owner-1');
});

test('an unverified owner is refused at password sign-in with code email_not_confirmed, and no session is kept', async () => {
  const { auth, storage } = setup([
    { status: 400, body: { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' } },
  ]);

  await assert.rejects(auth.signIn('new@example.com', 'long-password'), (err) => {
    assert.equal(err.status, 400);
    assert.equal(err.code, 'email_not_confirmed');
    return true;
  });
  assert.equal(storage._data.has(SESSION_KEY), false);
});

test('a wrong password is refused without a session, whether or not the account is verified', async () => {
  const { auth, storage } = setup([
    { status: 400, body: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' } },
  ]);

  await assert.rejects(auth.signIn('owner@example.com', 'wrong'), (err) => {
    assert.equal(err.code, 'invalid_credentials');
    return true;
  });
  assert.equal(storage._data.has(SESSION_KEY), false);
});

// ---------- password recovery (unchanged flow) ----------

test('password recovery sends the reset email request and keeps no session', async () => {
  const { auth, storage, calls } = setup([{ body: {} }], { authRedirectUrl: 'https://printnest.example/' });

  await auth.recoverPassword('owner@example.com');

  assert.equal(calls[0].url, 'https://example-project.supabase.co/auth/v1/recover');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    email: 'owner@example.com',
    redirect_to: 'https://printnest.example/',
  });
  assert.equal(storage._data.has(SESSION_KEY), false);
});

test('a recovery link opens the reset step with a session, reported as type recovery', async () => {
  // The callback fetches the user (GET /auth/v1/user) with the access token, which returns the user object.
  const { auth, storage } = setup([{ body: { id: 'owner-1', email: 'owner@example.com' } }]);

  const result = await auth.consumeCallback(
    '#access_token=access-1&refresh_token=refresh-1&type=recovery&expires_in=3600'
  );

  assert.equal(result.handled, true);
  assert.equal(result.type, 'recovery');
  assert.equal(result.session.user.id, 'owner-1');
  assert.equal(JSON.parse(storage._data.get(SESSION_KEY)).access_token, 'access-1');
});

// ---------- helpers that shape the owner's messages ----------

test('the resend cooldown counts down from the last send and reaches zero', () => {
  const sent = 1_000_000;
  assert.equal(OTP_RESEND_SECONDS, 60);
  assert.equal(resendWaitSeconds(0, sent), 0, 'no code sent yet');
  assert.equal(resendWaitSeconds(sent, sent), 60);
  assert.equal(resendWaitSeconds(sent, sent + 1_000), 59);
  assert.equal(resendWaitSeconds(sent, sent + 59_500), 1, 'part of a second still counts as a wait');
  assert.equal(resendWaitSeconds(sent, sent + 60_000), 0);
});

test('input checks: codes are 6 to 10 digits, emails need an @ and a domain, passwords need 8 characters', () => {
  assert.equal(isOtpCode(' 123456 '), true);
  assert.equal(isOtpCode('12345'), false);
  assert.equal(isOtpCode('12a456'), false);
  assert.equal(isEmailAddress('owner@example.com'), true);
  assert.equal(isEmailAddress('owner@example'), false);
  assert.equal(isNewPassword('1234567'), false);
  assert.equal(isNewPassword('12345678'), true);
});

test('otpErrorMessage: a wrong code, a rate limit, a network failure and a server fault each get their own message', () => {
  assert.match(otpErrorMessage(Object.assign(new Error('expired'), { status: 403 }), 'verify'), /not right or has expired/);
  assert.match(otpErrorMessage(Object.assign(new Error('x'), { status: 429 }), 'verify'), /Wait a few minutes/);
  assert.match(otpErrorMessage(Object.assign(new Error('x'), { status: 429 }), 'resend'), /Wait a minute/);
  assert.match(otpErrorMessage(new TypeError('Failed to fetch'), 'verify'), /internet connection/);
  assert.equal(otpErrorMessage(Object.assign(new Error('Sign in failed (500)'), { status: 500 }), 'verify'), 'Sign in failed (500)');
});

test('accountErrorMessage explains a wrong password, an existing account, closed sign-up and a weak password', () => {
  assert.equal(
    accountErrorMessage(Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials' })),
    'That email and password do not match an account.'
  );
  assert.match(
    accountErrorMessage(Object.assign(new Error('User already registered'), { code: 'user_already_exists' })),
    /Sign in with your password instead/
  );
  assert.match(accountErrorMessage(Object.assign(new Error('Signups not allowed for this instance'), { code: 'signup_disabled' })), /cannot be created right now/);
  assert.match(accountErrorMessage(Object.assign(new Error('weak'), { code: 'weak_password' })), /harder to guess/);
  assert.match(accountErrorMessage(new TypeError('Failed to fetch')), /internet connection/);
});
