// owner-auth: username sign-up, sign-in, recovery codes and policy acceptance for shop owners.
// Deployed with verify_jwt = false. Owners are not signed in yet when they call it, and
// the checks below do the work that a JWT check would otherwise do.
//
// Routes (the path ends in the action):
//   GET  /owner-auth/policies          current Terms and Privacy versions
//   POST /owner-auth/signup            { username, password, accept: { terms, privacy } }
//   POST /owner-auth/signin            { username, password }
//   POST /owner-auth/reset             { username, recovery_code, new_password }
//   POST /owner-auth/codes/regenerate  header Authorization: Bearer <access token>
//                                      body { current_password }
//
// Successful signup, sign-in, reset and regenerate return recovery codes or a session.
// Errors return { code, message } and never say which of two things was wrong when that
// would reveal whether a username exists.
//
// Nothing here logs usernames, passwords, codes or tokens. Only error names reach the logs.
//
// This module uses only standard web APIs, so the unit tests can run it under Node.

import {
  checkPassword,
  checkUsername,
  generateRecoveryCodes,
  internalEmailFor,
  normalizeRecoveryCode,
  normalizeUsername,
  RECOVERY_CODE_COUNT,
} from "./rules.js";

export const CORS_HEADERS = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
});

const MAX_BODY_CHARS = 4096;
const TAKEN_TEXT = "That username is already taken. Choose another.";
const INVALID_TEXT = "That username or password is not right.";
const RESET_TEXT = "That username or recovery code is not right.";
const RATE_TEXT = "Too many attempts from this connection. Wait a few minutes and try again.";

export class OwnerAuthError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function failure(err) {
  if (err instanceof OwnerAuthError) {
    return json(err.status, { code: err.code, message: err.message, ...(err.extra ?? {}) });
  }
  console.error("owner-auth: unexpected failure", err?.name ?? "error");
  return json(500, { code: "server_error", message: "Something went wrong. Try again." });
}

function clientAddress(req) {
  const forwarded = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return forwarded || req.headers.get("cf-connecting-ip") || "unknown";
}

function bearerToken(req) {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : null;
}

async function readJson(req) {
  const text = await req.text();
  if (text.length > MAX_BODY_CHARS) {
    throw new OwnerAuthError(413, "too_large", "The request is too large.");
  }
  let body;
  try {
    body = JSON.parse(text || "{}");
  } catch {
    throw new OwnerAuthError(400, "bad_json", "The request could not be read.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new OwnerAuthError(400, "bad_json", "The request could not be read.");
  }
  return body;
}

async function readError(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function isTakenError(body) {
  return body?.error_code === "email_exists" || body?.error_code === "user_already_exists";
}

function publicSession(token, username) {
  return {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_in: token.expires_in,
    expires_at: token.expires_at,
    token_type: token.token_type ?? "bearer",
    user: { id: token.user?.id ?? null, username },
  };
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function createOwnerAuth(config = {}) {
  const supabaseUrl = (config.supabaseUrl ?? "").replace(/\/+$/, "");
  const anonKey = config.anonKey ?? "";
  const serviceKey = config.serviceKey ?? "";
  const doFetch = config.fetchImpl ?? ((url, init) => fetch(url, init));
  const clock = config.now ?? (() => Date.now());
  const randomBytes = config.randomBytes ?? ((n) => crypto.getRandomValues(new Uint8Array(n)));
  const configured = Boolean(supabaseUrl && anonKey && serviceKey);

  // ---- transport ---------------------------------------------------------

  function auth(path, { method = "GET", key, token, body } = {}) {
    const headers = { apikey: key, "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return doFetch(`${supabaseUrl}/auth/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  function rest(path, { method = "GET", body, prefer } = {}) {
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };
    if (prefer) headers.Prefer = prefer;
    return doFetch(`${supabaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function rpc(name, args) {
    const res = await rest(`/rest/v1/rpc/${name}`, { method: "POST", body: args });
    if (!res.ok) throw new Error(`rpc ${name} ${res.status}`);
    // A function that returns void answers 204 with no body.
    if (res.status === 204) return null;
    return res.json();
  }

  // ---- rate limits -------------------------------------------------------

  // HMAC of the value, keyed with the server secret. The limit table never holds a username or an address.
  async function limitKey(scope, value) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(serviceKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${scope}|${value}`));
    return `owner-auth:${scope}:${toHex(sig)}`;
  }

  // Fails closed: when the limit cannot be checked, the request is refused by the thrown error.
  async function allowed(scope, value, limit, windowSeconds) {
    const key = await limitKey(scope, value);
    return (await rpc("consume_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds })) === true;
  }

  async function limitOrThrow(checks) {
    for (const [scope, value, limit, windowSeconds] of checks) {
      if (!(await allowed(scope, value, limit, windowSeconds))) {
        throw new OwnerAuthError(429, "rate_limited", RATE_TEXT);
      }
    }
  }

  // ---- accounts ----------------------------------------------------------

  async function userIdFor(username) {
    const res = await rest(`/rest/v1/owner_usernames?username=eq.${encodeURIComponent(username)}&select=user_id`);
    if (!res.ok) throw new Error(`username lookup ${res.status}`);
    const rows = await res.json();
    return rows[0]?.user_id ?? null;
  }

  async function usernameFor(userId) {
    const res = await rest(`/rest/v1/owner_usernames?user_id=eq.${encodeURIComponent(userId)}&select=username`);
    if (!res.ok) throw new Error(`user lookup ${res.status}`);
    const rows = await res.json();
    return rows[0]?.username ?? null;
  }

  // Returns the new user's id, or null when the internal address is already taken.
  async function createAccount(username, password) {
    const res = await auth("/admin/users", {
      method: "POST",
      key: serviceKey,
      token: serviceKey,
      body: {
        email: internalEmailFor(username),
        password,
        email_confirm: true,
        app_metadata: { owner_flow: "username-v1" },
      },
    });
    if (res.ok) {
      const created = await res.json();
      return created.id ?? created.user?.id ?? null;
    }
    const body = await readError(res);
    if (isTakenError(body)) return null;
    if (body?.error_code === "weak_password") {
      throw new OwnerAuthError(400, "password_rejected", "That password is not accepted. Choose a different one.");
    }
    // The error code is safe to log. The message can echo input, so it is not logged.
    console.error("owner-auth: account creation refused", res.status, body?.error_code ?? "unknown");
    throw new Error(`create user ${res.status}`);
  }

  async function deleteAccount(userId) {
    try {
      const res = await auth(`/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        key: serviceKey,
        token: serviceKey,
      });
      if (!res.ok) console.error("owner-auth: could not remove an account after a failed signup", res.status);
    } catch {
      console.error("owner-auth: could not remove an account after a failed signup");
    }
  }

  async function setPassword(userId, password) {
    const res = await auth(`/admin/users/${encodeURIComponent(userId)}`, {
      method: "PUT",
      key: serviceKey,
      token: serviceKey,
      body: { password },
    });
    if (res.ok) return;
    const body = await readError(res);
    if (body?.error_code === "weak_password") {
      throw new OwnerAuthError(
        400,
        "password_rejected",
        "That password is not accepted. Choose a different one. Your recovery code was used, so use another code.",
      );
    }
    throw new Error(`set password ${res.status}`);
  }

  // Returns the token response, or null when the username and password do not match.
  async function signInWithPassword(username, password) {
    const res = await auth("/token?grant_type=password", {
      method: "POST",
      key: anonKey,
      body: { email: internalEmailFor(username), password },
    });
    if (res.ok) return res.json();
    if (res.status === 429) throw new OwnerAuthError(429, "rate_limited", RATE_TEXT);
    if (res.status >= 500) throw new Error(`token ${res.status}`);
    return null;
  }

  async function revokeSessions(userId) {
    await rpc("revoke_user_sessions", { p_user_id: userId });
  }

  async function burnTime(password) {
    await rpc("owner_auth_burn", { p_password: String(password ?? "").slice(0, 72) });
  }

  async function consumeCode(userId, compact) {
    return (await rpc("owner_consume_recovery_code", { p_user_id: userId, p_code: compact })) === true;
  }

  async function issueCodes(userId) {
    const codes = generateRecoveryCodes(randomBytes);
    if (codes.length !== RECOVERY_CODE_COUNT) throw new Error("code generation");
    await rpc("owner_replace_recovery_codes", { p_user_id: userId, p_codes: codes });
    return codes;
  }

  async function currentPolicies() {
    const nowIso = new Date(clock()).toISOString();
    const out = {};
    for (const kind of ["terms", "privacy"]) {
      const res = await rest(
        `/rest/v1/legal_documents?kind=eq.${kind}&effective_at=lte.${encodeURIComponent(nowIso)}` +
          "&select=kind,version,title,effective_at&order=effective_at.desc&limit=1",
      );
      if (!res.ok) throw new Error(`policy lookup ${res.status}`);
      const rows = await res.json();
      if (rows.length === 0) throw new Error(`no current ${kind} policy`);
      out[kind] = rows[0];
    }
    return out;
  }

  async function recordAcceptances(userId, policies) {
    const rows = ["terms", "privacy"].map((kind) => ({
      user_id: userId,
      kind,
      version: policies[kind].version,
    }));
    const res = await rest("/rest/v1/owner_policy_acceptances", { method: "POST", body: rows, prefer: "return=minimal" });
    if (!res.ok) throw new Error(`acceptance ${res.status}`);
  }

  // ---- handlers ----------------------------------------------------------

  async function handlePolicies() {
    const policies = await currentPolicies();
    return json(200, {
      terms: { version: policies.terms.version, title: policies.terms.title, effective_at: policies.terms.effective_at },
      privacy: { version: policies.privacy.version, title: policies.privacy.title, effective_at: policies.privacy.effective_at },
    });
  }

  async function handleSignup(req) {
    const body = await readJson(req);
    await limitOrThrow([["signup", clientAddress(req), 10, 3600]]);

    const name = checkUsername(body.username);
    if (!name.ok) throw new OwnerAuthError(400, name.code, name.message);

    const password = typeof body.password === "string" ? body.password : "";
    const rules = checkPassword(password, name.username);
    if (!rules.ok) {
      throw new OwnerAuthError(400, "weak_password", "Your password does not meet all the rules.", {
        failures: rules.failures,
      });
    }

    // The client must show the current versions and send them back. An old page cannot skip this.
    const policies = await currentPolicies();
    const accept = body.accept && typeof body.accept === "object" ? body.accept : {};
    if (accept.terms !== policies.terms.version || accept.privacy !== policies.privacy.version) {
      throw new OwnerAuthError(
        400,
        "terms_required",
        "Read and accept the Terms and Conditions and the Privacy Policy to continue.",
        { current: { terms: policies.terms.version, privacy: policies.privacy.version } },
      );
    }

    if (await userIdFor(name.username)) {
      throw new OwnerAuthError(409, "username_taken", TAKEN_TEXT);
    }

    const userId = await createAccount(name.username, password);
    if (!userId) throw new OwnerAuthError(409, "username_taken", TAKEN_TEXT);

    // From here on, any failure removes the new account so that the user can try again with the same name.
    try {
      const reserve = await rest("/rest/v1/owner_usernames", {
        method: "POST",
        body: { username: name.username, user_id: userId },
        prefer: "return=minimal",
      });
      if (reserve.status === 409) throw new OwnerAuthError(409, "username_taken", TAKEN_TEXT);
      if (!reserve.ok) throw new Error(`reserve ${reserve.status}`);

      await recordAcceptances(userId, policies);
      const codes = await issueCodes(userId);
      const token = await signInWithPassword(name.username, password);

      return json(201, {
        username: name.username,
        recovery_codes: codes,
        session: token ? publicSession(token, name.username) : null,
      });
    } catch (err) {
      await deleteAccount(userId);
      throw err;
    }
  }

  async function handleSignin(req) {
    const body = await readJson(req);
    const address = clientAddress(req);
    const typed = normalizeUsername(body.username);
    const password = typeof body.password === "string" ? body.password : "";

    await limitOrThrow([
      ["signin-ip", address, 60, 900],
      ["signin-user", typed || "(empty)", 10, 900],
    ]);

    if (password === "") throw new OwnerAuthError(400, "password_required", "Enter your password.");

    const name = checkUsername(typed);
    if (!name.ok) {
      await burnTime(password);
      throw new OwnerAuthError(401, "invalid_credentials", INVALID_TEXT);
    }

    const userId = await userIdFor(name.username);
    if (!userId) {
      // Same work as a wrong password, so an unknown name is not faster to refuse.
      await burnTime(password);
      throw new OwnerAuthError(401, "invalid_credentials", INVALID_TEXT);
    }

    const token = await signInWithPassword(name.username, password);
    if (!token) throw new OwnerAuthError(401, "invalid_credentials", INVALID_TEXT);

    return json(200, { username: name.username, session: publicSession(token, name.username) });
  }

  async function handleReset(req) {
    const body = await readJson(req);
    const address = clientAddress(req);
    const name = checkUsername(body.username);
    const code = normalizeRecoveryCode(body.recovery_code);
    const newPassword = typeof body.new_password === "string" ? body.new_password : "";

    await limitOrThrow([
      ["reset-ip", address, 30, 3600],
      ["reset-user", name.ok ? name.username : "(invalid)", 5, 3600],
    ]);

    if (!name.ok || code === null) {
      await burnTime(newPassword);
      throw new OwnerAuthError(401, "reset_failed", RESET_TEXT);
    }

    // The new password is checked before a code is used, so a weak password costs no code.
    const rules = checkPassword(newPassword, name.username);
    if (!rules.ok) {
      throw new OwnerAuthError(400, "weak_password", "Your new password does not meet all the rules.", {
        failures: rules.failures,
      });
    }

    const userId = await userIdFor(name.username);
    if (!userId) {
      await burnTime(newPassword);
      throw new OwnerAuthError(401, "reset_failed", RESET_TEXT);
    }

    if (!(await consumeCode(userId, code))) {
      throw new OwnerAuthError(401, "reset_failed", RESET_TEXT);
    }

    await revokeSessions(userId);
    await setPassword(userId, newPassword);
    const codes = await issueCodes(userId);
    const token = await signInWithPassword(name.username, newPassword);

    return json(200, {
      username: name.username,
      recovery_codes: codes,
      session: token ? publicSession(token, name.username) : null,
    });
  }

  async function handleRegenerate(req) {
    const access = bearerToken(req);
    if (!access) throw new OwnerAuthError(401, "session_required", "Sign in again to continue.");

    const who = await auth("/user", { key: anonKey, token: access });
    if (!who.ok) throw new OwnerAuthError(401, "session_required", "Sign in again to continue.");
    const userId = (await who.json())?.id;
    if (!userId) throw new OwnerAuthError(401, "session_required", "Sign in again to continue.");

    await limitOrThrow([["regen-user", userId, 5, 3600]]);

    const username = await usernameFor(userId);
    if (!username) throw new OwnerAuthError(401, "session_required", "Sign in again to continue.");

    const body = await readJson(req);
    const password = typeof body.current_password === "string" ? body.current_password : "";
    if (password === "") throw new OwnerAuthError(400, "password_required", "Enter your current password.");

    const check = await signInWithPassword(username, password);
    if (!check) throw new OwnerAuthError(401, "password_incorrect", "The current password is not right.");
    // The check opened a session of its own. End that session only, not the one in use.
    await auth("/logout?scope=local", { method: "POST", key: anonKey, token: check.access_token }).catch(() => {});

    const codes = await issueCodes(userId);
    return json(200, { username, recovery_codes: codes });
  }

  // ---- router ------------------------------------------------------------

  return async function handle(req) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (!configured) {
      return json(503, { code: "not_configured", message: "Sign-in is not set up on this server yet." });
    }

    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    const at = parts.lastIndexOf("owner-auth");
    const action = (at >= 0 ? parts.slice(at + 1) : parts.slice(-1)).join("/");

    try {
      if (action === "policies") {
        if (req.method !== "GET") throw new OwnerAuthError(405, "method_not_allowed", "Use GET.");
        return await handlePolicies();
      }
      const routes = {
        signup: handleSignup,
        signin: handleSignin,
        reset: handleReset,
        "codes/regenerate": handleRegenerate,
      };
      if (!(action in routes)) throw new OwnerAuthError(404, "not_found", "Not found.");
      if (req.method !== "POST") throw new OwnerAuthError(405, "method_not_allowed", "Use POST.");
      return await routes[action](req);
    } catch (err) {
      return failure(err);
    }
  };
}
