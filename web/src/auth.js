// Email and password sign-in through Supabase Auth. Uses only the publishable
// key. The password is sent once, to Supabase, and is never stored in the
// browser. Only the session tokens are kept (see session.js).

import { apiError, readJson } from './http.js';
import { isFresh, toSession } from './session.js';

// Responses that mean the refresh token itself is no longer accepted.
// Any other failure (for example no network) keeps the session for a retry.
const REJECTED_REFRESH_STATUSES = [400, 401, 403];

// Supabase's email-confirmation link returns the access and refresh tokens in
// the URL fragment. Keep this parser separate from the hash router: a token
// fragment starts with `#access_token=`, while application routes start with
// `#/owner` or `#/s/...`.
export function parseAuthCallbackHash(hash) {
  const raw = String(hash ?? '');
  if (!raw.startsWith('#') || raw.startsWith('#/')) return { handled: false };
  const params = new URLSearchParams(raw.slice(1));
  if (!params.has('access_token') && !params.has('error')) return { handled: false };

  const error = params.get('error_description') || params.get('error');
  if (error) return { handled: true, error: new Error(error) };

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) {
    return { handled: true, error: new Error('The confirmation link is incomplete or has expired.') };
  }
  return {
    handled: true,
    type: params.get('type') || '',
    tokenResponse: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: Number(params.get('expires_in') || 3600),
    },
  };
}

function authRedirectUrl(config, location = globalThis.location) {
  const configured = String(config?.authRedirectUrl ?? '').trim() || String(config?.publicBaseUrl ?? '').trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
        url.hash = '';
        return url.toString().replace(/\/$/, '') + '/';
      }
    } catch {
      // Fall through to the current-page HTTPS check.
    }
  }
  if (location?.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    return `${location.origin}${location.pathname}`.replace(/#.*$/, '');
  }
  return '';
}

export function createAuth({ config, store, fetchImpl = globalThis.fetch, nowMs = () => Date.now() }) {
  const base = config.supabaseUrl.replace(/\/$/, '');
  let session = store.load();
  let refreshing = null;
  // The session of a verified registration, held in memory only until the owner's
  // password is saved (completeSignup). It is never stored, and getSession never returns it.
  let pendingSignup = null;

  async function call(path, body, accessToken = null) {
    const headers = { apikey: config.publishableKey, 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetchImpl(`${base}/auth/v1/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
    });
    const data = await readJson(response);
    if (!response.ok) throw apiError(response, data, 'Sign in failed');
    return data;
  }

  async function currentUser(accessToken) {
    const response = await fetchImpl(`${base}/auth/v1/user`, {
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` },
    });
    const data = await readJson(response);
    if (!response.ok) throw apiError(response, data, 'The confirmation link is no longer valid');
    return data;
  }

  // Sets the password of the account behind an access token. Used by password
  // recovery and by registration, which saves the password the owner chose.
  async function putPassword(accessToken, password) {
    const response = await fetchImpl(`${base}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    const data = await readJson(response);
    if (!response.ok) throw apiError(response, data, 'Password update failed');
    return data;
  }

  function remember(next) {
    session = next;
    if (next) {
      store.save(next);
    } else {
      store.clear();
    }
    return next;
  }

  async function refresh() {
    if (!refreshing) {
      const refreshToken = session.refresh_token;
      refreshing = (async () => {
        try {
          const data = await call('token?grant_type=refresh_token', { refresh_token: refreshToken });
          return remember(toSession(data, nowMs()));
        } catch (err) {
          if (REJECTED_REFRESH_STATUSES.includes(err.status)) return remember(null);
          throw err;
        } finally {
          refreshing = null;
        }
      })();
    }
    return refreshing;
  }

  return {
    // Registers an owner with email and password. Supabase emails a one-time
    // code (and a link) to confirm the address. The owner must enter the code
    // before any session exists, so the reply never carries a session here.
    // A session in the reply means email confirmation is switched off for the
    // project. The owner would then skip verification, so refuse and keep nothing.
    async signUp(email, password) {
      const redirect = authRedirectUrl(config);
      const body = { email, password };
      // Do not send localhost or a Capacitor origin to Supabase. When this is
      // a deployed HTTPS page, the current page is a safe fallback; the APK
      // receives the deployed URL through PRINTNEST_PUBLIC_URL.
      if (redirect) body.redirect_to = redirect;
      const data = await call('signup', body);
      if (data?.access_token) {
        const error = new Error(
          'Email confirmation is turned off for this project, so no verification code is sent. Ask QRquick to turn it on.'
        );
        error.code = 'confirmation_disabled';
        throw error;
      }
      return { confirmationNeeded: true, session: null };
    },

    // Checks the code from the registration email. A correct code proves the
    // address, but the owner has not chosen a password yet. The session is kept in
    // memory only, and nothing is stored, until completeSignup saves the password.
    // A wrong or expired code is refused with a 4xx status.
    async verifySignupCode(email, token) {
      const data = await call('verify', { type: 'signup', email, token });
      pendingSignup = toSession(data, nowMs());
      return { verified: true };
    },

    // True while a verified owner still has to choose a password.
    hasPendingSignup() {
      return pendingSignup !== null;
    },

    // Drops a verified sign-up that is not finished, for example when the owner
    // chooses Forgot password instead.
    abandonSignup() {
      pendingSignup = null;
    },

    // Saves the password the owner chose, then opens the account. Supabase keeps the
    // first password of an address that was never verified, so this step is what
    // makes the owner's own password the one that works. If the password cannot be
    // saved, nothing is stored and the owner stays signed out.
    async completeSignup(password) {
      if (!pendingSignup) {
        const error = new Error('Your confirmation has ended. Use Forgot password to choose a password.');
        error.code = 'signup_expired';
        throw error;
      }
      const pending = pendingSignup;
      try {
        await putPassword(pending.access_token, password);
      } catch (err) {
        // The confirmation was refused (expired or revoked): the owner must start again.
        if (err.status === 401 || err.status === 403) {
          pendingSignup = null;
          err.code = 'signup_expired';
          err.message = 'Your email is confirmed, but the password could not be saved in time. Use Forgot password to choose one.';
        }
        throw err;
      }
      pendingSignup = null;
      return remember(pending);
    },

    // Sends a new registration code. Supabase limits how often a code can be sent.
    async resendSignupCode(email) {
      return call('resend', { type: 'signup', email });
    },

    // Password sign-in for owners who have verified their email. An owner who
    // has not verified yet is refused by Supabase with code email_not_confirmed,
    // and no session is stored.
    async signIn(email, password) {
      const data = await call('token?grant_type=password', { email, password });
      return remember(toSession(data, nowMs()));
    },

    async recoverPassword(email) {
      const redirect = authRedirectUrl(config);
      const body = { email };
      if (redirect) body.redirect_to = redirect;
      return call('recover', body);
    },

    async updatePassword(password) {
      if (!session?.access_token) throw new Error('Your recovery link has expired. Request a new one.');
      return putPassword(session.access_token, password);
    },

    async consumeCallback(hash) {
      const parsed = parseAuthCallbackHash(hash);
      if (!parsed.handled || parsed.error) return parsed;
      try {
        const user = await currentUser(parsed.tokenResponse.access_token);
        const next = toSession({ ...parsed.tokenResponse, user }, nowMs());
        // A confirmation link proves the address, like the code does. The owner must still
        // choose a password (completeSignup) before the session is kept.
        if (parsed.type === 'signup') {
          pendingSignup = next;
          return { handled: true, type: 'signup', pending: true };
        }
        return { handled: true, type: parsed.type, session: remember(next) };
      } catch (error) {
        return { handled: true, error };
      }
    },

    async signOut() {
      const token = session?.access_token;
      pendingSignup = null;
      remember(null);
      if (token) {
        try {
          await call('logout', {}, token);
        } catch {
          // Already signed out in this browser. The server token expires on its own.
        }
      }
    },

    // A session that is safe to use right now, refreshed if needed. Returns
    // null when the owner must sign in again.
    async getSession() {
      if (!session) return null;
      if (isFresh(session, nowMs())) return session;
      return refresh();
    },
  };
}
