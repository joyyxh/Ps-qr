// owner-auth entry point. The logic lives in owner-auth.js, which the unit tests run under Node.
// Deployed with verify_jwt = false (see docs/AUTH_REDESIGN.md).
//
// The service key is read from the function's environment only. It is never returned,
// never logged and never sent to the browser.

import { createOwnerAuth } from "./owner-auth.js";

const handle = createOwnerAuth({
  supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
  anonKey: Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
  serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "",
});

Deno.serve((req: Request): Promise<Response> => handle(req));
