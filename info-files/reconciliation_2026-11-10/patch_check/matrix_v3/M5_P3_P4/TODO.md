# QRquick delivery TODO

## Product identity and interface

- [ ] Rename the visible application identity from PrintNest to QRquick across web, Android metadata, manifest, README, and user-facing copy.
- [ ] Make the default customer screen immediately offer **Scan Shop QR** as the primary action and **Add Your Shop** near the top.
- [ ] Add responsive phone/tablet/desktop layout, accessible loading/success/error states, smooth restrained transitions, and light/dark/system theme selection.
- [ ] Keep all existing controls functional while improving ordinary-customer and shop-owner navigation.

## Anonymous customer ordering

- [ ] Customer can open a valid shop QR without registering, logging in, or providing an email address.
- [ ] Customer can select PDF, JPG/JPEG, and PNG files; reject unsupported, oversized, malformed, or interrupted uploads safely.
- [ ] Customer can configure supported black-and-white/colour, single/double-sided, copies, page range/selected pages, paper size, orientation, fit-to-page, crop, and image adjustments, with sensible defaults and preview where practical.
- [ ] Customer sees server-measured pages and server-calculated price before submission; no client price or total is trusted.
- [ ] Customer can choose UPI or cash; UPI is only marked payment-verification-pending until an owner verifies it; cash remains pending according to shop policy.
- [ ] Customer receives a secure unguessable tracking token and can see order status without an account.
- [ ] Invalid QR, unavailable shop, upload failure, connection interruption, and unsupported file states are handled clearly.

## Owner/admin access

- [ ] Only owners/staff access registration, login, shop management, order management, payment verification, and printer controls.
- [ ] Repair and test Supabase email confirmation, password recovery, HTTPS redirect configuration, secure callback, session persistence, and logout.
- [ ] Owner setup supports shop details, QR generation, UPI QR upload, prices, services, paper sizes, printer capabilities, and staff access where implemented.
- [ ] Owner dashboard supports new, payment-pending, paid/confirmed, waiting-to-print, printing, completed, cancelled, rejected, refund/dispute records, statistics, revenue/payment summaries, search, filters, history, printer status, and settings.
- [ ] Every authorization decision is enforced server-side with Supabase RLS/RPC/edge-function checks, not only hidden UI controls.

## Payments and order state

- [ ] UPI QR is displayed without treating display or customer assertion as proof of payment.
- [ ] Owner explicitly approves/rejects UPI payment; cash workflow is explicit and configurable.
- [ ] Duplicate approvals and duplicate order processing are prevented with database constraints/idempotent transitions.
- [ ] Every status and payment transition is stored and reflected accurately for customer and owner.

## Desktop print bridge

- [ ] Add a secure authenticated shop-computer pairing flow.
- [ ] Agent detects compatible installed printers and reports availability/errors.
- [ ] Agent receives only authorized jobs, prevents unauthorized/duplicate/repeated printing, applies supported settings, and reconnects safely.
- [ ] Track job submitted, spooler accepted, failed, and completed states; never claim printing merely because a job was sent.
- [ ] Keep uploaded files private; use short-lived authorized links and retention cleanup that never deletes an active/retry-needed job.
- [ ] Provide reproducible agent setup instructions and clearly identify OS/printer-dependent manual setup.

## QR, tenancy, and delivery

- [ ] Each shop has a unique QR and cannot expose another shop's admin or private data.
- [ ] Customer cannot view private files/orders, modify payment state, approve printing, or manipulate another customer's order.
- [ ] Preserve the authoritative Supabase backend and tenant isolation.
- [ ] Keep production HTTPS URLs configurable; never ship localhost or secrets.
- [ ] Maintain automated tests for customer, owner, auth, payments, tenancy, files, agent protocol, responsive/theme UI, and build packaging.
- [ ] Deploy web app, build installable Android APK, publish workflow artifact, and report verified versus hardware-dependent functionality.
