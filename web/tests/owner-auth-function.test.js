// Unit tests for the owner-auth function, run against an in-memory stand-in for
// GoTrue and PostgREST. These check the function's own logic: validation, ordering,
// compensation, rate limits, generic errors and code rotation.
//
// They do NOT prove the database guard, bcrypt hashing or GoTrue's acceptance of the
// internal address. Those are proved by the live staging workflow (owner-auth-staging.yml).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createOwnerAuth } from "../../supabase/functions/owner-auth/owner-auth.js";
import {
  checkPassword,
  checkUsername,
  generateRecoveryCodes,
  normalizeRecoveryCode,
  RECOVERY_ALPHABET,
} from "../../supabase/functions/owner-auth/rules.js";

const BASE = "https://example.supabase.co";
const ANON = "anon-test-key";
const SERVICE = "service-test-key";
const TERMS = "2026-11-22.1";
const PRIVACY = "2026-11-22.1";
const GOOD_PASSWORD = "Sunrise2026Print";
const OTHER_PASSWORD = "Harbour2026Plate";

function makeBackend(options = {}) {
  const users = new Map(); // id -> { id, email, password, owner_flow }
  const reservations = new Map(); // username -> user_id
  const codes = []; // { user_id, code, used }
  const acceptances = [];
  const sessions = new Map(); // access token -> { user_id, refresh }
  const limits = new Map(); // key -> hits
  const calls = [];
  let tokenSeq = 0;
  const legal = {
    terms: [{ kind: "terms", version: TERMS, title: "Terms and Conditions", effective_at: "2026-11-22T00:00:00Z" }],
    privacy: [{ kind: "privacy", version: PRIVACY, title: "Privacy Policy", effective_at: "2026-11-22T00:00:00Z" }],
  };
  const json = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

  function issueSession(userId) {
    tokenSeq += 1;
    const access = `access-${tokenSeq}`;
    const refresh = `refresh-${tokenSeq}`;
    sessions.set(access, { user_id: userId, refresh });
    const user = users.get(userId);
    return {
      access_token: access,
      refresh_token: refresh,
      expires_in: 3600,
      expires_at: 2000000000,
      token_type: "bearer",
      user: { id: userId, email: user.email },
    };
  }

  function revokeFor(userId) {
    let n = 0;
    for (const [access, s] of sessions) {
      if (s.user_id === userId) {
        sessions.delete(access);
        n += 1;
      }
    }
    return n;
  }

  function deleteUser(userId) {
    users.delete(userId);
    for (const [name, id] of reservations) if (id === userId) reservations.delete(name);
    for (let i = codes.length - 1; i >= 0; i -= 1) if (codes[i].user_id === userId) codes.splice(i, 1);
    for (let i = acceptances.length - 1; i >= 0; i -= 1) if (acceptances[i].user_id === userId) acceptances.splice(i, 1);
    revokeFor(userId);
  }

  async function fetchImpl(url, init = {}) {
    const u = new URL(url);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    const path = u.pathname;
    calls.push({ method, path: `${path}${u.search}`, apikey: init.headers?.apikey, auth: init.headers?.Authorization });

    // ---- GoTrue -----------------------------------------------------------
    if (path === "/auth/v1/admin/users" && method === "POST") {
      if (options.failCreate) return json(500, { msg: "boom" });
      const internal = /^[a-z][a-z0-9]*(_[a-z0-9]+)*@accounts\.qrquick\.invalid$/.test(body.email);
      if (body.app_metadata?.owner_flow !== "username-v1" || !internal) {
        return json(500, { msg: "trigger refused" });
      }
      if ([...users.values()].some((x) => x.email === body.email)) {
        return json(422, { code: 422, error_code: "email_exists", msg: "already registered" });
      }
      if (body.password.length < 10) return json(422, { code: 422, error_code: "weak_password", msg: "weak" });
      const id = `user-${users.size + 1}-${Math.random().toString(16).slice(2, 8)}`;
      users.set(id, { id, email: body.email, password: body.password, owner_flow: "username-v1" });
      return json(200, { id, email: body.email });
    }
    const adminUser = /^\/auth\/v1\/admin\/users\/([^/]+)$/.exec(path);
    if (adminUser && method === "DELETE") {
      deleteUser(decodeURIComponent(adminUser[1]));
      return json(200, {});
    }
    if (adminUser && method === "PUT") {
      const id = decodeURIComponent(adminUser[1]);
      if (body.password === "Breached2026Pass") {
        return json(422, { code: 422, error_code: "weak_password", msg: "pwned" });
      }
      users.get(id).password = body.password;
      return json(200, { id });
    }
    if (path === "/auth/v1/token" && u.searchParams.get("grant_type") === "password" && method === "POST") {
      const found = [...users.values()].find((x) => x.email === body.email);
      if (!found || found.password !== body.password) {
        return json(400, { code: 400, error_code: "invalid_grant", msg: "Invalid login credentials" });
      }
      return json(200, issueSession(found.id));
    }
    if (path === "/auth/v1/user" && method === "GET") {
      const token = (init.headers?.Authorization ?? "").replace(/^Bearer /, "");
      const s = sessions.get(token);
      if (!s) return json(401, { code: 401, msg: "bad jwt" });
      return json(200, { id: s.user_id, email: users.get(s.user_id).email });
    }
    if (path === "/auth/v1/logout" && method === "POST") {
      const token = (init.headers?.Authorization ?? "").replace(/^Bearer /, "");
      const s = sessions.get(token);
      if (s) sessions.delete(token);
      return new Response(null, { status: 204 });
    }

    // ---- PostgREST ---------------------------------------------------------
    if (path === "/rest/v1/rpc/consume_rate_limit") {
      const key = body.p_key;
      const hits = (limits.get(key) ?? 0) + 1;
      limits.set(key, hits);
      if (options.limitAlwaysFails) return json(500, { code: "x" });
      return json(200, hits <= body.p_limit);
    }
    if (path === "/rest/v1/rpc/owner_auth_burn") return new Response(null, { status: 204 });
    if (path === "/rest/v1/rpc/revoke_user_sessions") return json(200, revokeFor(body.p_user_id));
    if (path === "/rest/v1/rpc/owner_consume_recovery_code") {
      const row = codes.find((c) => c.user_id === body.p_user_id && !c.used && c.code === body.p_code);
      if (!row) return json(200, false);
      row.used = true;
      return json(200, true);
    }
    if (path === "/rest/v1/rpc/owner_replace_recovery_codes") {
      if (body.p_codes.length !== 10) return json(400, { code: "22023" });
      for (let i = codes.length - 1; i >= 0; i -= 1) if (codes[i].user_id === body.p_user_id) codes.splice(i, 1);
      for (const c of body.p_codes) codes.push({ user_id: body.p_user_id, code: c.replace(/-/g, ""), used: false });
      return json(200, "set-id");
    }
    if (path === "/rest/v1/owner_usernames" && method === "GET") {
      const name = u.searchParams.get("username");
      const owner = u.searchParams.get("user_id");
      if (name) {
        const id = reservations.get(name.replace(/^eq\./, ""));
        return json(200, id ? [{ user_id: id }] : []);
      }
      if (owner) {
        const id = owner.replace(/^eq\./, "");
        const found = [...reservations].find(([, uid]) => uid === id);
        return json(200, found ? [{ username: found[0] }] : []);
      }
      return json(200, []);
    }
    if (path === "/rest/v1/owner_usernames" && method === "POST") {
      if (options.failReserve) return json(500, { code: "x" });
      if (reservations.has(body.username) || [...reservations.values()].includes(body.user_id)) {
        return json(409, { code: "23505", message: "duplicate" });
      }
      reservations.set(body.username, body.user_id);
      return new Response(null, { status: 201 });
    }
    if (path === "/rest/v1/legal_documents" && method === "GET") {
      const kind = u.searchParams.get("kind").replace(/^eq\./, "");
      return json(200, legal[kind]);
    }
    if (path === "/rest/v1/owner_policy_acceptances" && method === "POST") {
      for (const row of body) acceptances.push(row);
      return new Response(null, { status: 201 });
    }

    return json(404, { message: `no route ${method} ${path}` });
  }

  return { fetchImpl, users, reservations, codes, acceptances, sessions, limits, calls, legal };
}

function makeHandler(backend, extra = {}) {
  return createOwnerAuth({
    supabaseUrl: BASE,
    anonKey: ANON,
    serviceKey: SERVICE,
    fetchImpl: backend.fetchImpl,
    now: () => Date.parse("2026-11-22T12:00:00Z"),
    ...extra,
  });
}

function post(handle, path, body, headers = {}) {
  return handle(new Request(`${BASE}/functions/v1/owner-auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, "x-forwarded-for": "203.0.113.7", ...headers },
    body: JSON.stringify(body),
  }));
}

function get(handle, path) {
  return handle(new Request(`${BASE}/functions/v1/owner-auth/${path}`, { method: "GET", headers: { apikey: ANON } }));
}

const ACCEPT = { terms: TERMS, privacy: PRIVACY };

async function signUp(handle, username = "print_shop", password = GOOD_PASSWORD) {
  const res = await post(handle, "signup", { username, password, accept: ACCEPT });
  return { res, body: await res.json() };
}

// ---- rules ---------------------------------------------------------------

test("rules: usernames are normalised and checked", () => {
  assert.deepEqual(checkUsername("  Print_Shop1 "), { ok: true, username: "print_shop1" });
  assert.equal(checkUsername("ab").code, "username_length");
  assert.equal(checkUsername("a".repeat(25)).code, "username_length");
  assert.equal(checkUsername("1shop").code, "username_chars");
  assert.equal(checkUsername("shop__one").code, "username_chars");
  assert.equal(checkUsername("shop_").code, "username_chars");
  assert.equal(checkUsername("ｓｈｏｐ").code, "username_chars", "full-width letters are refused");
  assert.equal(checkUsername("admin").code, "username_reserved");
  assert.equal(checkUsername("   ").code, "username_required");
});

test("rules: password policy lists every rule that fails", () => {
  assert.deepEqual(checkPassword(GOOD_PASSWORD, "print_shop"), { ok: true, failures: [] });
  assert.deepEqual(checkPassword("alllowercase9", "x_y").failures, ["upper"]);
  assert.deepEqual(checkPassword("ALLUPPERCASE9", "x_y").failures, ["lower"]);
  assert.deepEqual(checkPassword("NoDigitsHere", "x_y").failures, ["digit"]);
  assert.deepEqual(checkPassword("Short1A", "x_y").failures, ["length"]);
  assert.deepEqual(checkPassword("Print_Shop2026", "print_shop").failures, ["username"]);
  assert.deepEqual(checkPassword("é".repeat(40) + "Aa1", "x_y").failures, ["bytes"], "80 bytes is too long");
});

test("rules: recovery codes use the 31-symbol alphabet and are uniform", () => {
  assert.equal(RECOVERY_ALPHABET.length, 31);
  for (const bad of ["0", "1", "I", "L", "O"]) assert.ok(!RECOVERY_ALPHABET.includes(bad));

  const codes = generateRecoveryCodes(() => new Uint8Array(64).fill(0));
  assert.equal(codes.length, 10);
  for (const c of codes) assert.match(c, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // Bytes of 248 and above are skipped, so the first usable byte is 0.
  let calls = 0;
  const skipping = generateRecoveryCodes(() => {
    calls += 1;
    return calls === 1 ? new Uint8Array(64).fill(255) : new Uint8Array(64).fill(0);
  });
  assert.equal(skipping[0], "AAAA-AAAA-AAAA-AAAA");
  assert.equal(normalizeRecoveryCode("aaaa aaaa-aaaa aaaa"), "AAAAAAAAAAAAAAAA");
  assert.equal(normalizeRecoveryCode("AAAA-AAAA-AAAA-AAA0"), null, "0 is not a recovery symbol");
  assert.equal(normalizeRecoveryCode("short"), null);
  assert.equal(normalizeRecoveryCode(42), null);
});

// ---- signup ----------------------------------------------------------------

test("signup creates the account, the reservation, acceptances and codes", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  const { res, body } = await signUp(handle, "Print_Shop");

  assert.equal(res.status, 201);
  assert.equal(body.username, "print_shop");
  assert.equal(body.recovery_codes.length, 10);
  assert.ok(body.session.access_token);
  assert.equal(body.session.user.username, "print_shop");
  assert.equal(backend.reservations.get("print_shop"), body.session.user.id);
  assert.equal(backend.acceptances.length, 2);
  const created = backend.users.get(body.session.user.id);
  assert.equal(created.email, "print_shop@accounts.qrquick.invalid");
  assert.equal(created.owner_flow, "username-v1");
  assert.equal(backend.codes.filter((c) => c.user_id === body.session.user.id).length, 10);
});

test("signup refuses a taken username and creates no second account", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  await signUp(handle, "shop_one");
  const second = await signUp(handle, "shop_one");
  assert.equal(second.res.status, 409);
  assert.equal(second.body.code, "username_taken");
  assert.equal(backend.users.size, 1);
});

test("signup with two requests for the same name: one wins, one is refused", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  const [a, b] = await Promise.all([signUp(handle, "race_shop"), signUp(handle, "race_shop")]);
  const statuses = [a.res.status, b.res.status].sort();
  assert.deepEqual(statuses, [201, 409]);
  assert.equal(backend.users.size, 1);
  assert.equal(backend.reservations.size, 1);
});

test("signup removes the new account when the reservation fails", async () => {
  const backend = makeBackend({ failReserve: true });
  const handle = makeHandler(backend);
  const { res, body } = await signUp(handle, "unlucky_shop");
  assert.equal(res.status, 500);
  assert.equal(body.code, "server_error");
  assert.equal(backend.users.size, 0, "the half-made account is removed");
  assert.equal(backend.codes.length, 0);
});

test("signup refuses a weak password and says which rules failed", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  const { res, body } = await signUp(handle, "weak_shop", "alllowercase9");
  assert.equal(res.status, 400);
  assert.equal(body.code, "weak_password");
  assert.deepEqual(body.failures, ["upper"]);
  assert.equal(backend.users.size, 0);
});

test("signup needs the current Terms and Privacy versions", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);

  const missing = await post(handle, "signup", { username: "no_accept", password: GOOD_PASSWORD });
  assert.equal(missing.status, 400);
  const missingBody = await missing.json();
  assert.equal(missingBody.code, "terms_required");
  assert.deepEqual(missingBody.current, { terms: TERMS, privacy: PRIVACY });

  const stale = await post(handle, "signup", {
    username: "stale_accept",
    password: GOOD_PASSWORD,
    accept: { terms: "2025-01-01.1", privacy: PRIVACY },
  });
  assert.equal((await stale.json()).code, "terms_required");
  assert.equal(backend.users.size, 0, "no account is created without acceptance");
});

test("signup reports a bad username before doing any other work", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  const { res, body } = await signUp(handle, "admin");
  assert.equal(res.status, 400);
  assert.equal(body.code, "username_reserved");
  assert.equal(backend.calls.some((c) => c.path.startsWith("/auth/v1/admin/users")), false);
});

test("signup is rate limited per connection and creates nothing when limited", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  let last;
  for (let i = 0; i < 11; i += 1) last = await signUp(handle, `shop_${i}`.padEnd(5, "x"));
  assert.equal(last.res.status, 429);
  assert.equal(last.body.code, "rate_limited");
  assert.equal(backend.users.size, 10);
});

test("a rate limit that cannot be checked refuses the request", async () => {
  const backend = makeBackend({ limitAlwaysFails: true });
  const handle = makeHandler(backend);
  const { res } = await signUp(handle, "closed_shop");
  assert.equal(res.status, 500);
  assert.equal(backend.users.size, 0);
});

// ---- sign-in -----------------------------------------------------------------

test("sign-in works with any letter case and returns a session", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  await signUp(handle, "day_shop");
  const res = await post(handle, "signin", { username: "DAY_shop", password: GOOD_PASSWORD });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.username, "day_shop");
  assert.ok(body.session.refresh_token);
});

test("sign-in gives the same answer for a wrong password and an unknown username", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  await signUp(handle, "known_shop");

  const wrong = await post(handle, "signin", { username: "known_shop", password: OTHER_PASSWORD });
  const unknown = await post(handle, "signin", { username: "nobody_here", password: OTHER_PASSWORD });
  const wrongBody = await wrong.json();
  const unknownBody = await unknown.json();
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(wrongBody, unknownBody);
  assert.equal(wrongBody.code, "invalid_credentials");
  assert.ok(
    backend.calls.some((c) => c.path === "/rest/v1/rpc/owner_auth_burn"),
    "an unknown name spends the same password-check work",
  );
});

test("sign-in refuses an empty password and a malformed name the same way", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  const empty = await post(handle, "signin", { username: "known_shop", password: "" });
  assert.equal(empty.status, 400);
  const malformed = await post(handle, "signin", { username: "1 bad name", password: OTHER_PASSWORD });
  assert.equal(malformed.status, 401);
  assert.equal((await malformed.json()).code, "invalid_credentials");
});

test("sign-in stops after ten tries for one name, whether or not the name exists", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  await signUp(handle, "target_shop");
  let last;
  for (let i = 0; i < 11; i += 1) last = await post(handle, "signin", { username: "target_shop", password: "wrong" });
  assert.equal(last.status, 429);
  let unknownLast;
  for (let i = 0; i < 11; i += 1) unknownLast = await post(handle, "signin", { username: "ghost_shop", password: "wrong" });
  assert.equal(unknownLast.status, 429, "an unknown name is limited the same way, so the limit reveals nothing");
});

test("legacy email-only accounts cannot sign in with a username", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  backend.users.set("legacy-1", { id: "legacy-1", email: "owner@example.com", password: GOOD_PASSWORD });
  const res = await post(handle, "signin", { username: "owner", password: GOOD_PASSWORD });
  assert.equal(res.status, 401);
});

// ---- recovery --------------------------------------------------------------

test("reset with a recovery code sets the password, ends old sessions and rotates the codes", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  const { body: signed } = await signUp(handle, "reset_shop");
  const firstCode = backend.codes.find((c) => c.user_id === signed.session.user.id).code;
  const displayed = signed.recovery_codes.map((c) => c.replace(/-/g, ""));
  assert.ok(displayed.includes(firstCode));
  const usedCode = signed.recovery_codes[0];
  const oldAccess = signed.session.access_token;

  const res = await post(handle, "reset", {
    username: "reset_shop",
    recovery_code: usedCode.toLowerCase(),
    new_password: OTHER_PASSWORD,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.recovery_codes.length, 10);
  assert.ok(!body.recovery_codes.includes(usedCode), "the rotated set does not repeat the used code");

  const oldStillValid = await handle(new Request(`${BASE}/functions/v1/owner-auth/codes/regenerate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${oldAccess}`, "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({ current_password: OTHER_PASSWORD }),
  }));
  assert.equal(oldStillValid.status, 401, "the old session was ended by the reset");

  const oldPassword = await post(handle, "signin", { username: "reset_shop", password: GOOD_PASSWORD });
  assert.equal(oldPassword.status, 401);
  const newPassword = await post(handle, "signin", { username: "reset_shop", password: OTHER_PASSWORD });
  assert.equal(newPassword.status, 200);
});

test("a recovery code works once", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  const { body: signed } = await signUp(handle, "once_shop");
  const code = signed.recovery_codes[3];
  const first = await post(handle, "reset", { username: "once_shop", recovery_code: code, new_password: OTHER_PASSWORD });
  assert.equal(first.status, 200);
  const replay = await post(handle, "reset", { username: "once_shop", recovery_code: code, new_password: "Third2026Pass" });
  assert.equal(replay.status, 401);
  assert.equal((await replay.json()).code, "reset_failed");
});

test("reset gives one message for a wrong code and for an unknown name", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  await signUp(handle, "exists_shop");
  const wrongCode = await post(handle, "reset", {
    username: "exists_shop",
    recovery_code: "AAAA-AAAA-AAAA-AAAA",
    new_password: OTHER_PASSWORD,
  });
  const unknown = await post(handle, "reset", {
    username: "ghost_user",
    recovery_code: "AAAA-AAAA-AAAA-AAAA",
    new_password: OTHER_PASSWORD,
  });
  assert.equal(wrongCode.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(await wrongCode.json(), await unknown.json());
});

test("a weak new password is refused before a code is used", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  const { body: signed } = await signUp(handle, "patient_shop");
  const code = signed.recovery_codes[0];
  const weak = await post(handle, "reset", { username: "patient_shop", recovery_code: code, new_password: "short" });
  assert.equal(weak.status, 400);
  assert.equal((await weak.json()).code, "weak_password");
  const retry = await post(handle, "reset", { username: "patient_shop", recovery_code: code, new_password: OTHER_PASSWORD });
  assert.equal(retry.status, 200, "the code was not spent by the refused password");
});

test("when the auth service refuses the new password, the code is spent and the message says so", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  const { body: signed } = await signUp(handle, "pwned_shop");
  const res = await post(handle, "reset", {
    username: "pwned_shop",
    recovery_code: signed.recovery_codes[0],
    new_password: "Breached2026Pass",
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, "password_rejected");
  assert.match(body.message, /another code/);
});

// ---- regenerate ------------------------------------------------------------

test("regenerate needs a live session and the current password", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  const { body: signed } = await signUp(handle, "regen_shop");
  const url = `${BASE}/functions/v1/owner-auth/codes/regenerate`;

  const noToken = await handle(new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({ current_password: GOOD_PASSWORD }),
  }));
  assert.equal(noToken.status, 401);

  const wrong = await handle(new Request(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${signed.session.access_token}`, "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({ current_password: OTHER_PASSWORD }),
  }));
  assert.equal(wrong.status, 401);
  assert.equal((await wrong.json()).code, "password_incorrect");
});

test("regenerate replaces the codes and ends only the check session it opened", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  const { body: signed } = await signUp(handle, "fresh_shop");
  const url = `${BASE}/functions/v1/owner-auth/codes/regenerate`;
  const res = await handle(new Request(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${signed.session.access_token}`, "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({ current_password: GOOD_PASSWORD }),
  }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.recovery_codes.length, 10);
  assert.ok(!body.recovery_codes.includes(signed.recovery_codes[0]));

  const logout = backend.calls.find((c) => c.path === "/auth/v1/logout?scope=local");
  assert.ok(logout, "the check session is ended with scope=local, not globally");
  assert.ok(backend.sessions.has(signed.session.access_token), "the session in use is kept");
});

// ---- routing and transport ---------------------------------------------------

test("unknown routes and wrong methods are refused", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  assert.equal((await post(handle, "nope", {})).status, 404);
  assert.equal((await get(handle, "signup")).status, 405);
  assert.equal((await get(handle, "policies")).status, 200);
});

test("policies returns the current versions", async () => {
  const handle = makeHandler(makeBackend());
  const body = await (await get(handle, "policies")).json();
  assert.equal(body.terms.version, TERMS);
  assert.equal(body.privacy.version, PRIVACY);
});

test("a function with no configuration refuses every request", async () => {
  const handle = createOwnerAuth({ supabaseUrl: "", anonKey: "", serviceKey: "", fetchImpl: async () => new Response() });
  const res = await post(handle, "signin", { username: "x", password: "y" });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).code, "not_configured");
});

test("bad and oversized bodies are refused before any lookup", async () => {
  const backend = makeBackend();
  const handle = makeHandler(backend);
  const bad = await handle(new Request(`${BASE}/functions/v1/owner-auth/signin`, {
    method: "POST",
    headers: { apikey: ANON },
    body: "not json",
  }));
  assert.equal(bad.status, 400);
  const big = await handle(new Request(`${BASE}/functions/v1/owner-auth/signin`, {
    method: "POST",
    headers: { apikey: ANON },
    body: JSON.stringify({ username: "x", password: "y".repeat(5000) }),
  }));
  assert.equal(big.status, 413);
  assert.equal(backend.calls.length, 0);
});

test("responses are not cached and carry the CORS headers", async () => {
  const handle = makeHandler(makeBackend());
  const res = await post(handle, "signin", { username: "nobody_here", password: OTHER_PASSWORD });
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
});
