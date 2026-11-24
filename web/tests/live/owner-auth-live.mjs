// Owner sign-in and recovery, checked against the REAL qrquick-staging backend. Plain Node 22, no packages.
//
// Runs in CI only (.github/workflows/owner-auth-staging.yml). It refuses to run unless the Supabase URL is
// the staging project and the key is a publishable key. It never uses a service-role key.
//
// It proves what the sandbox cannot: that GoTrue accepts the internal .invalid address that username
// accounts are created with (blocker B2), and that sign-up, duplicate refusal, sign-in, reset, regenerated
// codes and the rate limits behave on the server as the unit tests say they should.
//
// It creates throwaway accounts named qa_live_<random> on staging. It never prints a password, a token
// or a recovery code. Each run leaves its accounts in place; they are QA rows on the staging project only.
//
// Environment:
//   STAGING_SUPABASE_URL      https://nbzojqlqkrydcjtogwrb.supabase.co
//   STAGING_PUBLISHABLE_KEY   sb_publishable_...

import { randomBytes } from 'node:crypto';

const STAGING_HOST = 'nbzojqlqkrydcjtogwrb.supabase.co';
const rawUrl = process.env.STAGING_SUPABASE_URL || '';
const key = process.env.STAGING_PUBLISHABLE_KEY || '';

function refuse(message) {
  console.error(`refused: ${message}`);
  process.exit(2);
}
let parsed;
try {
  parsed = new URL(rawUrl);
} catch {
  refuse('STAGING_SUPABASE_URL is not a URL');
}
if (parsed.protocol !== 'https:' || parsed.hostname !== STAGING_HOST || parsed.pathname !== '/') {
  refuse(`STAGING_SUPABASE_URL must be https://${STAGING_HOST} (the staging project only)`);
}
if (!key.startsWith('sb_publishable_')) refuse('STAGING_PUBLISHABLE_KEY must be a publishable key (sb_publishable_...)');

const BASE = `${parsed.origin}/functions/v1/owner-auth`;
const CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}(-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}){3}$/;
const hex = (bytes) => randomBytes(bytes).toString('hex');

const results = [];
function check(name, ok, detail = '') {
  results.push(Boolean(ok));
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? ` (${detail})` : ''}`);
}

// Returns the HTTP status and the parsed JSON body. Details printed from here never contain a token or a code.
async function call(action, { method = 'POST', body, token } = {}) {
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/${action}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}
const codeOf = (r) => `${r.status} ${r.data?.code ?? 'no code'}`;

async function main() {
  const username = `qa_live_${hex(5)}`;
  const password = `Live-${hex(6)}-Strong9`;
  const newPassword = `Reset-${hex(6)}-Strong9`;

  // 1. Public version list
  const policies = await call('policies', { method: 'GET' });
  const terms = policies.data?.terms?.version;
  const privacy = policies.data?.privacy?.version;
  check('policies answer with the current terms and privacy versions', policies.status === 200 && terms && privacy, codeOf(policies));
  if (!terms || !privacy) return;
  const accept = { terms, privacy };

  // 2. Sign-up refusals, before any account exists
  const noTerms = await call('signup', { body: { username, password } });
  check('sign-up without accepting the terms is refused (terms_required)', noTerms.status === 400 && noTerms.data?.code === 'terms_required', codeOf(noTerms));
  const weak = await call('signup', { body: { username, password: 'short', accept } });
  check('a weak password is refused on the server (weak_password)', weak.status === 400 && weak.data?.code === 'weak_password', codeOf(weak));
  const reserved = await call('signup', { body: { username: 'admin', password, accept } });
  check('a reserved username is refused (username_reserved)', reserved.status === 400 && reserved.data?.code === 'username_reserved', codeOf(reserved));

  // 3. The account itself: this is where GoTrue must accept the internal .invalid address (blocker B2)
  const made = await call('signup', { body: { username, password, accept } });
  check(
    'sign-up creates the account and returns ten recovery codes and a session (GoTrue accepts the .invalid address)',
    made.status === 201 && Array.isArray(made.data?.recovery_codes) && made.data.recovery_codes.length === 10 && typeof made.data?.session?.access_token === 'string',
    codeOf(made)
  );
  if (made.status !== 201) return;
  const codes = made.data.recovery_codes;
  check(
    'ten recovery codes, each in the agreed format, all different',
    codes.every((code) => CODE_PATTERN.test(code)) && new Set(codes).size === 10
  );

  const dup = await call('signup', { body: { username, password, accept } });
  check('the same username cannot be taken twice (username_taken)', dup.status === 409 && dup.data?.code === 'username_taken', codeOf(dup));

  // A public email sign-up must fail (migration 0022 refuses any auth.users row that is not an owner username
  // with owner_flow). Both probes are refused as a whole, so no account is left behind if the guard holds.
  // A success status (below 400) would mean an account was created, and fails the check.
  for (const address of [`qa_probe_${hex(4)}@example.com`, `qa_probe_${hex(4)}@accounts.qrquick.invalid`]) {
    const publicRes = await fetch(`${parsed.origin}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: address, password }),
      signal: AbortSignal.timeout(30_000),
    });
    const label = address.endsWith('.invalid') ? 'an owner-style address' : 'a real address';
    check(`a public email sign-up with ${label} is refused`, publicRes.status >= 400, `HTTP ${publicRes.status}`);
  }

  // 4. Sign-in
  const wrong = await call('signin', { body: { username, password: 'Wrong-Horse-99' } });
  check('a wrong password gets the generic message (invalid_credentials)', wrong.status === 401 && wrong.data?.code === 'invalid_credentials', codeOf(wrong));
  const right = await call('signin', { body: { username, password } });
  check('the right password signs in and returns the username and a session', right.status === 200 && right.data?.username === username && typeof right.data?.session?.access_token === 'string', codeOf(right));

  // 5. Recovery with a code, then the codes from before the reset are gone
  const reset = await call('reset', { body: { username, recovery_code: codes[0], new_password: newPassword } });
  check(
    'a recovery code and a new password reset the account and return ten new codes',
    reset.status === 200 && Array.isArray(reset.data?.recovery_codes) && reset.data.recovery_codes.length === 10 && typeof reset.data?.session?.access_token === 'string',
    codeOf(reset)
  );
  const stale = await call('reset', { body: { username, recovery_code: codes[1], new_password: newPassword } });
  check('a code from before the reset no longer works (reset_failed)', stale.status === 401 && stale.data?.code === 'reset_failed', codeOf(stale));
  const oldPassword = await call('signin', { body: { username, password } });
  check('the old password is refused after the reset', oldPassword.status === 401 && oldPassword.data?.code === 'invalid_credentials', codeOf(oldPassword));
  const newIn = await call('signin', { body: { username, password: newPassword } });
  check('the new password signs in', newIn.status === 200 && typeof newIn.data?.session?.access_token === 'string', codeOf(newIn));

  // 6. Making new codes from the Security page needs a session and the current password
  const noSession = await call('codes/regenerate', { body: { current_password: newPassword } });
  check('making new codes without a session is refused (session_required)', noSession.status === 401 && noSession.data?.code === 'session_required', codeOf(noSession));
  const token = newIn.data?.session?.access_token;
  const badPw = await call('codes/regenerate', { body: { current_password: 'Wrong-Horse-99' }, token });
  check('making new codes with the wrong password is refused (password_incorrect)', badPw.status === 401 && badPw.data?.code === 'password_incorrect', codeOf(badPw));
  const regen = await call('codes/regenerate', { body: { current_password: newPassword }, token });
  check('making new codes with the right password returns ten codes', regen.status === 200 && Array.isArray(regen.data?.recovery_codes) && regen.data.recovery_codes.length === 10, codeOf(regen));

  // 7. Repeated wrong sign-ins are rate limited, on this throwaway account only
  let limitedAt = 0;
  for (let attempt = 1; attempt <= 25 && !limitedAt; attempt += 1) {
    const r = await call('signin', { body: { username, password: `Nope-${attempt}-Wrong9` } });
    if (r.status === 429 && r.data?.code === 'rate_limited') limitedAt = attempt;
  }
  check(`repeated wrong sign-ins are rate limited${limitedAt ? ` (from attempt ${limitedAt})` : ''}`, limitedAt > 0, 'no 429 in 25 attempts');
  console.log(`note: throwaway accounts named ${username} were created on staging and left in place.`);
}

try {
  await main();
} catch (err) {
  check('the run finished without a network or code error', false, err.message.split('\n')[0]);
}

const passed = results.filter(Boolean).length;
console.log(`${passed} of ${results.length} checks passed.`);
process.exitCode = passed === results.length && results.length > 0 ? 0 : 1;
