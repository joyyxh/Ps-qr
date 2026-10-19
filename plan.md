# QRquick implementation plan

## Scope
Transform the existing PrintNest codebase into QRquick while preserving the working Supabase tenant isolation, anonymous customer ordering, owner authentication, payment records, statistics, private files, and Capacitor Android packaging. Work in staged increments and do not claim printer automation until a real desktop agent and printer have been exercised.

## Implementation approach

1. **Brand and customer shell:** rename visible product identity to QRquick; implement customer-first home, Scan Shop QR entry, Add Your Shop entry, responsive design, accessible states, and light/dark/system theme preference without breaking hash routes.
2. **Customer ordering:** retain anonymous QR shop access, file validation, server quotes, upload/order/tracking RPCs; extend the data model only where current schema cannot represent page ranges, paper sizes, orientation, fit/crop, and payment intent safely. Never trust client prices or payment claims.
3. **Owner/admin:** retain Supabase email confirmation and callback repair; add owner setup fields, capability configuration, payment verification states, filtering/search, and staff authorization only through authenticated server-side policies.
4. **Payments:** preserve UPI QR display and cash flow; make payment verification explicit and owner-controlled, with idempotent transitions and audit history.
5. **Print bridge:** add a separate authenticated desktop-agent protocol and a local agent scaffold that reports pairing, printer discovery, job submission, spooler acceptance, failures, retry state, and retention cleanup. Do not expose service-role credentials or silently claim completion.
6. **Delivery:** update website route metadata and deployment configuration, run automated tests, deploy the web app through the available connector, build the Android APK through GitHub Actions with the permanent HTTPS URL, and report hardware-dependent gaps.

## Design direction

Three candidate styles: **Quiet Print Studio** (0.06), **Utility Neon Counter** (0.04), and **Paper & Ink Editorial** (0.08). Choose **Quiet Print Studio**: warm paper surfaces, ink-black text, one ownable cobalt-blue action color, generous card spacing, restrained motion, and strong mobile-first hierarchy. Use clear CTAs such as “Scan a shop QR” and “Add your shop”; avoid generic marketing copy. The QRquick mark should combine a compact QR-grid motif with a paper corner fold. Light, dark, and system themes must preserve contrast and state clarity.

## Current project structure

- `web/`: static customer and owner application, hash router, API/auth modules, styles, tests.
- `mobile/`: Capacitor 8 packaging; copies `web/` into `www/` and embeds the deployed URL.
- `supabase/migrations/`: live schema, RLS, pricing, order, payment, file, and statistics rules.
- `supabase/functions/`: anonymous upload and authenticated owner file-link edge functions.
- `tools/`: QR poster, icons, and QR encoder tooling.
- `.github/workflows/android-apk.yml`: reproducible debug APK build and artifact upload.
- Future `agent/`: authenticated desktop print bridge, kept separate from the browser and Android client.

## Constraints

No localhost production URLs, no service-role keys in clients, no unauthenticated access to private orders/files, no automatic payment success based on customer claims, and no claim of silent printing without a tested OS/printer integration. Existing database and source are changed incrementally with migrations and regression tests.
