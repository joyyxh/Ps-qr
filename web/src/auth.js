// Owner sign-in with a username and password. The owner-auth function does the checks,
// the reservation of the username, the rate limits and the Terms check. This module sends
// the password once, over HTTPS, and keeps only the session tokens (see session.js).
//
// Email is not used. The password, a recovery code and the internal address behind each
// account are never stored in the browser. Recovery codes wait in memory only, until the
// owner confirms they are saved.

import { apiError, readJson } from './http.js';
import { isFresh, toSession } from './session.js';

// Responses that mean the refresh token itself is no longer accepted.
// Any other failure (for example no network) keeps the session for a retry.
const REJECTED_REFRESH_STATUSES = [400, 401, 403];

export function createAuth({ config, store, fetchImpl = globalThis.fetch, nowMs = () => Date.now() }) {
  const base = config.supabaseUrl.replace(/\/$/, '');
  const functionUrl = `${base}/functions/v1/owner-auth`;
  let session = store.load();
  let refreshing = null;
  // Recovery codes of a new account or a reset, shown once. Held in memory until the owner
  // confirms they are saved (acknowledgeCodes). A reload ends the wait, and the owner can
  // then sign in with the password and make a new set.
  let pending = null;

  async function gotrue(path, body, accessToken = null) {
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

  async function owner(action, { method = 'POST', body, accessToken = null } = {}) {
    const headers = { apikey: config.publishableKey, 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetchImpl(`${functionUrl}/${action}`, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });
    const data = await readJson(response);
    if (!response.ok) throw apiError(response, data, 'Request failed');
    return data;
  }

  // The username is kept on the session, because it is what the owner signs in with.
  function sessionFrom(tokens, username) {
    return toSession({ ...tokens, user: { id: tokens.user?.id, username } }, nowMs());
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

  function publicPending() {
    return {
      purpose: pending.purpose,
      username: pending.username,
      recoveryCodes: pending.recoveryCodes,
      signedIn: pending.session !== null,
    };
  }

  async function refresh() {
    if (!refreshing) {
      const refreshToken = session.refresh_token;
      const username = session.user?.username ?? '';
      refreshing = (async () => {
        try {
          const data = await gotrue('token?grant_type=refresh_token', { refresh_token: refreshToken });
          return remember(sessionFrom(data, username));
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

  // A session that is safe to use right now, refreshed if needed. Null when the owner must sign in again.
  async function currentSession() {
    if (!session) return null;
    if (isFresh(session, nowMs())) return session;
    return refresh();
  }

  return {
    // The current Terms and Privacy versions. A sign-up must send them back.
    async policies() {
      return owner('policies', { method: 'GET' });
    },

    // Creates an owner account. The server returns ten recovery codes and, normally, a session.
    // The codes wait here until acknowledgeCodes, and the session is not kept before then.
    async signUp({ username, password, accept }) {
      const data = await owner('signup', { body: { username, password, accept } });
      pending = {
        purpose: 'signup',
        username: data.username,
        recoveryCodes: data.recovery_codes ?? [],
        session: data.session ? sessionFrom(data.session, data.username) : null,
      };
      return publicPending();
    },

    // Signs in with a username and password. Nothing is stored unless the server accepts them.
    async signIn(username, password) {
      const data = await owner('signin', { body: { username, password } });
      return remember(sessionFrom(data.session, data.username));
    },

    // Sets a new password with a recovery code. The old sessions of the account end. The
    // new codes wait here until acknowledgeCodes, like the codes of a new account.
    async resetPassword({ username, recoveryCode, newPassword }) {
      const data = await owner('reset', {
        body: { username, recovery_code: recoveryCode, new_password: newPassword },
      });
      remember(null);
      pending = {
        purpose: 'reset',
        username: data.username,
        recoveryCodes: data.recovery_codes ?? [],
        session: data.session ? sessionFrom(data.session, data.username) : null,
      };
      return publicPending();
    },

    // Makes a new set of codes for the signed-in owner. Needs the current password. The
    // session stays open. The old codes stop working at once.
    async regenerateCodes(currentPassword) {
      // A fresh access token, so a session that has been open for a while still works.
      const current = await currentSession();
      if (!current) throw Object.assign(new Error('Sign in again to continue.'), { status: 401, code: 'session_required' });
      const data = await owner('codes/regenerate', {
        body: { current_password: currentPassword },
        accessToken: current.access_token,
      });
      return { username: data.username, recoveryCodes: data.recovery_codes ?? [] };
    },

    // The codes that still wait to be confirmed, or null.
    pendingCodes() {
      return pending ? publicPending() : null;
    },

    hasPendingCodes() {
      return pending !== null;
    },

    // The owner has saved the codes. Keeps the session from a new account or a reset, if the
    // server returned one, and ends the wait.
    async acknowledgeCodes() {
      if (!pending) return null;
      const next = pending.session;
      pending = null;
      return next ? remember(next) : null;
    },

    async signOut() {
      const token = session?.access_token;
      pending = null;
      remember(null);
      if (token) {
        try {
          await gotrue('logout?scope=local', {}, token);
        } catch {
          // Already signed out in this browser. The server token expires on its own.
        }
      }
    },

    getSession: currentSession,
  };
}
