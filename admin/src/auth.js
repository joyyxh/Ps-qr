// Password sign-in, TOTP (aal2) and session handling through Supabase Auth. Only the publishable key is
// used. Tokens are held in memory by app.js and are never written to storage or to a URL.
//
// The aal2 check here only decides which screen to show. Every admin RPC checks the aal2 claim on the
// server, and a missing or insufficient claim is refused there (AAL2 decision, STAGE7_DECISIONS.md §12A.8).

import { decodeJwtPayload, fetchWithTimeout, readJson } from './http.js';

export class AuthError extends Error {
  constructor(message, kind = 'failed') {
    super(message);
    this.name = 'AuthError';
    this.kind = kind; // 'failed' (refused) or 'network'
  }
}

export function assuranceLevel(accessToken) {
  const claims = decodeJwtPayload(accessToken);
  return claims && typeof claims.aal === 'string' ? claims.aal : null;
}

// Decides the next screen. Fails closed: only an aal2 claim unlocks the dashboard.
export function nextAuthStep({ accessToken, factors }) {
  if (!accessToken) return 'signed_out';
  if (assuranceLevel(accessToken) === 'aal2') return 'ready';
  const hasVerifiedTotp = Array.isArray(factors)
    && factors.some((f) => f && f.factor_type === 'totp' && f.status === 'verified');
  return hasVerifiedTotp ? 'verify_totp' : 'enrol_totp';
}

export function needsRefresh(expiresAtSeconds, nowSeconds, skewSeconds = 60) {
  return typeof expiresAtSeconds !== 'number' || expiresAtSeconds - nowSeconds <= skewSeconds;
}

function authUrl(config, path) {
  return `${config.supabaseUrl}/auth/v1/${path}`;
}

function headers(config, accessToken) {
  const h = { apikey: config.publishableKey, 'content-type': 'application/json', accept: 'application/json' };
  if (accessToken) h.authorization = `Bearer ${accessToken}`;
  return h;
}

async function send(fetchImpl, url, init) {
  try {
    return await fetchWithTimeout(fetchImpl, url, { credentials: 'omit', cache: 'no-store', ...init });
  } catch {
    throw new AuthError('Could not reach the sign-in service. Try again.', 'network');
  }
}

function toSession(body) {
  if (!body || typeof body.access_token !== 'string') return null;
  const expiresAt = typeof body.expires_at === 'number'
    ? body.expires_at
    : Math.floor(Date.now() / 1000) + Number(body.expires_in ?? 3600);
  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
    expiresAt,
  };
}

export async function signInWithPassword({ config, fetchImpl, email, password }) {
  const response = await send(fetchImpl, authUrl(config, 'token?grant_type=password'), {
    method: 'POST',
    headers: headers(config),
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new AuthError('Sign-in failed. Check the email and password.');
  const session = toSession(await readJson(response));
  if (!session) throw new AuthError('Sign-in failed. Check the email and password.');
  return session;
}

export async function refreshSession({ config, fetchImpl, refreshToken }) {
  const response = await send(fetchImpl, authUrl(config, 'token?grant_type=refresh_token'), {
    method: 'POST',
    headers: headers(config),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) throw new AuthError('Your session has ended. Sign in again.');
  const session = toSession(await readJson(response));
  if (!session) throw new AuthError('Your session has ended. Sign in again.');
  return session;
}

export async function getUserWithFactors({ config, fetchImpl, accessToken }) {
  const response = await send(fetchImpl, authUrl(config, 'user'), {
    method: 'GET',
    headers: headers(config, accessToken),
  });
  if (!response.ok) throw new AuthError('Your session has ended. Sign in again.');
  const body = (await readJson(response)) ?? {};
  return {
    email: typeof body.email === 'string' ? body.email : '',
    factors: Array.isArray(body.factors) ? body.factors : [],
  };
}

// Starts TOTP enrolment. The returned QR code and secret are shown once, to the admin, for their app.
export async function enrolTotp({ config, fetchImpl, accessToken }) {
  const response = await send(fetchImpl, authUrl(config, 'factors'), {
    method: 'POST',
    headers: headers(config, accessToken),
    body: JSON.stringify({ factor_type: 'totp', friendly_name: 'QRquick admin', issuer: 'QRquick' }),
  });
  if (!response.ok) throw new AuthError('Could not start authenticator setup. Try again.');
  const body = (await readJson(response)) ?? {};
  const totp = body.totp ?? {};
  if (typeof body.id !== 'string') throw new AuthError('Could not start authenticator setup. Try again.');
  return {
    factorId: body.id,
    qrCode: typeof totp.qr_code === 'string' ? totp.qr_code : '',
    secret: typeof totp.secret === 'string' ? totp.secret : '',
  };
}

async function challenge({ config, fetchImpl, accessToken, factorId }) {
  const response = await send(fetchImpl, authUrl(config, `factors/${encodeURIComponent(factorId)}/challenge`), {
    method: 'POST',
    headers: headers(config, accessToken),
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new AuthError('Could not send the authenticator challenge. Try again.');
  const body = (await readJson(response)) ?? {};
  if (typeof body.id !== 'string') throw new AuthError('Could not send the authenticator challenge. Try again.');
  return body.id;
}

// Verifies a six-digit code. On success the returned session carries aal2.
export async function verifyTotp({ config, fetchImpl, accessToken, factorId, code }) {
  const challengeId = await challenge({ config, fetchImpl, accessToken, factorId });
  const response = await send(fetchImpl, authUrl(config, `factors/${encodeURIComponent(factorId)}/verify`), {
    method: 'POST',
    headers: headers(config, accessToken),
    body: JSON.stringify({ challenge_id: challengeId, code: String(code).trim() }),
  });
  if (!response.ok) throw new AuthError('The code was not accepted. Check the code and try again.');
  const session = toSession(await readJson(response));
  if (!session) throw new AuthError('The code was not accepted. Check the code and try again.');
  return session;
}

export async function signOut({ config, fetchImpl, accessToken }) {
  if (!accessToken) return;
  try {
    await send(fetchImpl, authUrl(config, 'logout'), { method: 'POST', headers: headers(config, accessToken) });
  } catch {
    // Best effort. The panel clears its memory regardless.
  }
}
