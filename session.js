// Keeps the owner's sign-in session. It is stored in sessionStorage, which is
// scoped to one browser tab: on a shared shop computer, closing the tab signs
// the owner out. Every read and write is wrapped, because storage can be
// blocked or throw in some privacy modes.

export const SESSION_KEY = 'printnest.owner.session';
const REFRESH_MARGIN_SECONDS = 60;

export function browserSessionStorage() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function createSessionStore(storage) {
  return {
    load() {
      try {
        const raw = storage?.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    save(session) {
      try {
        storage?.setItem(SESSION_KEY, JSON.stringify(session));
      } catch {
        // Storage is unavailable, so the owner will need to sign in again later.
      }
    },

    clear() {
      try {
        storage?.removeItem(SESSION_KEY);
      } catch {
        // Nothing to clear.
      }
    },
  };
}

// Turns a Supabase token response into the small object we keep.
export function toSession(tokenResponse, nowMs = Date.now()) {
  if (!tokenResponse?.access_token || !tokenResponse?.refresh_token || !tokenResponse?.user?.id) {
    throw new Error('Sign in did not return a usable session.');
  }
  const nowSeconds = Math.floor(nowMs / 1000);
  return {
    access_token: tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token,
    expires_at: tokenResponse.expires_at ?? nowSeconds + (tokenResponse.expires_in ?? 3600),
    user: { id: tokenResponse.user.id, email: tokenResponse.user.email ?? '' },
  };
}

// True when the access token is still valid for at least a minute.
export function isFresh(session, nowMs = Date.now()) {
  if (!session?.access_token || !session.refresh_token) return false;
  return session.expires_at - REFRESH_MARGIN_SECONDS > Math.floor(nowMs / 1000);
}
