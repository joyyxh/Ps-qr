// upload-file: a customer sends one file for a shop. The server checks the type
// and size from the bytes, counts PDF pages, and stores the file privately.
// Deployed with verify_jwt = false, because customers are anonymous.
//
// POST /functions/v1/upload-file?shop=<slug>
//   body: raw file bytes
//   header X-File-Name: encodeURIComponent(file name)   (optional)
// Returns { file_id, page_count, original_name, mime_type, size_bytes, expires_at }.
//
// Nothing here logs file names or contents. Errors return { code, message }.

import { PDFDocument } from "npm:pdf-lib@1.17.1";
import {
  checkBytes,
  measurePages,
  MAX_UPLOAD_BYTES,
  nameFromHeader,
  parseShopSlug,
  readBodyLimited,
  UploadError,
} from "./checks.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
const BUCKET = "customer-files";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-file-name, apikey, authorization, x-client-info",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function fail(err: unknown): Response {
  if (err instanceof UploadError) {
    return json(err.status, { code: err.code, message: err.message });
  }
  // Only the error type goes to the logs, never the file or the response body.
  console.error("upload-file: unexpected failure", (err as Error)?.name ?? "error");
  return json(500, { code: "server_error", message: "The upload did not go through. Try again." });
}

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...extra };
}

async function countPdfPages(bytes: Uint8Array): Promise<number> {
  try {
    const doc = await PDFDocument.load(bytes);
    return doc.getPageCount();
  } catch (err) {
    if (/encrypt/i.test(String((err as Error)?.message ?? ""))) {
      throw new UploadError(
        422,
        "encrypted_pdf",
        "This PDF is password protected. Remove the password, then upload it again.",
      );
    }
    throw new UploadError(422, "unreadable_pdf", "This PDF could not be read. Try saving it again as a PDF.");
  }
}

async function findOpenShop(slug: string): Promise<{ id: string }> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/shops?slug=eq.${encodeURIComponent(slug)}&select=id,is_open`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) throw new Error(`shop lookup failed: ${res.status}`);
  const rows = (await res.json()) as Array<{ id: string; is_open: boolean }>;
  if (rows.length === 0) {
    throw new UploadError(404, "shop_not_found", "This shop was not found.");
  }
  if (!rows[0].is_open) {
    throw new UploadError(409, "shop_closed", "This shop is closed right now, so it is not taking files.");
  }
  return { id: rows[0].id };
}

async function storeObject(path: string, bytes: Uint8Array, type: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": type, "x-upsert": "false" }),
    body: bytes,
  });
  if (!res.ok) throw new Error(`storage upload failed: ${res.status}`);
}

async function removeObject(path: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: serviceHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: [path] }),
  });
}

async function insertFileRow(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/customer_files`, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`file row insert failed: ${res.status}`);
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  return rows[0];
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed", message: "Use POST." });

  try {
    const slug = parseShopSlug(new URL(req.url).searchParams.get("shop"));
    const shop = await findOpenShop(slug);

    const declared = Number(req.headers.get("content-length") ?? "0");
    if (declared > MAX_UPLOAD_BYTES) {
      throw new UploadError(413, "too_large", "The file is larger than 10 MB. Try a smaller file.");
    }

    const bytes = await readBodyLimited(req.body, MAX_UPLOAD_BYTES);
    const { type, ext } = checkBytes(bytes);
    const originalName = nameFromHeader(req.headers.get("x-file-name"));
    const pages = await measurePages(bytes, type, countPdfPages);

    const fileId = crypto.randomUUID();
    const path = `${shop.id}/${fileId}.${ext}`;
    await storeObject(path, bytes, type);

    try {
      const row = await insertFileRow({
        id: fileId,
        shop_id: shop.id,
        storage_path: path,
        mime_type: type,
        size_bytes: bytes.byteLength,
        page_count: pages,
        original_name: originalName,
      });
      return json(200, {
        file_id: row.id,
        page_count: row.page_count,
        original_name: row.original_name,
        mime_type: row.mime_type,
        size_bytes: row.size_bytes,
        expires_at: row.expires_at,
      });
    } catch (err) {
      // Do not leave a stored object that no row points to.
      await removeObject(path);
      throw err;
    }
  } catch (err) {
    return fail(err);
  }
});
