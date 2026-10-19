# PrintNest

QR-based printing counters for local print shops in India. Customers scan a
shop's QR code, upload a file, build a print order in the browser, see the
server-calculated price, and get a tracking code. Shop owners manage their shop,
prices, features, payment QR, orders and statistics, from the web or from the
Android app. Each shop is isolated from every other shop.

## Status (18 Oct 2026)

| Stage | What it covers | State |
|---|---|---|
| 1. Backend foundation | Tenants, services, orders, row level security, server-side pricing, order tracking | Built and tested in the live Supabase project |
| 2. Customer page | Shop page, service choice, live server quote, place order, track order | Built and unit tested. Checked in headless Chromium against a mocked backend |
| 3. Owner sign-in and shop setup | Owner sign-in, your shops, create a shop, shop details, open and close switch, service and price editor, shop QR code | Built. Database checks pass on the live project, and the owner screens pass a browser check with a mocked backend. The stage 3 database checks have not been re-run since migration 0003 |
| 4. Files | Upload, server-side PDF page counting, private storage, owner download | Built. Migration `0003` is applied to the live project. Both edge functions are deployed but have not been called live (see below). Image crop and passport layout are not built |
| 5. Owner orders | Order list (open or all), approve, reject, start printing, mark ready, mark completed, cancel, download each order's file | Built. Database checks pass on the live project. Owners refresh the list by hand; live updates are not built |
| 5b. Statistics and payment records | Earnings and revenue (day, week, month, year), order statistics, cancellations, payments (cash or online), popular services, recent activity, CSV export | Built. Migration `0006` is applied to the live project and its 54 database checks pass. The browser check with a mocked backend passes at phone width |
| 5c. Shop features and payment QR | Yes/no features (colour printing, double-sided, and six more), payment QR upload, features and payment QR shown to customers | Built. Migrations `0004` and `0005` are in the repo. Browser check with a mocked backend passes. Not re-checked on the live project in this session |
| 5d. Android app and installable web app | Capacitor app built in GitHub Actions, and an install-to-home-screen web app | Built, **not yet built or run**. See "What is not verified" |
| 6. Local print agent | Simulated printer first, then Windows | Not started |
| 7. Payments and licences | One-time licence checkout, Stripe | Not started (Stripe is installed but not connected) |
| 8. Privacy and hardening | Automatic file deletion, rate limits, audit log | Not started. Until this stage, uploaded files are kept until someone removes them by hand |

Phase 1 research (competitor pages, cost model, licence terms) is **not done yet**.
I did not visit the competitor sites in this session, so the comparison in the
brief is still open.

## Connectors chosen

- **Supabase (used):** Postgres, row level security, auth, private storage and edge
  functions. The project is `printnest` (ref `qvnwqrevgyootaaunrto`) in `ap-south-1`
  (Mumbai) on the free plan. Chosen because the database enforces tenant isolation,
  so the rule is not left to frontend code.
- **Stripe (installed, not connected):** needed for licence payments in Stage 7.
- **Lovable, Replit, Base44 (available, not used):** AI app builders. I wrote the
  code in this repo so you own every line and can host it anywhere.
- **Google Drive, Bird, Zapier, Etherscan:** not relevant to this build.

## Layout

```
printnest/
├── README.md
├── .github/workflows/android-apk.yml   builds the debug APK in GitHub Actions
├── .gitignore                           keeps secrets, build output and caches out of git
├── .env.example                        template for local settings (no real values)
├── mobile/                              Android app (Capacitor 8)
│   ├── package.json, capacitor.config.json, README.md
│   └── scripts/copy-web.mjs             copies web/ into www/ and sets QR/auth URLs
├── supabase/
│   ├── migrations/0001_stage1_foundation.sql   schema, RLS, pricing, RPCs
│   ├── migrations/0002_services_public_policy_fix.sql   anon can read active services
│   ├── migrations/0003_customer_files.sql      private file bucket, file table, pricing from file
│   ├── migrations/0004_shop_features_payment_qr.sql   feature catalogue, yes/no features, payment QR
│   ├── migrations/0005_shop_assets_policy_fix.sql     owner-folder policies for the payment QR bucket
│   ├── migrations/0006_payments_and_statistics.sql    payment fields, order history, statistics functions
│   ├── functions/upload-file/                  upload, type and size checks, page count, storage
│   │   ├── index.ts                            Deno entry point (verify_jwt off)
│   │   └── checks.js                           pure checks, also tested in Node
│   ├── functions/owner-file-link/index.ts      signed link for an owner's order file (verify_jwt on)
│   ├── seed/demo_seed.sql                      dev-only test owners and shops
│   ├── tests/stage1_isolation_tests.sql        29 database checks, rolled back
│   ├── tests/stage3_owner_tests.sql            30 owner permission checks, rolled back
│   ├── tests/stage4_files_tests.sql            23 file checks, rolled back
│   ├── tests/stage5_orders_tests.sql           23 order checks, rolled back
│   ├── tests/stage6_features_tests.sql         shop features and payment QR checks (run log not recorded)
│   ├── tests/stage7_stats_tests.sql            54 payment and statistics checks, rolled back
│   └── tests/upload_checks.test.js             15 upload check tests (Node)
├── tools/make_qr.py                            shop QR poster, SVG and manifest (printing)
├── tools/make_icons.py                         app icons (PNG, standard library only)
├── tools/vendor_qr.mjs                         turns the QR encoder into an ES module for the browser
├── qr/demo-xerox/                              generated QR files for the demo shop
└── web/                                        customer and owner pages (no build step)
    ├── index.html, styles.css, config.js       config.js holds QR/auth redirect URLs
    ├── manifest.webmanifest, sw.js, icons/     installable web app (Android Chrome)
    ├── src/logic.js     pure helpers (formatting, validation, upload, statistics, CSV, QR address)
    ├── src/http.js      shared fetch error handling
    ├── src/api.js       customer REST wrapper and upload, strips price fields
    ├── src/app.js       router and customer page (shop, features, payment QR, upload, cart, order, track)
    ├── src/session.js   owner session, kept in sessionStorage (this tab only)
    ├── src/auth.js      Supabase Auth: sign up, sign in, refresh, sign out
    ├── src/owner-api.js owner requests, sent with the owner's token (shops, services, orders, payments, features, payment QR, storage)
    ├── src/owner.js     owner pages: sign in, shops, details, QR code, features, payment QR, services, orders
    ├── src/owner-stats.js  owner statistics page (earnings, orders, payments, services, activity, CSV)
    ├── src/qr.js        QR code as SVG (on the page) or canvas (PNG download)
    ├── src/vendor/qrcode/  QR encoder (MIT, Kazuhiko Arase; see LICENSE.txt)
    └── tests/           node:test unit tests (109); browser/ holds the Playwright browser checks (see its README)
```

## How the money, files and tenancy rules work

- **Money is stored as whole paise** (1 rupee = 100 paise). No floats anywhere.
- **Prices are calculated only on the server.** The browser sends the customer's
  choices: service, uploaded file id, copies, colour, double-sided. `place_order` and
  `quote_order` look up the price from the `services` table. The browser cannot set a
  price, and the API layer strips any price field before sending.
- **Page counts come from the server, not the customer.** The upload function counts
  the pages of a PDF and stores that number with the file. `place_order` and
  `quote_order` take the page count from that stored row. A `page_count` sent by the
  browser is ignored.
- **Three pricing units:**
  - `per_side`: every printed side is billed. Double-sided does not change the count.
  - `per_sheet`: every physical sheet is billed. Double-sided halves the sheets, so a
    12-page document costs 6 sheets per copy.
  - `per_copy`: one charge per copy, regardless of pages (for example a passport sheet).
- **Quote and order use the same pricing function**, so the preview cannot drift
  from the final amount.
- **Features are enforced by the database too.** A shop with colour printing or
  double-sided switched off gets an error if an order asks for them, even if the page
  is changed by hand.
- **Order items are a permanent snapshot.** A database trigger blocks any change to
  them, so later price changes never alter an existing order. Each item also keeps the
  file name it was priced from.
- **Each file goes into one order, and only once.** `place_order` claims the file in the
  same transaction as the order. A second claim fails, and a unique index on order items
  backs that up.
- **Files are server-only.** No anonymous or signed-in role can read or write the file
  table or the customer bucket. Only the edge functions, which use the service role,
  touch the bytes.
- **Payment QR pictures are public, on purpose.** They sit in the `shop-assets` bucket
  (PNG or JPEG, 2 MB). Each shop can write only to its own folder, and the shop record
  can point only at a file in that folder that really exists.
- **Owners download files through a short link.** `owner-file-link` first asks the
  database, with the owner's own token, whether the owner's shop owns that order item.
  Only then does it sign a URL that lasts five minutes. A file from another shop gets the
  same "not found" answer as a missing file.
- **Order money and identity fields are locked** after creation. Status can only move
  along the allowed path: pending → approved → printing → ready → completed, with
  rejected or cancelled as exits.
- **Payments and refunds are recorded by the owner.** Each order has a payment status
  (unpaid, pending, paid, refunded), a channel (cash or online), and a history. A
  refund records the full order total, and the database refuses any other amount. Cancelled and rejected orders take no new
  payment. Net earnings leave out cancelled, rejected and refunded orders.
- **Statistics use Indian calendar days.** Periods are days in India time (IST), a
  week starts on Monday, and a period can cover at most 800 days.
- **Customers never query the orders table.** They use `place_order` to create an
  order and `track_order` to read status with their code. Shop staff read orders
  only for shops they belong to.

## Authentication and customer access

Customers do not create accounts. A shop QR code opens `/s/<shop-slug>`; the
customer can read the shop's public services, upload a PDF/JPEG/PNG anonymously,
place an order through the `place_order` RPC, and check status with the returned
tracking code through `track_order`. The database grants anonymous access only to
the public reads and these narrowly scoped RPCs. Anonymous users cannot select
orders, order items, customer files, memberships, or private storage objects.

Only shop owners use `#/owner`. The owner pages require a Supabase session, and
all shop/order/file operations are checked again by RLS and owner-only edge
functions. No service-role key is shipped to the browser or APK.

### Supabase email confirmation setup

The source does not invent a production domain. Set the real deployed HTTPS site
URL in the Supabase Dashboard for project `printnest` (`qvnwqrevgyootaaunrto`):

1. **Authentication → URL Configuration → Site URL:**
   `https://YOUR-REAL-DEPLOYED-DOMAIN/`
2. **Authentication → URL Configuration → Redirect URLs:** add the same exact
   URL, including the trailing slash. Add a separate local development URL only
   if needed; do not use it for a release APK.
3. **Authentication → Providers → Email:** keep email provider enabled and
   enable **Confirm email** for owner registration.

The web app sends `redirect_to` only when it has a safe HTTPS URL. On a deployed
HTTPS page it uses that page as the fallback. The Android packaging script copies
`PRINTNEST_PUBLIC_URL` into both `publicBaseUrl` and `authRedirectUrl`; therefore
the release workflow must receive the real deployed URL, not localhost.

Supabase confirmation links return tokens in the URL fragment. `web/src/app.js`
now consumes that fragment, calls `/auth/v1/user` with the access token, persists
the session, removes the tokens from browser history, and opens the owner area.
No Android deep-link configuration is required when confirmation opens the real
HTTPS website. A native deep link is an optional future enhancement, not a
requirement for this flow.

## What is verified

- **Database checks, live project:**
  - Stage 1: 29 checks in `supabase/tests/stage1_isolation_tests.sql`, all pass after
    migration 0003. The fixtures now create uploaded-file rows, and the whole run is in
    one transaction that rolls back. The earlier run had found a tracking-code bug, which
    is fixed.
  - Stage 4: 23 checks in `supabase/tests/stage4_files_tests.sql`, all pass. They check
    the bucket settings, that anonymous and signed-in users cannot read or write files,
    server page counts pricing the order, quote not claiming a file, a claimed file
    being refused a second time, a repeated file in one order, an item without a file,
    expired and other-shop files, a refused multi-item order leaving nothing behind, the
    one-file-one-item index, name and type limits, and owners seeing only their own file
    names. The fixtures stand in for the upload function, which the sandbox cannot call.
  - Stage 5: 23 checks in `supabase/tests/stage5_orders_tests.sql`, all pass with the new
    file fixtures. An owner can move an order only along the allowed path, cannot change
    its total, note or code, and cannot see other shops' orders.
  - Stage 5b (migration 0006): 54 checks in `supabase/tests/stage7_stats_tests.sql`, all
    pass, and the run rolls back. They check payment rules, refund limits, net earnings
    (cancelled, rejected and refunded orders left out), cancellation reasons, the service
    breakdown, IST day boundaries, and that an owner sees only their own shop. Fixed
    expected values: 7 orders worth ₹44.00, net earnings ₹22.00, ₹33.00 collected, and
    a 28.6% cancellation rate.
  - Stage 3: 30 checks in `supabase/tests/stage3_owner_tests.sql` passed before migration
    0003. **Not re-run since.** That migration does not touch shops, memberships or
    services, but the run should still be repeated.
- **Upload checks (Node):** 15 tests in `supabase/tests/upload_checks.test.js` cover
  detecting PDF, JPEG and PNG from their first bytes, refusing empty, oversized and
  unknown files, reading the body with a limit, the page-count rules (1 to 500), file
  name cleaning, and shop slug and id format.
- **Page counting with pdf-lib 1.17.1 (checked outside the repo):** a three-page PDF
  counts as 3. A truncated or junk PDF throws, and the message does not contain the word
  "encrypted", so it gets the unreadable message. pdf-lib's message for a password-protected
  file contains "is encrypted", which is what the function matches on. A PDF saved with no
  pages loads back as one page, so the empty-PDF rule does not catch that case. That only
  means the customer pays for one page they did not need.
- **Edge functions:** both are deployed to the live project. `upload-file` has JWT
  checks off, because customers are anonymous. `owner-file-link` has them on. Both send
  `Access-Control-Allow-Origin: *` (read in the code). The TypeScript syntax was checked
  with the TypeScript compiler. **They have not been run under Deno or called live**,
  because the sandbox cannot reach the project's API.
- **Security advisor:** no new issues from migration 0003. The only warnings are the
  intended ones: the file table has RLS on with no policies, on purpose. The customer RPCs
  (`place_order`, `quote_order`, `track_order`) must be callable by anonymous customers,
  and `create_shop` by signed-in owners. **Leaked password protection is still disabled.**
  Enable it in Supabase Auth (advisor link:
  https://supabase.com/docs/guides/auth/password-security).
- **Browser checks, mocked backend** (headless Chromium at phone width, 390 px). The
  scripts live in `web/tests/browser/` with their own README. They still contain sandbox
  paths, so they need the small edits described there before they run on your computer.
  The customer-upload and owner-download checks (17 and 8) were run from the sandbox
  before the scripts were copied in, and are not in that folder.
  - Customer upload: 17 checks. A Word file is refused before any upload. A PDF uploads,
    shows the server page count, and adds to the cart. The quote and order send a file
    id and no page count. The upload sends no user token. The same file cannot go in
    twice. A password-protected PDF shows the server's reason. A closed shop takes no
    files. No horizontal scroll, no JavaScript errors.
  - Owner download: 8 checks. Only the item with a file gets a button. The link request
    carries the owner token and names the order and file. The signed URL opens in a new
    tab. A file outside the shop shows "not found".
  - Owner screens: 39 of 39 pass, including the orders, services, shop details and the
    customer address and QR code card.
  - Statistics page: 26 of 26 pass. Date presets, the custom range and its errors, the
    weekly report, payment and cancellation actions, both CSV exports, and no sideways
    scrolling.
  - Features and payment QR: 24 of 24 pass. All eight features save as yes or no. A text
    file is refused before any request. A PNG goes into the shop's own folder and is
    attached to the shop. Replacing it removes the old file, and removing it clears the
    shop's picture. The customer page lists the features that are on, shows the payment
    QR, greys out colour and double-sided when the shop has them off, and blocks a
    colour-only service.
  - Shop QR code: 16 of 16 pass. The code on the page and the downloaded PNG both decode
    with OpenCV 5.0.0 to the shop's address, for a local address and for a published one.
    The local-address warning appears only for the local address.
  - The backend is a mock in all of these, so none of them prove the real sign-in or the
    live upload works.
- **Web unit tests:** 106 of 106 pass (`npm test` in `web/`). They cover formatting,
  validation, rupee-to-paise conversion, upload checks, HTML escaping, the session and
  refresh logic, the customer upload request (raw body, publishable key only, no user
  token), the owner requests (token sent, only allowed columns, the file link, features,
  payment QR upload and removal, storage paths), the statistics rules (IST dates, ranges,
  comparisons, grouping, CSV escaping, payment and refund rules), the QR address and
  its problems, the QR code matrix and SVG, and a check that no service-role key appears
  in the browser code (including the vendored QR encoder).

## What is not verified

- **The Android APK has not been built.** This sandbox cannot reach npm, Gradle's
  download servers or Google's Android servers (the proxy refuses those hosts). The APK
  comes from the GitHub Actions workflow in `.github/workflows/android-apk.yml`, which
  has not run yet. The Capacitor version (8.5.3) was taken from a release listing, not
  checked against npm.
- **Not tested on a phone or in the Android app's web view.** The screens were checked
  in a desktop browser at phone width. Downloads (the QR PNG and the CSV exports) use a
  browser download link, and the Android web view may not save them. The installable web
  app saves them normally. A native save plugin is the fix if the APK is the main route.
- **Not run against the real sign-in or the real upload.** This sandbox cannot reach
  `supabase.co`. Sign-up, email confirmation, sign-in, the upload, the payment QR upload
  and the file link have not been tried against the live project from here. Try them on
  your machine before relying on the owner pages.
- **Migrations 0004 and 0005 are not re-checked on the live project** in this session.
  The owner features and payment QR need them, and the storage policies they set should
  be confirmed in the Supabase dashboard.
- **The edge functions have not been run under Deno.** Deno is not installed here, so
  `upload-file` and `owner-file-link` have only been syntax-checked, and their network
  calls only tested through mocks. The first real upload is the test. Parsing a large
  PDF (up to 10 MB) may hit the function's time or memory limit. That has not been
  tested either.
- **Uploads are not scanned for malware.** A PDF can carry scripts or other content.
  Only type and size are checked. Shop staff open these files, so a scan or a sandboxed
  viewer should come before the print agent (Stage 6).
- **Stage 3 database checks not re-run** after migration 0003 (see above).
- **Page count is measured by pdf-lib, not by the printer.** A PDF can be built so that
  pdf-lib and another reader count its pages differently. Then the customer could pay
  for fewer pages than get printed. The print agent (Stage 6) should count again on its
  side and flag a mismatch. Until then, treat the page count as a good estimate, not a
  guarantee.
- **Payments are recorded, not taken.** The owner marks an order paid in cash or online.
  Nothing is collected by PrintNest, and no online payment gateway is connected (Stage 7).
- **No rate limit on uploads.** Anyone can send files to `upload-file` without signing
  in, up to 10 MB each. Unclaimed files expire from use after one day, but nothing
  deletes them from storage yet. Stage 8 adds the cleanup and limits. Claimed files are
  kept until then too. Watch the free plan's storage quota until Stage 8.
- **No passport photo layout or image crop** yet. A passport photo is uploaded as an
  image and priced as one page. The layout and crop are not built.
- **Tracking codes can be guessed.** There are 32^8 combinations, but nothing yet
  rate-limits `track_order`, `place_order` or the upload. Rate limiting is needed before
  launch.
- **The consolidated migration has not been run as one file on a fresh project.** It
  mirrors the migrations applied to the live project, but a fresh setup should be checked
  with the isolation tests after running it.

## Run it on your machine

Requirements: Node 18 or newer (for the tests) and Python 3 (for the local server).
Nothing needs installing.

```bash
cd printnest/web
npm test                 # 106 unit tests, should all pass
npm start                # serves http://localhost:5173
cd ..
node --test supabase/tests/upload_checks.test.js   # 15 upload tests, should all pass
```

Then open:

- Shop page: http://localhost:5173/#/s/demo-xerox
- Track an order: http://localhost:5173/#/track/YOURCODE
- Shop owner pages: http://localhost:5173/#/owner (sign up, then create a shop)

`web/config.js` contains only the project URL, the publishable key and the public
address used in QR codes. All are designed to be public. Never put a service-role key or
payment secret in the browser code. The functions read their service key from the
environment that Supabase provides, not from the repo.

To host it, the `web/` folder is plain static files, so any static host works over
https. The edge functions stay on Supabase.

## Install on an Android phone

There are two ways. Both use the same web app and the same database.

**Option A: the installable web app (works now, downloads work).**

1. Publish the `web/` folder over https (any static host).
2. Open the published address in Chrome on the phone.
3. Menu (three dots) > **Install app**. The app opens full screen at the owner area.

The service worker (`web/sw.js`) keeps the last copy of the page shell for when the
network drops. It never caches Supabase data, so orders and shop details always come
from the server.

**Option B: the Android app (APK, built in GitHub Actions).** See `mobile/README.md`.
In short: push the repository to GitHub, set the repository variable
`PRINTNEST_PUBLIC_URL` to the published https address, run the **Android APK** workflow,
and download `printnest-debug-apk` from the run. It is a debug build, and some
downloads may not save inside the app (see "What is not verified").

## Database and functions on a fresh Supabase project

1. Run `supabase/migrations/0001_stage1_foundation.sql` in the SQL editor.
2. Run `supabase/migrations/0002_services_public_policy_fix.sql`.
3. Run `supabase/migrations/0003_customer_files.sql`. It creates the private
   `customer-files` bucket (10 MB, PDF, JPEG and PNG only).
4. Run `supabase/migrations/0004_shop_features_payment_qr.sql`. It creates the feature
   list, the yes/no feature setting and the payment QR column. It also creates the
   public `shop-assets` bucket (2 MB, PNG and JPEG).
5. Run `supabase/migrations/0005_shop_assets_policy_fix.sql`. It closes the storage
   policies that were too open, and lets each shop write only to its own folder.
6. Run `supabase/migrations/0006_payments_and_statistics.sql`. It adds payment fields,
   the order history and the statistics functions.
7. Deploy the edge functions (with the Supabase CLI, from the repo root):
   ```bash
   supabase functions deploy upload-file --no-verify-jwt
   supabase functions deploy owner-file-link
   ```
   `upload-file` must be deployed without JWT checks, because customers are not signed in.
8. Optional, development only: run `supabase/seed/demo_seed.sql`. Its owner accounts have
   no password, so they cannot sign in. Create an owner account from the sign-up screen
   instead.
9. Run the database checks in the SQL editor. Each one runs in a transaction and rolls
   back, so none of them leaves rows behind. Every row should show `ok = true`:
   - `supabase/tests/stage1_isolation_tests.sql`
   - `supabase/tests/stage4_files_tests.sql`
   - `supabase/tests/stage5_orders_tests.sql`
   - `supabase/tests/stage6_features_tests.sql` (features and payment QR, needs migrations 0004 and 0005; no run recorded yet)
   - `supabase/tests/stage7_stats_tests.sql` (payments and statistics, needs migration 0006)
   - `supabase/tests/stage3_owner_tests.sql` (needs the dev seed)
10. In Supabase Auth settings, set the Site URL to the address the web app is served from,
    because confirmation emails link there. If email confirmation is on, a new owner must
    click the link before the first sign-in. Turn on leaked password protection (see the
    advisor link above).
11. In `web/config.js`, set `publicBaseUrl` to the published https address (for example
    `https://printnest.example/`) before printing any QR code.

## Test rows left in the live project

My test runs left 6 orders (note `test-run` or `probe`) and a shop `test-new-shop`
with its owner membership, all from Stage 1, before the test runs were wrapped in
rollback. Stage 4 and Stage 5 test runs left nothing behind. I did not delete the old
rows: the tool needs your confirmation for destructive statements. To remove them, run
this in the Supabase SQL editor:

```sql
delete from public.orders where customer_note in ('test-run', 'probe');
delete from public.shops where slug like 'test-%';
```

## QR codes for shops

Each shop has one QR code that opens its public page (`#/s/<slug>`). The code
encodes the full address, so it is only as good as the domain it points to.

**In the owner page.** Open a shop, then **Customer page and QR code**. The code is
drawn on the page, and **Download QR as PNG** saves it for printing. The address it
encodes is `publicBaseUrl` from `web/config.js` (or the `PRINTNEST_PUBLIC_URL` value in
the APK build). If that is empty, the page's own address is used, and the owner sees a
warning when the address is local (localhost) or not https. Printed codes must point at
the published https address.

**For a printed poster.** `tools/make_qr.py` makes an A4 poster, a vector SVG and a
manifest, and it decodes its own PNG before writing anything else:

```bash
pip install opencv-python pillow reportlab      # on your machine, once
python3 tools/make_qr.py --slug demo-xerox \
  --name "Demo Xerox Centre" --address "Main Road, Ranchi" \
  --shop-id bbbbbbbb-0000-0000-0000-000000000001 \
  --base-url https://your-domain.example
```

Outputs go to `qr/<slug>/`:

- `poster.pdf`: A4 poster with the code, shop name, address and the URL printed under it.
- `qr.png`: raster code, 12 pixels per module.
- `qr.svg`: vector code for print shops and designers.
- `manifest.json`: what was encoded, the error-correction level, when it was made,
  and the self-check result.

If the decoded text does not match the URL, the script stops and writes nothing. Plain
`http://` is only accepted for localhost testing.

The demo files in `qr/demo-xerox/` encode `http://localhost:5173`, which only works on
the device running the server. Changing the domain or renaming a slug changes the code,
so regenerate and reprint.

## Next steps, in order

1. **Publish and try it on a real phone:** host `web/` over https, set `publicBaseUrl`,
   then sign up, create a shop, download the QR, upload a payment QR, switch features,
   place an order as a customer, and record a payment. Note anything that differs from
   the mocked checks.
2. **Android APK:** push the repository to GitHub, set `PRINTNEST_PUBLIC_URL`, run the
   **Android APK** workflow, install the APK on a phone. If the QR download or the CSV
   export does nothing inside the app, add a native save plugin (Capacitor Filesystem
   and Share), or tell shops to use the installed web app.
3. **Database:** re-run `stage3_owner_tests.sql` after migration 0003, and confirm
   migrations 0004 and 0005 on the live project (bucket settings and storage policies).
4. **Stage 4, still open:** deploy-test the two edge functions on the live project with a
   real PDF and a real owner account. Passport photo layout and image crop. Confirm the
   page count with the print agent once Stage 6 exists.
5. **Stage 3, still open:** staff invitations (for now an owner can add a member only by
   user ID, with no invite flow).
6. **Housekeeping:** delete the test rows above (needs your go-ahead), turn on leaked
   password protection, and check the Site URL in Supabase Auth.
7. **Stage 5:** live updates without a refresh.
8. **Stage 6:** local print agent, starting with a simulated printer.
9. **Stage 7:** connect Stripe, one-time licence checkout, licence entitlements.
10. **Stage 8:** automatic file deletion (unclaimed files after a day, claimed files after
    the order closes), rate limits on uploads and the public RPCs, audit log, and moving
    the browser check scripts into the repo.
11. **Phase 1 still owed:** competitor research against the listed sites, the cost
    model at 10 to 10,000 shops, and draft licence terms.
