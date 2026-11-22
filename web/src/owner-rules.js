// Owner sign-in rules, shared by the owner-auth function and the browser.
// The browser copy is web/src/owner-rules.js. A test fails if the two files differ.
// Plain ES module: no Deno or browser APIs, so it runs in both places.
//
// Nothing in this file talks to a server. It decides what a username, a password
// or a recovery code may look like. The server calls the same checks again.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
// Starts with a letter. Letters and digits, with single underscores between them.
// Lower case only, so no look-alike characters from other alphabets are possible.
export const USERNAME_PATTERN = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
export const RESERVED_USERNAMES = Object.freeze([
  "admin", "owner", "root", "support", "qrquick", "system", "null", "help", "api", "www", "staff", "moderator",
]);

export const PASSWORD_MIN = 10;
// bcrypt, which GoTrue uses, reads only the first 72 bytes. Longer passwords are refused.
export const PASSWORD_MAX_BYTES = 72;

// 31 symbols: letters without I, L, O and digits without 0, 1. Easy to read aloud.
export const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const RECOVERY_CODE_COUNT = 10;
export const RECOVERY_CODE_LENGTH = 16;

// The address behind each username account. It is never contacted, because
// the account is created already confirmed and the reserved .invalid domain cannot receive mail.
export const INTERNAL_EMAIL_DOMAIN = "accounts.qrquick.invalid";

// Normalises what a person typed. Trims spaces and lower-cases ASCII letters.
export function normalizeUsername(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

export function internalEmailFor(username) {
  return `${username}@${INTERNAL_EMAIL_DOMAIN}`;
}

// Returns { ok: true, username } or { ok: false, code, message }.
export function checkUsername(raw) {
  const username = normalizeUsername(raw);
  if (username === "") {
    return { ok: false, code: "username_required", message: "Enter a username." };
  }
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return { ok: false, code: "username_length", message: `Use ${USERNAME_MIN} to ${USERNAME_MAX} characters.` };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      code: "username_chars",
      message: "Use letters a to z, numbers and single underscores. Start with a letter.",
    };
  }
  if (RESERVED_USERNAMES.includes(username)) {
    return { ok: false, code: "username_reserved", message: "This username is reserved. Choose another." };
  }
  return { ok: true, username };
}

// Returns { ok, failures }. failures is a list of rule names that are not met:
// "length", "bytes", "upper", "lower", "digit", "username".
export function checkPassword(password, username = "") {
  const failures = [];
  const value = typeof password === "string" ? password : "";
  const chars = [...value].length;
  if (chars < PASSWORD_MIN) failures.push("length");
  if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES) failures.push("bytes");
  if (!/[A-Z]/.test(value)) failures.push("upper");
  if (!/[a-z]/.test(value)) failures.push("lower");
  if (!/[0-9]/.test(value)) failures.push("digit");
  const name = normalizeUsername(username);
  if (name.length >= USERNAME_MIN && value.toLowerCase().includes(name)) failures.push("username");
  return { ok: failures.length === 0, failures };
}

// Recovery codes: the user types them with or without dashes and in any case.
// Returns the 16-character form, or null when the text cannot be a code.
export function normalizeRecoveryCode(raw) {
  if (typeof raw !== "string") return null;
  const compact = raw.replace(/[\s-]/g, "").toUpperCase();
  const valid = new RegExp(`^[${RECOVERY_ALPHABET}]{${RECOVERY_CODE_LENGTH}}$`);
  return valid.test(compact) ? compact : null;
}

// XXXX-XXXX-XXXX-XXXX from a 16-character compact code.
export function displayRecoveryCode(compact) {
  return compact.match(/.{4}/g).join("-");
}

// Makes ten codes from random bytes. Rejection sampling: a byte is used only when
// it is below 248 (31 * 8), so every symbol is equally likely. Asks randomBytes for more when needed.
export function generateRecoveryCodes(randomBytes) {
  const limit = 31 * 8;
  const codes = [];
  let pool = new Uint8Array(0);
  let at = 0;
  const nextByte = () => {
    while (at >= pool.length) {
      pool = randomBytes(64);
      at = 0;
    }
    return pool[at++];
  };
  for (let c = 0; c < RECOVERY_CODE_COUNT; c += 1) {
    let compact = "";
    while (compact.length < RECOVERY_CODE_LENGTH) {
      const b = nextByte();
      if (b < limit) compact += RECOVERY_ALPHABET[b % 31];
    }
    codes.push(displayRecoveryCode(compact));
  }
  return codes;
}

// Messages for each failed password rule. Shown beside the field.
export const PASSWORD_RULE_TEXT = Object.freeze({
  length: `At least ${PASSWORD_MIN} characters`,
  bytes: `No more than ${PASSWORD_MAX_BYTES} bytes`,
  upper: "One uppercase letter",
  lower: "One lowercase letter",
  digit: "One number",
  username: "Must not contain your username",
});
