import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthError,
  assuranceLevel,
  enrolTotp,
  getUserWithFactors,
  nextAuthStep,
  needsRefresh,
  signInWithPassword,
  verifyTotp,
} from '../src/auth.js';
import { decodeJwtPayload, fetchWithTimeout } from '../src/http.js';

const CONFIG = { supabaseUrl: 'https://project-ref.supabase.co', publishableKey: 'sb_publishable_example_only' };

// An unsigned token. The panel reads claims for display and the aal check only. The server verifies signatures.
function token(claims) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.signature-not-checked-here`;
}
const AAL1 = token({ sub: 'admin-1', aal: 'aal1', exp: 9999999999 });
const AAL2 = token({ sub: 'admin-1', aal: 'aal2', exp: 9999999999 });
const TOTP_VERIFIED = [{ id: 'f1', factor_type: 'totp', status: 'verified' }];
const TOTP_UNVERIFIED = [{ id: 'f1', factor_type: 'totp', status: 'unverified' }];

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function recorder(handler) {
  const calls = [];
  return {
    calls,
    fn: async (url, init) => {
      calls.push({ url, init });
      return handler(url, init);
    },
  };
}

test('decodeJwtPayload reads base64url claims and returns null for anything else', () => {
  assert.equal(assuranceLevel(AAL2), 'aal2');
  assert.equal(assuranceLevel(AAL1), 'aal1');
  assert.equal(decodeJwtPayload('not a token'), null);
  assert.equal(decodeJwtPayload(''), null);
  assert.equal(decodeJwtPayload(undefined), null);
});

test('a token without an aal claim is not aal2 (fails closed)', () => {
  assert.equal(assuranceLevel(token({ sub: 'x' })), null);
  assert.equal(nextAuthStep({ accessToken: token({ sub: 'x' }), factors: TOTP_VERIFIED }), 'verify_totp');
});

test('nextAuthStep: only aal2 reaches the dashboard', () => {
  assert.equal(nextAuthStep({ accessToken: null, factors: [] }), 'signed_out');
  assert.equal(nextAuthStep({ accessToken: AAL2, factors: [] }), 'ready');
  assert.equal(nextAuthStep({ accessToken: AAL2, factors: TOTP_UNVERIFIED }), 'ready');
  assert.equal(nextAuthStep({ accessToken: AAL1, factors: TOTP_VERIFIED }), 'verify_totp');
  assert.equal(nextAuthStep({ accessToken: AAL1, factors: TOTP_UNVERIFIED }), 'enrol_totp');
  assert.equal(nextAuthStep({ accessToken: AAL1, factors: [] }), 'enrol_totp');
  assert.equal(nextAuthStep({ accessToken: AAL1, factors: [{ id: 'p', factor_type: 'phone', status: 'verified' }] }), 'enrol_totp');
});

test('needsRefresh refreshes within the skew window and when expiry is unknown', () => {
  assert.equal(needsRefresh(1000, 900), false);
  assert.equal(needsRefresh(1000, 950), true);
  assert.equal(needsRefresh(undefined, 0), true);
});

test('sign-in posts the password once to the password grant, with the publishable key only', async () => {
  const rec = recorder(() => json(200, { access_token: AAL1, refresh_token: 'r1', expires_in: 3600 }));
  const session = await signInWithPassword({ config: CONFIG, fetchImpl: rec.fn, email: 'admin@example.test', password: 'pw' });
  assert.equal(session.accessToken, AAL1);
  assert.equal(session.refreshToken, 'r1');
  assert.equal(rec.calls[0].url, 'https://project-ref.supabase.co/auth/v1/token?grant_type=password');
  assert.equal(rec.calls[0].init.headers.apikey, 'sb_publishable_example_only');
  assert.equal(rec.calls[0].init.headers.authorization, undefined, 'no bearer on sign-in');
  assert.equal(rec.calls[0].url.includes('pw'), false, 'password never in the URL');
});

test('a refused sign-in gives a generic message, and a network failure says nothing was sent', async () => {
  const refused = recorder(() => json(400, { error: 'invalid_grant' }));
  await assert.rejects(
    signInWithPassword({ config: CONFIG, fetchImpl: refused.fn, email: 'a@b.test', password: 'x' }),
    (e) => e instanceof AuthError && e.message === 'Sign-in failed. Check the email and password.',
  );
  const down = recorder(() => { throw new TypeError('offline'); });
  await assert.rejects(
    signInWithPassword({ config: CONFIG, fetchImpl: down.fn, email: 'a@b.test', password: 'x' }),
    (e) => e instanceof AuthError && e.kind === 'network',
  );
});

test('user lookup returns the email and factors', async () => {
  const rec = recorder(() => json(200, { email: 'admin@example.test', factors: TOTP_VERIFIED }));
  const user = await getUserWithFactors({ config: CONFIG, fetchImpl: rec.fn, accessToken: AAL1 });
  assert.equal(user.email, 'admin@example.test');
  assert.deepEqual(user.factors, TOTP_VERIFIED);
  assert.equal(rec.calls[0].url, 'https://project-ref.supabase.co/auth/v1/user');
  assert.equal(rec.calls[0].init.headers.authorization, `Bearer ${AAL1}`);
});

test('TOTP enrolment returns the factor ID and setup material without storing it', async () => {
  const rec = recorder(() => json(200, { id: 'f9', totp: { qr_code: '<svg></svg>', secret: 'ABC123' } }));
  const out = await enrolTotp({ config: CONFIG, fetchImpl: rec.fn, accessToken: AAL1 });
  assert.deepEqual(out, { factorId: 'f9', qrCode: '<svg></svg>', secret: 'ABC123' });
  assert.equal(rec.calls[0].url, 'https://project-ref.supabase.co/auth/v1/factors');
  assert.equal(JSON.parse(rec.calls[0].init.body).factor_type, 'totp');
});

test('TOTP verification runs challenge then verify and returns the aal2 session', async () => {
  const rec = recorder((url) => {
    if (url.endsWith('/challenge')) return json(200, { id: 'c1' });
    return json(200, { access_token: AAL2, refresh_token: 'r2', expires_in: 3600 });
  });
  const session = await verifyTotp({ config: CONFIG, fetchImpl: rec.fn, accessToken: AAL1, factorId: 'f1', code: ' 123456 ' });
  assert.equal(assuranceLevel(session.accessToken), 'aal2');
  assert.equal(rec.calls[0].url, 'https://project-ref.supabase.co/auth/v1/factors/f1/challenge');
  assert.equal(rec.calls[1].url, 'https://project-ref.supabase.co/auth/v1/factors/f1/verify');
  assert.deepEqual(JSON.parse(rec.calls[1].init.body), { challenge_id: 'c1', code: '123456' });
});

test('a rejected TOTP code gives a generic message', async () => {
  const rec = recorder((url) => (url.endsWith('/challenge') ? json(200, { id: 'c1' }) : json(400, {})));
  await assert.rejects(
    verifyTotp({ config: CONFIG, fetchImpl: rec.fn, accessToken: AAL1, factorId: 'f1', code: '000000' }),
    (e) => e instanceof AuthError && /not accepted/.test(e.message),
  );
});

test('fetchWithTimeout aborts a request that takes too long', async () => {
  const hang = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  await assert.rejects(fetchWithTimeout(hang, 'https://example.test/', {}, 20), /aborted/);
});
