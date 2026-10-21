// cleanup-files: removes customer files that have expired from private storage.
//
// Called once a day by .github/workflows/cleanup-files.yml. It needs the secret in
// the x-cleanup-secret header, so nobody else can trigger it.
// Deploy with:  supabase functions deploy cleanup-files --no-verify-jwt
// Set the secret with:  supabase secrets set CLEANUP_SECRET=<long random text>
//
// The database decides which files may go (expired_customer_file_paths in
// migration 0010): never a file a queued, claimed, printing or needs-check job
// uses, and an order's file only after the order has ended for 30 days.
// Storage objects are deleted first. The database row is then marked, not deleted,
// because order history still points at it. A run that fails part-way can be
// repeated safely.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
const CLEANUP_SECRET = Deno.env.get("CLEANUP_SECRET") ?? "";

const BATCH_SIZE = 100;
const MAX_BATCHES = 20; // at most 2,000 files per run

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function serviceHeaders(): Record<string, string> {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${name} failed: ${res.status}`);
  return (await res.json()) as T;
}

// Constant-time comparison, so the secret cannot be guessed by timing.
function sameSecret(given: string, expected: string): boolean {
  if (!expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json(405, { code: "method_not_allowed", message: "Use POST." });
  if (!sameSecret(req.headers.get("x-cleanup-secret") ?? "", CLEANUP_SECRET)) {
    return json(401, { code: "unauthorized", message: "Not allowed." });
  }

  let removed = 0;
  let failed = 0;
  try {
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const rows = await rpc<Array<{ id: string; storage_path: string }>>("expired_customer_file_paths", {
        p_limit: BATCH_SIZE,
      });
      if (rows.length === 0) break;

      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/customer-files`, {
        method: "DELETE",
        headers: serviceHeaders(),
        body: JSON.stringify({ prefixes: rows.map((row) => row.storage_path) }),
      });
      if (!res.ok) {
        // Stop here. The same files are listed again next run.
        failed += rows.length;
        console.error(`cleanup-files: storage delete failed (${res.status})`);
        break;
      }

      for (const row of rows) {
        await rpc("mark_customer_file_deleted", { p_file_id: row.id });
        removed++;
      }
    }

    const purged = await rpc<number>("purge_old_rate_limits", {});
    return json(200, { removed, failed, rate_limit_rows_purged: purged });
  } catch {
    console.error("cleanup-files: unexpected failure");
    return json(500, { code: "server_error", message: "Cleanup stopped. It will run again tomorrow.", removed, failed });
  }
});
