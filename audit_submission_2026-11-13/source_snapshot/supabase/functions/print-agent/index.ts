// print-agent: the API the QRquick print agent on a shop computer uses.
//
// Deployed with verify_jwt = false, because the agent has no Supabase login.
// Deploy with:  supabase functions deploy print-agent --no-verify-jwt
//
// Every call except pairing carries the agent's own token in the Authorization
// header. The token is hashed here and only the hash reaches the database, so the
// database never sees the raw token. Database checks (agent belongs to a shop, lease
// still valid, attempt number matches) are in migration 0010.
//
//   POST /functions/v1/print-agent/pair       { code, name, platform, version }
//   POST /functions/v1/print-agent/heartbeat  { version, printers }
//   POST /functions/v1/print-agent/claim      {}
//   POST /functions/v1/print-agent/printing   { job_id, attempt }
//   POST /functions/v1/print-agent/finish     { job_id, attempt, outcome, error_code?, error_message? }
//
// Errors are { code, message }. Nothing here logs tokens, file names, file links or
// the database's own error text.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";

const FILE_LINK_SECONDS = 180; // the agent downloads at once; the claim lease is 2 minutes
const MAX_BODY_BYTES = 64 * 1024;
const ACTIONS = new Set(["pair", "heartbeat", "claim", "printing", "finish"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function serviceHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Same rule as public.print_code_hash in migration 0010: letters and digits only, upper case.
function pairingCodeHash(code: string): Promise<string> {
  return sha256Hex(code.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const text = btoa(String.fromCharCode(...bytes));
  return "qpa_" + text.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return /^[A-Za-z0-9_-]{32,128}$/.test(token) ? token : null;
}

function clientIp(req: Request): string {
  const forwarded = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return forwarded || req.headers.get("cf-connecting-ip") || "unknown";
}

// Maps the database's named errors to answers the agent can act on. Anything else is
// logged by name only, so no database text or identifiers leave the function.
function mapDatabaseError(name: string, message: string, status: number): ApiError {
  if (message.includes("pairing_code_invalid")) {
    return new ApiError(400, "pairing_code_invalid", "That code is not valid or has expired. Make a new code in the owner app.");
  }
  if (message.includes("agent_unauthorized")) {
    return new ApiError(401, "agent_unauthorized", "This computer is no longer connected to QRquick. Pair it again.");
  }
  if (message.includes("lease_lost")) {
    return new ApiError(409, "lease_lost", "QRquick took this job back. Do not print it.");
  }
  if (message.includes("printers_invalid")) {
    return new ApiError(400, "printers_invalid", "The printer list could not be read.");
  }
  if (message.includes("outcome_invalid")) {
    return new ApiError(400, "outcome_invalid", "The job result is not valid.");
  }
  console.error(`print-agent: ${name} failed (${status})`);
  return new ApiError(500, "server_error", "The printing service had a problem. Try again.");
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = String((data as { message?: unknown } | null)?.message ?? "");
    throw mapDatabaseError(name, message, res.status);
  }
  return data as T;
}

async function allowed(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const ok = await rpc<boolean>("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  return ok === true;
}

async function signFile(storagePath: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/customer-files/${storagePath}`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ expiresIn: FILE_LINK_SECONDS }),
  });
  if (!res.ok) throw new Error(`signing failed: ${res.status}`);
  const signed = (await res.json()) as { signedURL?: string };
  if (!signed.signedURL) throw new Error("signing returned no url");
  return `${SUPABASE_URL}/storage/v1${signed.signedURL}`;
}

function requireUuid(value: unknown, what: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ApiError(400, "bad_request", `The ${what} is not valid.`);
  }
  return value;
}

function requireAttempt(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 50) {
    throw new ApiError(400, "bad_request", "The attempt number is not valid.");
  }
  return value as number;
}

async function pair(req: Request, body: Record<string, unknown>): Promise<Response> {
  if (!(await allowed(`pair:${await sha256Hex(clientIp(req))}`, 10, 600))) {
    throw new ApiError(429, "rate_limited", "Too many pairing attempts. Wait ten minutes and try again.");
  }
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const platform = body.platform;
  const version = typeof body.version === "string" ? body.version.slice(0, 20) : null;

  if (!/^[A-Za-z0-9-]{6,12}$/.test(code)) {
    throw new ApiError(400, "pairing_code_invalid", "Enter the code shown in the owner app.");
  }
  if (name.length < 1) {
    throw new ApiError(400, "bad_request", "Give this computer a name.");
  }
  if (platform !== "windows" && platform !== "linux") {
    throw new ApiError(400, "bad_request", "This print agent runs on Windows and Linux.");
  }

  // The token is created here, shown to the agent once, and only its hash is stored.
  const token = newToken();
  const result = await rpc<{ agent_id: string; shop_name: string }>("consume_print_pairing", {
    p_code_hash: await pairingCodeHash(code),
    p_token_hash: await sha256Hex(token),
    p_name: name,
    p_platform: platform,
    p_version: version,
  });
  return json(200, { agent_id: result.agent_id, shop_name: result.shop_name, token });
}

async function heartbeat(tokenHash: string, body: Record<string, unknown>): Promise<Response> {
  await rpc("agent_heartbeat", {
    p_token_hash: tokenHash,
    p_version: typeof body.version === "string" ? body.version.slice(0, 20) : null,
    p_printers: body.printers ?? null,
  });
  return json(200, { ok: true });
}

async function claim(tokenHash: string): Promise<Response> {
  const job = await rpc<Record<string, unknown> | null>("agent_claim_next_job", {
    p_token_hash: tokenHash,
  });
  if (!job) return json(200, { job: null });

  const fileUrl = await signFile(String(job.storage_path));
  // The storage path stays on the server. The agent only gets a short-lived link.
  const { storage_path: _path, ...safe } = job;
  return json(200, { job: { ...safe, file_url: fileUrl } });
}

async function printing(tokenHash: string, body: Record<string, unknown>): Promise<Response> {
  await rpc("agent_mark_printing", {
    p_token_hash: tokenHash,
    p_job_id: requireUuid(body.job_id, "job"),
    p_attempt: requireAttempt(body.attempt),
  });
  return json(200, { ok: true });
}

async function finish(tokenHash: string, body: Record<string, unknown>): Promise<Response> {
  const outcome = body.outcome;
  if (outcome !== "sent" && outcome !== "failed") {
    throw new ApiError(400, "outcome_invalid", "The job result is not valid.");
  }
  const errorCode = typeof body.error_code === "string" && /^[a-z_]{1,60}$/.test(body.error_code)
    ? body.error_code
    : null;
  const errorMessage = typeof body.error_message === "string" ? body.error_message.slice(0, 300) : null;

  await rpc("agent_finish_job", {
    p_token_hash: tokenHash,
    p_job_id: requireUuid(body.job_id, "job"),
    p_attempt: requireAttempt(body.attempt),
    p_outcome: outcome,
    p_error_code: outcome === "failed" ? errorCode ?? "print_failed" : null,
    p_error_message: outcome === "failed" ? errorMessage : null,
  });
  return json(200, { ok: true });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json(405, { code: "method_not_allowed", message: "Use POST." });

  const action = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!ACTIONS.has(action)) return json(404, { code: "not_found", message: "Unknown print agent request." });

  if (Number(req.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return json(413, { code: "too_large", message: "The request is too large." });
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) throw new Error("too large");
    const parsed = text ? JSON.parse(text) : {};
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { code: "bad_request", message: "Send the request as a JSON object." });
  }

  try {
    // A per-address limit covers every action, so random tokens cannot flood the database.
    if (!(await allowed(`agent-ip:${await sha256Hex(clientIp(req))}`, 600, 60))) {
      throw new ApiError(429, "rate_limited", "Too many requests. Wait a minute and try again.");
    }

    if (action === "pair") return await pair(req, body);

    const token = bearerToken(req);
    if (!token) {
      throw new ApiError(401, "agent_unauthorized", "This computer needs to be paired first.");
    }
    const tokenHash = await sha256Hex(token);
    if (!(await allowed(`agent:${tokenHash}`, 240, 60))) {
      throw new ApiError(429, "rate_limited", "Too many requests from this computer. Wait a minute.");
    }

    switch (action) {
      case "heartbeat":
        return await heartbeat(tokenHash, body);
      case "claim":
        return await claim(tokenHash);
      case "printing":
        return await printing(tokenHash, body);
      case "finish":
        return await finish(tokenHash, body);
      default:
        throw new ApiError(404, "not_found", "Unknown print agent request.");
    }
  } catch (err) {
    if (err instanceof ApiError) {
      return json(err.status, { code: err.code, message: err.message });
    }
    console.error("print-agent: unexpected failure");
    return json(500, { code: "server_error", message: "The printing service had a problem. Try again." });
  }
});
