// Remembers the address of a registration that is waiting for its code, and when the last
// code was sent, so a reload on the code screen keeps the owner's place and the resend
// countdown. Only the address and a time are stored, never the password. It lives in
// sessionStorage, which belongs to one browser tab. Every read and write is wrapped,
// because storage can be blocked or throw in some privacy modes.

export const PENDING_SIGNUP_KEY = 'qrquick.owner.pendingSignup';
// A code lapses well before this, so an older record is not worth restoring.
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function createPendingSignupStore(storage) {
  const store = {
    // Returns { email, sentAtMs } or null. A damaged or stale record is removed.
    load(nowMs = Date.now()) {
      try {
        const raw = storage?.getItem(PENDING_SIGNUP_KEY);
        if (!raw) return null;
        const record = JSON.parse(raw);
        const valid =
          typeof record?.email === 'string' &&
          record.email.length > 0 &&
          Number.isFinite(record.sentAtMs) &&
          record.sentAtMs >= 0;
        if (!valid || nowMs - record.sentAtMs > MAX_AGE_MS) {
          store.clear();
          return null;
        }
        return { email: record.email, sentAtMs: record.sentAtMs };
      } catch {
        // Damaged JSON, or storage that refuses the read. Clearing is safe either way.
        store.clear();
        return null;
      }
    },

    save(email, sentAtMs) {
      try {
        storage?.setItem(PENDING_SIGNUP_KEY, JSON.stringify({ email: String(email), sentAtMs: Number(sentAtMs) || 0 }));
      } catch {
        // Storage is unavailable: the owner can still finish on this page, but a reload restarts sign in.
      }
    },

    clear() {
      try {
        storage?.removeItem(PENDING_SIGNUP_KEY);
      } catch {
        // Nothing to clear.
      }
    },
  };
  return store;
}
