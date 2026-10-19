// Email and password sign-in through Supabase Auth. Uses only the publishable
// key. The password is sent once, to Supabase, and is never stored in the
// browser. Only the session tokens are kept (see session.js).

import { apiError, readJson } from './http.js';
import { isFresh, toSession } from './session.js';

// Responses that mean the refresh token itself is no longer accepted.
// Any other failure (for example no network) keeps the session for a retry.
const REJECTED_REFRESH_STATUSES = [400, 401, 403];

export function createAuth({ config, store, fetchImpl = globalThis.fetch, nowMs = () => Date.now() }) {
  const base = config.supabaseUrl.replace(/\/$/, '');
  let session = store.load();
  let refreshing = null;

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
    // Returns { confirmationNeeded: true } when the project requires the owner
    // to click a link in their email before the first sign-in.
    async signUp(email, password) {
      const data = await call('signup', { email, password });
      if (data.access_token) {
        return { confirmationNeeded: false, session: remember(toSession(data, nowMs())) };
      }
      return { confirmationNeeded: true, session: null };
    },

    async signIn(email, password) {
      const data = await call('token?grant_type=password', { email, password });
      return remember(toSession(data, nowMs()));
    },

    async signOut() {
      const token = session?.access_token;
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
