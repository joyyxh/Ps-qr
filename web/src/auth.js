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
      const redirect = authRedirectUrl(config);
      const body = { email, password };
      // Do not send localhost or a Capacitor origin to Supabase. When this is
      // a deployed HTTPS page, the current page is a safe fallback; the APK
      // receives the deployed URL through PRINTNEST_PUBLIC_URL.
      if (redirect) body.redirect_to = redirect;
      const data = await call('signup', body);
      if (data.access_token) {
        return { confirmationNeeded: false, session: remember(toSession(data, nowMs())) };
      }
      return { confirmationNeeded: true, session: null };
    },

    async signIn(email, password) {
      const data = await call('token?grant_type=password', { email, password });
      return remember(toSession(data, nowMs()));
    },

    async consumeCallback(hash) {
      const parsed = parseAuthCallbackHash(hash);
      if (!parsed.handled || parsed.error) return parsed;
      try {
        const user = await currentUser(parsed.tokenResponse.access_token);
        return {
          handled: true,
          session: remember(toSession({ ...parsed.tokenResponse, user }, nowMs())),
        };
      } catch (error) {
        return { handled: true, error };
      }
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
