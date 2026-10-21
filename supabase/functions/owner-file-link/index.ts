// owner-file-link: a signed-in shop owner (or staff) asks for a short-lived link
// to a file that was printed for one of their orders.
//
// Deployed with verify_jwt = true. The gateway checks the token, and then this
// function does two things:
//  1. Asks PostgREST with the OWNER'S token for the order item. RLS on
//     order_items returns the row only if the owner belongs to that shop, so
//     the membership check is the same one the owner's order screen uses.
//  2. Only then reads the storage path with the service role and signs a URL
//     that lasts LINK_SECONDS.
//
// POST /functions/v1/owner-file-link
//   Authorization: Bearer <owner access token>
//   body: { "order_id": "<uuid>", "file_id": "<uuid>" }
// Returns { url, file_name, expires_in }.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
const LINK_SECONDS = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function serviceHeaders(): Record<string, string> {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed", message: "Use POST." });

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return json(401, { code: "unauthenticated", message: "Sign in as a shop owner first." });
  }

  let body: { order_id?: unknown; file_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { code: "bad_request", message: "Send the order and file ids as JSON." });
  }
  const orderId = typeof body.order_id === "string" ? body.order_id : "";
  const fileId = typeof body.file_id === "string" ? body.file_id : "";
  if (!UUID.test(orderId) || !UUID.test(fileId)) {
    return json(400, { code: "bad_request", message: "The order or file id is not valid." });
  }

  try {
    // 1. The owner's own token. RLS decides which rows come back.
    const itemRes = await fetch(
      `${SUPABASE_URL}/rest/v1/order_items?select=file_id,file_name&order_id=eq.${orderId}&file_id=eq.${fileId}`,
      { headers: { apikey: ANON_KEY, Authorization: auth } },
    );
    if (itemRes.status === 401 || itemRes.status === 403) {
      return json(401, { code: "unauthenticated", message: "Sign in again to open this file." });
    }
    if (!itemRes.ok) throw new Error(`order item lookup failed: ${itemRes.status}`);
    const items = (await itemRes.json()) as Array<{ file_id: string; file_name: string }>;
    if (items.length !== 1) {
      // Same answer for "no such file" and "not your shop", so ids cannot be probed.
      return json(404, { code: "not_found", message: "No file for this order was found for your shop." });
    }

    // 2. Storage path from the server-only table, then a short-lived signed URL.
    const fileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/customer_files?select=storage_path&id=eq.${fileId}&storage_deleted_at=is.null`,
      { headers: serviceHeaders() },
    );
    if (!fileRes.ok) throw new Error(`file lookup failed: ${fileRes.status}`);
    const files = (await fileRes.json()) as Array<{ storage_path: string }>;
    if (files.length !== 1) {
      return json(404, { code: "not_found", message: "This file is no longer stored." });
    }

    const signRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/customer-files/${files[0].storage_path}`,
      {
        method: "POST",
        headers: { ...serviceHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: LINK_SECONDS }),
      },
    );
    if (!signRes.ok) throw new Error(`signing failed: ${signRes.status}`);
    const signed = (await signRes.json()) as { signedURL?: string };
    if (!signed.signedURL) throw new Error("signing returned no url");

    return json(200, {
      url: `${SUPABASE_URL}/storage/v1${signed.signedURL}`,
      file_name: items[0].file_name,
      expires_in: LINK_SECONDS,
    });
  } catch (err) {
    console.error("owner-file-link: unexpected failure", (err as Error)?.name ?? "error");
    return json(500, { code: "server_error", message: "The file link could not be made. Try again." });
  }
});
