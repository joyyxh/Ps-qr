# Stage 7 closure report (read-only)

**Date:** 2026-10-30. **Worktree:** `/home/claude/joyyxh/ps-qr-stage7` (`stage7-payments`).

This review only read files and searched them. It did not edit, create, delete, run, commit, push or merge anything. It made no production, Supabase, Docker or GitHub changes and created no users. Code findings show what the code says, not how it behaves at runtime. Nothing here proves runtime behaviour. The worktree, the main checkout and `stash@{0}` are unchanged.

## 1. Executive summary

**Verdict: NOT READY FOR PLANNING APPROVAL.** It is not ready for implementation approval under any reading.

- **Some facts in the document are wrong or out of date.** The most important:
  - C-2 says no scheduler is confirmed. A daily GitHub Actions cron already runs the file purge.
  - The retention wording omits the one-day rule for unclaimed files.
  - Migration 0010 is not applied to any database, according to `docs/PRINTING_STATUS.md`, and the document does not say so.
  - The R18 lock-order statement does not match the code.
  - §9 item 2 is still pending, but M4 approves the 12-month term.
- **Owner decisions are still open.** These include admin identity and MFA, hosting, the existing-shop count, the email-volume tier, the paid-path tax and pricing inputs, and the refund policy.
- **The review found items the document does not cover.**
  - A second `place_order` signature is still granted to anonymous users in the migration chain.
  - The daily cleanup can handle about 3,000 shops at the stated volumes, and no further.
  - Denial logs can grow without a global limit.
  - The repository has no privacy policy, terms or consent text.
  - Enforcement has no designed rollback or kill switch.
- **What holds up:** printing-only enforcement (A), the paid-path block (M5), the M2 revocation rule and the admin-RPC design are consistent with each other. The two printing defects are confirmed by reading the code. Neither has been reproduced.

Planning approval can become possible after the factual corrections in §8 and owner answers to the Group A items in §6.

## 2. Unresolved-decision inventory

Each item gives its status, what it means, why it matters, the recommended default and its consequence, dependencies, what it blocks, and who decides. Item numbers are used in §6.

**1. Held-job file retention (C-1, C-3, M1 file effect).** *Open.*
- A queued job held because the licence is inactive keeps its customer file. The purge skips files used by queued, claimed, printing or needs-check jobs (0010:795–798). A paid order that stays in `printing` never reaches a terminal status, so its file is never purged.
- M1's claim that the file becomes "eligible for deletion" is wrong for those orders. This is a privacy issue.
- Default: no held-job enforcement until a file-release rule exists. Any release rule needs lawyer review.
- Blocks M1 and held-job enforcement. Does not block 7B.
- Decided by: owner (policy), lawyer (privacy), engineering (mechanism).

**2. Hold clock and scheduler (C-2, M1 mechanics).** *Open. One premise is wrong.*
- The document says no scheduler is confirmed. The purge has one: `cleanup-files.yml` runs daily at 20:30 UTC (02:00 IST). No scheduler exists for held-job timeouts.
- Timeouts currently run only inside `agent_claim_next_job` (0010:644). If no agent is online, held jobs wait indefinitely.
- Start-point options: (a) `created_at`, which can fail jobs a day into a lapse; (b) the time the shop left ACTIVE, which needs a stored marker.
- Default: option (b) with a stored marker. A new scheduled job needs separate approval.
- Blocks M1 only.
- Decided by: owner (start point, scheduler approval), engineering (marker and tests).

**3. Paid-term stacking (C-4, M4 versus J).** *Open. Applies only when the paid path is approved.*
- If a paid term is running and the owner pays again early, the new term either starts now (overlap) or at the old end (stacking).
- Default: stacking, so there is no overlap.
- Blocks the paid path only.
- Decided by: owner now.

**4. Paid path, pricing and paid-table scope (I, M5, C-5, C-13, decision 3).** *Blocked.*
- No price, minimum amount, tax treatment or payment-recording policy is approved, so no paid coverage can be created. Complimentary grants are unaffected.
- Default: keep blocked. Exclude `paid_verified` and `licence_payments` from 0011 (C-5).
- Depends on tax (item 18), gateway (item 17) and refunds (item 10).
- Blocks paid coverage and any published price. Does not block 7B–7E.
- Decided by: owner after CA advice.

**5. Admin identity, MFA and Auth UUID (decisions 13, 14; C-6, C-15; §10 items 12–13).** *Pending.*
- No admin, role, MFA, `aal` or TOTP code exists in the repository. There is no `supabase/config.toml`, so Auth settings are not versioned. Live Auth settings, including leaked-password protection and the Site URL, are still on the README's housekeeping list.
- Default: one owner account (decision 13); MFA required for admin RPCs (decision 14); bootstrap by an owner-run SQL row with the owner's own UUID, never inferred.
- MFA means the admin UI needs an enrolment and verification flow, which is new work in 7D.
- Depends on item 6 and on the `aal` evidence in §3.
- Blocks 7A and the admin work in 7C–7D. Does not block the 7B schema itself.
- Decided by: owner (choices and UUID), evidence (MFA feasibility, staging).

**6. Admin UI hosting (decision 15).** *Pending.*
- `pages.yml` publishes everything under `web/` to a public gh-pages site on every push to `main` that changes `web/`. So anything under `web/` is public.
- Default: separate private deployment, outside `web/`, with no link from the shop app.
- Consequence: a separate deployment and secrets, with cost not chosen.
- Blocks 7D.
- Decided by: owner now. Repository visibility and plan need an owner check.

**7. Lifetime, complimentary and grant limits (M6, F, H, C-7, decision 16).** *M6, F and H approved as policy. C-7 to confirm. Decision 16 partly approved.*
- Open: backdating rules, maximum custom length, and whether lifetime is owner-only.
- Default: backdating only with explicit confirmation; lifetime owner-only; the owner enters the custom maximum. No default is invented.
- Blocks paid-related transitions in M6 tests only. Admin-grant tests can proceed.
- Decided by: owner now.

**8. Revocation and future periods (C-8, decision 17, fix 5, fix 9).** *C-8 to confirm. Fix 5 is a proposal.*
- Open: whether revoking current access also cancels future coverage. Same-instant tie-break. Exclusive-end wording.
- Default: revocation does not cancel future coverage; tie-break gives REVOKED; display the exclusive end.
- Test expectations in 7B depend on these answers.
- Blocks finalising 7B state tests.
- Decided by: owner now.

**9. Trial policy (decision 5, C-10).** *Deferred under the 2026-10-29 direction. Owner confirmation pending.*
- Default: keep deferred. No trial kind in 7B.
- Blocks nothing if kept deferred.
- Decided by: owner now.

**10. Refund policy (§9 item 6, C-11).** *Pending. Lawyer review required.*
- The proposal is a full refund within 7 days, then only for duplicate charges or outages.
- Refund policy is separate from the printing refund defect in item 24.
- Blocks the paid path and any refund-dependent test. Does not block 7B.
- Decided by: owner (after lawyer).

**11. Existing shops: count, free period and transition (decision 8, C-14, §5B).** *N not provided. Enabling blocked.*
- The README says the live project holds test rows (for example `test-new-shop` and some test orders). N must exclude them.
- The document's illustration at N = 100 is arithmetic only: year-one net −₹65,700 on Free or −₹88,500 on Pro, against +₹57,796 or +₹34,996 if everyone pays from month one.
- Default: make no free-year promise until N is known.
- Blocks enabling enforcement (E) and any published existing-shop terms.
- Decided by: owner (count and policy), CA or lawyer (notice obligations).

**12. Email-volume tier E (§5A, §10 item 11).** *Undecided.*
- Determines whether Resend Free or Pro applies. Resend Pro costs ₹1,900 a month, but only above the 150 ÷ E threshold.
- Default: keep both scenarios until the owner estimates emails per order from real data.
- Affects financial projections only. Does not block Stage 7 code.
- Decided by: owner.

**13. Expiry, grace and shop-facing view (decisions 7, 18, 19).** *Partly superseded or pending.*
- Printing is blocked in every non-ACTIVE state, so grace is not implied.
- Default: no grace period; web-only view in 7E with fields as in D; labels Active/Inactive; no admin-grant label.
- Android is undecided (see item 28).
- Blocks 7E wording only.
- Decided by: owner now.

**14. Manual payments, verification and audit (decision 20, M5, §12A.7).** *Deferred with the paid path.*
- Proposed methods: UPI direct, bank transfer, cash, cheque, other. References required except for cash. GST invoices for manual receipts need the CA. The audit retention period is not set.
- Blocks the paid path (M5). Does not block 7B.
- Decided by: owner (methods), CA (invoices), lawyer (personal data in audit rows).

**15. Denial and replay retention, denial growth, C-12 (M3, M8, decision 20).** *M3 approved as design. M8 is a policy proposal with legal review required.*
- The per-user cap is 20 detailed denial rows per hour. Over 90 days that is up to 43,200 rows per user.
- Anyone can create an account, so total rows are not bounded. The document has no global ceiling. This is a new finding.
- Replay retention: "to be set in review". Audit retention: not set. C-12 requires the owner to accept count-only records above the cap.
- Default: 90-day denial retention; a global ceiling; keep replay records until a safe mechanism exists.
- Blocks denial logging in 7C until the ceiling is decided.
- Decided by: owner (ceiling and acceptance), lawyer (retention periods), staging test (row growth).

**16. Licence unit and term (decisions 1, 2; §9 items 1–2).** *Pending. Conflicts with M4.*
- §9 item 2 says PENDING while M4 approves the 12-month term.
- Default: per shop, which matches the existing `shop_id` model; 12 months with manual renewal.
- A per-owner or per-computer unit would change the 7B data model.
- Blocks 7B data-model choices.
- Decided by: owner now.

**17. Processor and gateway (decision 9, §4, §10 item 2).** *Pending. Neither processor is confirmed available.*
- Stripe is invite-only for new Indian businesses (verified). Razorpay India signup is unverified (secondary sources).
- Default: defer; manual route first.
- Blocks gateway work only.
- Decided by: owner now (defer). Evidence from processor onboarding later.

**18. GST, input credit, reverse charge and TDS (decision 4, §10 item 3).** *Pending. CA required.*
- No GST route is chosen. The 18% classification is unconfirmed. The exemption status of Notification 10/2017-IT is unchecked. Input credit, reverse charge on foreign services, and TDS are not modelled.
- Blocks pricing tax treatment (I), invoices and the paid path.
- Decided by: CA.

**19. Advisers (decision 11).** *Pending.*
- The plan is an Indian CA and a lawyer before any paid collection. No engagement is evidenced.
- Blocks paid collection and published terms.
- Decided by: owner now. Engagement is the owner's act.

**20. Stage 6 merge order (decision 10, §9 item 10).** *Pending and ambiguous.*
- The base print agent, migration 0010 and the print-agent function are already on `origin/main` at 717717b. The unmerged item is the simulated-printer branch `stage6-simulated-printer` (885d28b).
- Default: name the exact work the decision refers to.
- Blocks nothing directly. The rebase instruction is unclear until this is settled.
- Decided by: owner now.

**21. Premium features (decision 12).** *Pending.*
- Default: none. Option C stays an unbuilt proposal.
- Blocks nothing.
- Decided by: owner now.

**22. Email provider and SMTP (§10 item 10).** *Pending.*
- Supabase's built-in Auth email is limited to 2 per hour (verified). Production sign-ups need custom SMTP. Resend is not integrated for authentication.
- Blocks production sign-up growth, not Stage 7 code.
- Decided by: owner (choice), production owner (setup).

**23. Printing defect: duplicate print (K, M7).** *Investigated and confirmed from code. Not reproduced.*
- `retry_print_job` refuses only when a sibling is queued, claimed or printing (534–539). It does not refuse for a `sent` sibling and does not require the source to be the latest attempt. So if attempt 1 failed and attempt 2 was sent, a retry of attempt 1 can print a second copy.
- Default: targeted fix after diff review, with tests.
- Separate gate. Does not block 7B.
- Decided by: engineering and owner review of the diff.

**24. Printing defect: refund and claim (K, M7, R-a/R-b/R-c).** *Stopped. Review required.*
- `agent_claim_next_job` checks neither payment status nor order status (0010:646–656). A refunded order's queued jobs can still print.
- Options: R-a (fail queued jobs on refund or on the ready or completed transition; the document's recommendation); R-b (add a `cancelled` status); R-c (claim-side eligibility only, which pins files; not acceptable without item 1).
- R-a touches `set_order_payment` and the customer payment ledger.
- Separate gate. Enforcement in 7F does not fix this.
- Decided by: owner, after a diff review.

**25. Second `place_order` signature (new).** *Found in migrations. Live state unverified.*
- The three-argument signature (0001:397, 0003:186) is not dropped. Migration 0003 grants it to `anon` and `authenticated` (lines 277–278). The four-argument signature (0008:55, 0009:33) was added to keep integrations working.
- The body of the three-argument version was not compared in this review.
- Default: keep until a separately approved change; test both signatures in 7F.
- Blocks the "checkout unaffected" test being declared complete. Not a licence decision.
- Decided by: production owner (live check), owner (any retirement, which is a checkout change needing separate approval).

**26. Live migration state and 0010 sequencing (new).** *Production-owner action.*
- `docs/PRINTING_STATUS.md` says migration 0010 is "not applied anywhere yet" and asks the team to confirm before applying it after 0009. The README asks for 0004 and 0005 to be confirmed on live.
- The live migration list is unknown. 0011 should not be applied before the sequence is settled.
- Blocks 7F and any print-related staging test.
- Decided by: production owner (read-only listing), then owner.

**27. Purge scheduler and cleanup capacity (new).** *Code verified. Deployment unverified.*
- The GitHub Actions cron calls `cleanup-files` with a shared secret. The function fails closed when the secret is empty.
- Capacity is 100 files per batch and 20 batches, so 2,000 files per daily run.
- Unclaimed files expire one day after upload (0003:41). Steady-state deletions roughly equal uploads. At 20 orders a month per shop and one file per order (both assumptions), the cap is reached at about 3,000 shops.
- Default: choose a change (higher cap, a loop within a time limit, or more frequent runs). This is a code change needing separate approval.
- Blocks growth beyond about 3,000 shops, not Stage 7 work.
- Decided by: owner (priority), production owner (deployment and secrets), staging test (load).

**28. Google Play in-app payment policy (new).** *Not verified.*
- The app is Capacitor-based (`mobile/`). If a licence purchase or payment instructions appear in the app, Google Play payment policy may apply.
- Default: no in-app licence purchase. Android status view only if the owner chooses (item 13).
- Blocks any Android licence payment path and the Android status view.
- Decided by: owner and lawyer, using the current Google Play policy text.

**29. Privacy, terms, refund text, intermediary duties and copyright (new).** *Absent from the repository.*
- Grep of `web/`, `docs/` and the README finds no privacy policy, terms, consent, unsubscribe, takedown or grievance text. The only copyright match is a vendored library licence.
- Needed before collecting licence payments or publishing licence terms.
- Blocks published terms and paid collection. Does not block 7B.
- Decided by: lawyer (drafting), owner (approval).

**30. Customer documents and retention (new).** *Partly verified.*
- The customer-files bucket is private (0003:26). Links expire after 180 seconds. README step 4 mentions passport-photo layout, which may be sensitive.
- The sensitivity classification has not been made.
- Blocks the retention and privacy decisions in items 1 and 29.
- Decided by: lawyer and engineering.

**31. Supabase project configuration and live Auth settings (new).** *Owner check.*
- There is no `supabase/config.toml`. Live Auth settings (leaked-password protection, Site URL, SMTP, MFA) are not recorded. Running `supabase init` would create a config file, which needs approval.
- Blocks the MFA decision (item 5) and local setup.
- Decided by: owner (record), owner (decide whether to version config).

**32. Rollback and enforcement kill switch (new gap).** *Not designed.*
- The document has no rollback plan for 0011 beyond staging drops, no production rollback plan, and no audited off switch for enforcement.
- Blocks 7F approval.
- Decided by: owner (policy) and engineering (design).

**33. Lock-order contract (R18).** *Contradicted by the code.*
- Approval locks the order first (0010:451). Retry (515), mark-printing (699), finish (736) and claim (655) lock jobs. `set_order_payment` takes no lock.
- No advisory locks exist.
- Blocks 7C and 7F. Needs a per-RPC lock map and two-session tests.
- Decided by: engineering. The owner does not decide this.

**34. Test data and demo seed on live (new).** *Owner check.*
- README: the live project holds test rows. `supabase/seed/demo_seed.sql` is marked development-only, and its creation of fixed-UUID `auth.users` rows is a repository precedent for the R15 fixture.
- Owner must confirm the demo seed never ran on live. Deleting test rows is a destructive action that needs the owner's go-ahead.
- Affects item 11 and item 25's fixture work.
- Decided by: owner.

**35. Other numbered items.**
- **R1–R19:** all design-only and untested. R13 is blocked by I. R15 is blocked by L, though the demo seed gives the columns the project uses. R16 and R17 need staging. R18 is item 33. R9 depends on R17.
- **S-1, S-2, S-3:** staging tests. S-3 also depends on item 5.
- **S-4:** a modified agent could use a link within 180 seconds without calling mark. Accept it, or reduce the window, before 7F.
- **S-5:** now verified from code (§3). Runtime test still needed.
- **S-6:** covered by item 15.
- **S-7, S-8:** items 23 and 24.
- **M1:** not approved for implementation until items 1 and 2 are resolved.
- **M2:** approved.
- **M3:** approved as design. Not implemented.
- **M4:** custom-grant convention approved. Paid term approved but blocked with M5. The §9 item 2 conflict is item 16.
- **M5:** approved as a blocking condition.
- **M6:** approved as policy; tests need the paid path.
- **M7:** approved as a review requirement.
- **M8:** policy proposal; legal review required.

## 3. Technical verification matrix

Classifications: *Code* means verified from existing code by reading (static, not runtime). *Local tests* means verified by tests run locally; none were run. *Local setup* needs Docker or the Supabase CLI. *Staging* needs a staging database. *Production owner* needs an action by the owner on live. *Separate approval* needs its own implementation approval.

| Area | What the repository shows | Classification |
|---|---|---|
| Supabase Auth and MFA | No MFA, `aal` or TOTP code in `web/`, `mobile/`, `agent/` or `supabase/`. No `config.toml`. | Code (absence). MFA behaviour: local setup and staging. Live settings: production owner. |
| Admin identity and authorisation | No platform-admin, role or licence concept in migrations or code. Existing owner check is `is_shop_owner()`. | Code (absence). New design. |
| `auth.uid()` and `aal` | `auth.uid()` is used in existing RPCs and policies. `aal` is used nowhere. | `auth.uid()`: code. `aal` claim behaviour: staging (S-3, R16). |
| RLS and function permissions | Explicit `REVOKE` from `public`, `anon` and `authenticated` in 0010 (lines 94, 849–868). No `ALTER DEFAULT PRIVILEGES` in any migration. | Code. Live default grants on new tables: staging (R17). |
| Synthetic Auth fixtures | `demo_seed.sql` inserts two `auth.users` rows with fixed UUIDs, marked development-only. Test files set `request.jwt.claims` and insert no auth users. | Precedent: code. Column compatibility with the pinned local Auth schema: local setup (L, blocked). |
| Licence tables and constraints | None exist. | Code (absence). Design only. |
| Payment and coverage relationships | Customer payments are in `orders` (0006, 0008, 0009). No licence payment table. | Code (absence). |
| Idempotency and audit | No `request_id`, replay or idempotency mechanism in migrations, functions or agent source. `order_events` exists for orders. | Code (absence). |
| Rate limiting | `consume_rate_limit` is a fixed-window counter (0010:231), granted to `service_role` only (868). Callers: print-agent (120), upload-file (108), `track_order` (SQL line 267). | Code. Calling it from a `SECURITY DEFINER` licence function: staging. |
| Concurrency and lock order | Approval locks the order (451). Retry locks the job (515) then reads the order unlocked (530). Mark (699), finish (736) and claim (655, `skip locked`) lock jobs. `set_order_payment` takes no row lock. No advisory locks. | Code. Two-session test: staging. |
| Refund and reversal | Refund changes only payment fields (0006:213–219). Claim checks neither payment nor order status (0010:646–656). | Code. Runtime: staging. |
| Retry safety | Retry refuses only queued, claimed or printing siblings (534–539). No `sent` check. No latest-attempt check. | Code (duplicate gap). Not reproduced; local test needed before any fix. |
| Mark-printing safety (S-5) | The agent writes the file, then calls mark. If mark is refused, it clears its journal and returns without printing or reporting failure (`worker.mjs` about lines 258–264). | Code. Runtime: local test. |
| File-link expiry (S-4) | `FILE_LINK_SECONDS = 180` (`print-agent/index.ts:23`). The link is signed inside `claim()`, before the agent calls mark. | Code. Residual risk stands: accept or reduce before 7F. |
| Held jobs | `recover_expired_print_jobs` requeues claimed jobs (202), fails them after five claims (207–211), marks printing jobs `needs_check` (216–221). Runs only inside `agent_claim_next_job` (644). | Code. Live behaviour: production owner (is 0010 applied). |
| File retention and purge | Unclaimed files expire one day after upload (0003:41). Claimed files are removed only after the order has ended for 30 days (0010:799–807). The purge skips files used by queued, claimed, printing or needs-check jobs (797). | Code. Deployment and secrets: production owner. |
| Scheduler | GitHub Actions cron (`cleanup-files.yml`, 30 20 * * * UTC) calls the cleanup function with a shared secret. No scheduler exists for held-job timeouts. | Code. Run history and secrets: production owner. Correction to C-2 needed. |
| Shop deletion | `orders`, `customer_files` and payments restrict deletion (0001:53, 0003:34, 0006:59). Print tables, services and memberships cascade. No application path deletes shops. | Code. Live behaviour: staging. |
| `place_order` overloads | Three-argument signature (0001:397, 0003:186) and four-argument (0008:55, 0009:33). No migration drops either. Three-argument version is granted to `anon` and `authenticated` (0003:277–278). | Code (both exist in the migration chain). Live state: production owner. Anonymous execution: staging. |
| Migration state on live | `PRINTING_STATUS.md`: 0010 "not applied anywhere yet". README: 0004 and 0005 to confirm. | Production owner. Not checked here. |
| Customer-file storage | Bucket is private (`public = false`, 0003:26). | Code. Live bucket and policies: production owner. |
| Client secret exposure | No `service_role` or secret key in `web/` or `mobile/`. `web/tests/owner-api.test.js:173` asserts this. | Code (static). Not run here. |
| Public publishing | `pages.yml` publishes `web/` on every push to `main` that changes it. | Code. Repository visibility and plan: production owner. |
| Test suites | Test files exist in `supabase/tests` and `web/tests`. None were run in this review. | Local tests: none. Local setup required. |

## 4. Legal and professional-advice requirements

Indian and foreign requirements are listed separately. No US or EU law is assumed to apply. Nothing was registered, no adviser was contacted and no personal information was published.

**Indian requirements**

| Topic | Known position | Needed | Who |
|---|---|---|---|
| GST registration route, thresholds, exemption | CGST s.22 and s.24 text verified. Notification 10/2017-IT as shown on the PDF. Current status unchecked. | Choose the route. Confirm the exemption applies. | CA |
| Input credit and reverse charge on foreign services (Supabase, Resend, GitHub) | Not modelled. | Treatment and invoicing. | CA |
| TDS on payments by business customers | Unverified. | Whether TDS applies and how it appears. | CA |
| Gateway fees, GST on fees, UPI MDR | Stripe: 18% GST on fees; no GST up to ₹2,000 for single card transactions (verified). Razorpay: secondary. MoF FAQ: 0.4% on P2M UPI above ₹2,000 (secondary). RuPay exemption unresolved. | Fee treatment for the chosen rail. | CA with processor |
| Refunds, cancellation and consumer obligations | Not researched. | Policy and applicability. | Lawyer |
| DPDP Act and Rules | Rules notified November 2025 (secondary); obligations phased. Applicability not analysed. | Applicability, notices, consent, retention, grievance. | Lawyer |
| Privacy policy and terms | None in the repository. | Drafting and publication before paid collection or licence terms. | Lawyer |
| Intermediary duties, takedown and grievance (customer uploads) | Not analysed. No takedown or grievance text in the repository. | Whether QRquick is an intermediary and what duties apply. | Lawyer |
| Data retention and deletion | Unclaimed: one day. Claimed: 30 days after order end (code). Deployment unverified. | Documented justification. | Lawyer and owner |
| Customer document security (passport photos) | Private bucket; 180-second links; passport-photo layout mentioned in README. | Sensitivity classification and security review. | Lawyer and engineering |
| Email consent and transactional versus marketing | Sign-up codes go through Supabase Auth. No marketing or consent text exists. | Consent model if marketing is planned. | Lawyer |
| Existing-shop transition (notice, changed terms) | Proposal: 30 days' written notice. No terms exist. | Notice wording and whether any free period is offered. | Lawyer and owner |
| RBI rules for recurring payments and e-mandates | Secondary summary only. | Relevant only if recurring gateway payments are chosen. | CA |

**Foreign-jurisdiction and platform requirements**

| Topic | Known position | Needed | Who |
|---|---|---|---|
| Google Play payment policy (in-app licence purchase) | Not checked. | Current policy text before any in-app payment. | Owner and lawyer |
| DMCA copyright takedown (United States) | Applies only with a US nexus. Not assumed. | Confirm whether any US nexus exists. | Lawyer |
| Supabase, GitHub and Resend terms and data-processing terms | Not reviewed. | Terms review and data-processing terms. | Owner and lawyer |

## 5. Architecture and cost assessment

The architecture is practical for pilot scale. Three things need decisions before growth: the purge capacity, denial-log growth and the scheduler for held jobs.

| Area | Current position | Practical now? | Decide or build now | Can wait |
|---|---|---|---|---|
| Supabase hosting and compute | Pro plan at $25 a month (verified, undated page). Includes 8 GB database, 100 GB storage and 250 GB egress. Compute upgrades not priced. | Yes, for a pilot | Nothing for licence tables | Compute tier, replicas |
| Database growth | Licence tables are small per shop. Denial logs grow with the number of accounts. | Not without a global ceiling | Global ceiling on denial rows (item 15) | Partitioning |
| Background jobs and scheduler | One daily cron (purge). No timeout job for held jobs. | Yes, for the purge | Hold clock and any new scheduled job (item 2) | Broader scheduler |
| Payment verification | Manual. No webhook or gateway. | Yes, at pilot scale | Manual procedure and evidence rules (item 14) | Gateway webhooks |
| Admin dashboard hosting | Separate private host recommended. Pages publishes `web/` publicly. | Yes, once hosted | Host choice (item 6) | Admin polish |
| Email delivery | Supabase built-in: 2 emails per hour (verified). Resend Free: 3,000 a month, 100 a day. Resend Pro: $20 a month for 50,000 (verified). Email-volume tier undecided. | Not for production sign-ups without custom SMTP | SMTP provider (item 22) | Licence notification emails (none designed) |
| Printing-agent interactions | Each claim signs a file link and runs recovery, which writes. 7F would add a shared-lock read on each claim. | Yes, at pilot scale | Lock map (item 33), two-session tests | Scale tests |
| Storage and file deletion | Daily purge capped at 2,000 files per run. At about 3,000 shops, the cap is reached (assumptions: 20 orders per shop a month, one file per order). | Yes, below about 3,000 shops | Choose a change before growth (item 27) | Growth beyond about 3,000 shops |

**Recurring costs.** The document's fixed base is ₹5,475 a month on Resend Free. It comprises Supabase ₹2,375 (at an assumed ₹95 per dollar), domain ₹100 (assumed) and accounting ₹3,000 (assumed, no source). Resend Pro adds ₹1,900 only above the threshold. The GitHub plan is unknown. Google Play's $25 one-time fee is conditional. Compute upgrades, database overage and the next Resend tier are not priced.

**Necessary now:** the held-job decisions (items 1–2), denial-log ceiling (item 15), lock map (item 33), rollback and kill switch (item 32), and the live migration state (item 26).

**Can wait:** gateway webhooks, compute upgrades, Android licence view, email templates for licence notices, and partitioning.

## 6. Consolidated implementation roadmap

Nothing below is authorised. Each gate needs its own approval.

**Gate 0. Factual corrections and owner answers (documentation only).**
- Scope: correct the items in §8, record production-owner check results, and record Group A answers.
- Prerequisite: the owner's instruction to correct the document.
- Approval: owner.
- Tests: none. Acceptance: cross-reference check and no status changed without an owner answer.
- Security: none.
- Rollback: revert the documentation.
- Out of scope: any code, migration, Supabase or GitHub setting, or deployment.

**Gate 1. Local setup (separate approval).**
- Scope: Docker, Supabase CLI, containers. `supabase init` creates `supabase/config.toml`, which is a new repository file and needs its own approval.
- Prerequisites: choice of staging option (A local or B separate project). No test account without approval.
- Tests: none yet. Security: no production credentials.
- Rollback: remove containers.

**Gate 2. Migration sequence on staging.**
- Scope: apply 0010 to staging, not live. Then 0011 can be developed.
- Approval: owner.

**7A. Owner inputs (no code).**
- Scope: decisions 13–15, Auth UUID supplied by the owner, MFA answer after feasibility evidence, host chosen, live migration state, scheduler and secret state, live Auth settings.
- Tests: none. Security: no UUID inferred; no secrets in the repository.

**7B. Schema, migration 0011 (staging only).**
- Scope: tables `licence_coverages`, `shop_licence_meta`, `platform_admins`, `licence_audit_log`, `licence_requests`, `licence_denials`. Functions `is_platform_admin()`, `shop_licence_state()`, `licence_lock_shop()`. Deny-all RLS and immutability triggers. Excludes `paid_verified`, `trial` and `licence_payments`.
- Prerequisites: Gates 1 and 2. Decisions 13–14 for admin tests. Answers to C-5 and to items 7 and 8 for expected values. Fixture approach (L). Default-privileges check (R17).
- Approvals: separate for migration creation and for each staging run.
- Tests (§12B.11): state boundaries, triggers, privileges, versioning, orders checksum, and regression (0011 changes no existing function, trigger, policy or grant).
- Security: explicit `REVOKE` from `PUBLIC`; no service key; immutability triggers.
- Rollback: drop 0011 objects on staging. A production rollback plan does not exist (item 32).
- Out of scope: paid tables, RPCs, UI, enforcement.

**7C. Admin RPCs and owner read.**
- Scope: grant, extend, revoke (M2), replace. Denial logging (M3) with a global ceiling. Idempotency (R5). Owner read (D).
- Prerequisites: 7B on staging, corrected lock map (item 33), global ceiling decided (item 15), C-12 accepted.
- Tests (§12A.11, §12B.11): non-admin denied with a committed denial row; `aal2` required if decision 14 is yes; stale version rejected; replay returns the stored result; conflicting payload rejected; reason required; no self-disable; last admin protected; orders unchanged; two-session lock test; denial-cap test.
- Security: RPCs granted to `authenticated` only; identical denial response; no reason or actor fields in the owner read.
- Rollback: revoke `EXECUTE` on admin RPCs (migration needed).
- Out of scope: payment entry (M5), UI.

**7D. Admin UI (separate private deployment).**
- Scope: login, shop search, grant, extend, revoke and replace with confirmation, audit view. MFA enrolment if decision 14 is yes.
- Prerequisites: 7C on staging, host chosen (item 6), MFA evidence.
- Tests: browser smoke test on staging. Static scan that no service key is in the bundle, following the `owner-api` test pattern. No link from the shop app.
- Security: publishable key only. Deployment outside `web/`.
- Rollback: take the deployment down. No database change.
- Out of scope: payments, shop-app links.

**7E. Owner read-only status (web).**
- Scope: fields as in D. NONE and expiry wording (item 13).
- Prerequisites: 7C; decision 19.
- Tests: enforcement off returns no fields; enforcement on returns only D fields; staff denied.
- Security: `is_shop_owner()` only. Rollback: remove the UI and revoke the grant.
- Out of scope: Android, enforcement.

**7F. Printing enforcement (printing only).**
- Scope: gates in `approve_order_for_print`, `retry_print_job`, `agent_claim_next_job` and `agent_mark_printing`.
- Prerequisites: 7C and 7E. S-4 accepted or reduced. Lock map. Kill switch and rollback designed (item 32). Existing-shop policy (item 11) before enabling. Building can precede enabling.
- Approvals: separate gate for building, and a separate one for enabling.
- Tests: approve and retry refused with no row or order change; claim returns nothing; mark refused; finish works for a printing job; queued jobs resume when ACTIVE; checkout succeeds under both `place_order` signatures while inactive.
- Security: lock order; token checks; S-4 residual risk.
- Rollback: a designed kill switch, which does not exist yet.
- Out of scope: gating checkout or order placement; the refund and claim fix; the duplicate-print fix; M1; the paid path.

**Separate gates (none authorised).**
- **M1 held-job rule:** after items 1 and 2 are decided. Tests per §12B.11. Needs a file-release rule.
- **Duplicate-print fix (K):** diff review. Tests for a `sent` sibling, the latest-attempt rule, and `failed` or `needs_check` still retryable.
- **Refund and claim fix (M7):** owner chooses R-a, R-b or R-c after diff review. Tests that a refunded or ineligible order's files are not claimed. Touches the customer payment ledger.
- **Paid path (M5):** after items 4, 10, 14, 17 and 18. Adds `paid_verified`, `licence_payments`, record, verify and reverse, with tests for F, H, J and M4 stacking.
- **Gateway:** after processor eligibility evidence and CA advice.
- **Three-argument `place_order` retirement:** a checkout change. Separate approval.
- **Cleanup capacity change (item 27):** code change to `cleanup-files`. Separate approval.
- **Publication of privacy text and terms:** after lawyer review.

## 7. Final owner decision sheet

The recommended answers are for the owner to accept or change. Nothing here is decided on the owner's behalf.

**A. Owner can approve now.**
- **A1 (item 16):** licence unit is per shop. It matches the `shop_id` model already in use.
- **A2 (item 16):** term is 12 months with manual renewal and no automatic renewal. This matches M4. §9 item 2 should be updated to say so.
- **A3 (item 3):** stacking, with no overlap. This prevents double-counting and applies only once the paid path exists.
- **A4 (item 4):** exclude `paid_verified` and `licence_payments` from 0011 (C-5). This keeps 7B free of blocked work.
- **A5 (item 7):** if a lifetime grant is revoked while a valid paid period remains, access continues through that period. This matches M6.
- **A6 (item 8):** revoking current access does not cancel future coverage (C-8). Prepaid time is not lost without an explicit cancel. SCHEDULED makes the state visible.
- **A7 (item 8):** same-instant tie with one revocation gives REVOKED. A revoked end is not a natural expiry.
- **A8 (item 9):** trials stay deferred (C-10). No unapproved trial behaviour.
- **A9 (item 5):** one owner admin account (decision 13). This is the smallest attack surface. More admins can be added later by owner SQL.
- **A10 (item 6):** admin UI in a separate private deployment, outside `web/`, because Pages publishes `web/` publicly.
- **A11 (item 7):** grant durations are 1 month, 1 year, custom and lifetime. Backdating only with explicit confirmation. Lifetime owner-only. The owner still enters the custom maximum length. No default is invented.
- **A12 (item 13):** no grace period. Printing is already blocked in every non-ACTIVE state.
- **A13 (item 13):** web-only shop view in 7E. Fields as in D. Labels Active or Inactive. No admin-grant label. This is minimal disclosure.
- **A14 (item 15):** denial logging on, at 20 detailed rows per user per hour and count-only above that (M3). The global ceiling is decided under B13.
- **A15 (item 21):** no premium features now.
- **A16 (item 19):** engage an Indian CA and a lawyer before any paid collection.
- **A17 (item 4):** keep pricing blocked (I). Answer the tax and processor questions first.
- **A18 (item 17):** defer the gateway choice. Manual route first.
- **A19 (item 14):** accept the list of manual payment methods for later use, with a reference required except for cash. It takes effect only with the paid path.
- **A20 (item 20):** name the Stage 6 work the decision refers to. If it means the simulated printer, name branch `stage6-simulated-printer` (885d28b). The base print agent is already on `origin/main`.

**B. Needs technical evidence first.**
- **B1 (item 5):** MFA required for admin RPCs (decision 14). Recommended: yes. Needs evidence on Supabase MFA feasibility and `aal2` behaviour on staging.
- **B2 (item 5):** the owner supplies the Auth UUID from their own account. It is never inferred. Production-owner action.
- **B3 (item 26):** the owner runs a read-only listing of live migrations. Recommended: apply 0010 to staging first, then decide the live sequence.
- **B4 (item 25):** the owner checks whether both `place_order` signatures are live. Recommended: keep the three-argument version until a separately approved change, and test both.
- **B5 (item 27):** the owner records whether the cleanup function is deployed, whether its secrets are set, and its last runs. Recommended: record this before 7F.
- **B6 (item 31):** the owner records live Auth settings (leaked-password protection, Site URL, SMTP, MFA). Any change to live settings is the owner's decision and is outside Stage 7.
- **B7 (items 6, 34):** the owner checks repository visibility and GitHub plan. This affects Pages and where the admin UI can sit.
- **B8 (item 11):** the owner counts existing shops, excluding test rows. Recommended: no free-period promise until N is known.
- **B9 (item 12):** the owner estimates emails per order from real data. Recommended: keep both scenarios until then.
- **B10 (item 2):** hold start by a stored marker when the shop leaves ACTIVE (option b), with tests. The owner decides the policy. Any new scheduled job needs separate approval.
- **B11 (item 33):** lock map by engineering, with two-session tests. The owner does not decide this.
- **B12 (item 24):** the owner chooses R-a, R-b or R-c only after diff review. The document recommends R-a.
- **B13 (item 15):** the global ceiling on denial rows. Engineering gives an estimate; the owner accepts the number.
- **B14 (item 32):** rollback and kill-switch design by engineering, approved by the owner.
- **B15 (item 25):** Auth fixture columns (L) need local setup. The demo seed shows the columns the project already uses, but this is not proof they match the pinned schema.

**C. Needs a CA, lawyer or other professional.**
- **C1 (item 18):** GST route, exemption status, invoices for manual receipts. CA.
- **C2 (item 18):** input credit, reverse charge, TDS. CA.
- **C3 (items 4, 17):** gateway fee tax and UPI MDR treatment. CA with the processor.
- **C4 (item 10):** refund and cancellation policy and consumer obligations. Lawyer.
- **C5 (items 14, 29, 30):** DPDP applicability, retention rules of one day and 30 days, passport-photo sensitivity, personal data in audit rows. Lawyer.
- **C6 (item 29):** privacy policy, terms and licence terms. Lawyer.
- **C7 (item 29):** intermediary and takedown duties. DMCA only if a US nexus exists. Lawyer.
- **C8 (item 29):** email consent and separation of marketing. Lawyer.
- **C9 (item 28):** Google Play policy for any in-app licence purchase. Lawyer, using the current policy text.
- **C10 (item 11):** notice to existing shops. Lawyer.

**D. Safe to defer.**
- **D1 (item 4):** pricing (I) stays blocked until C1–C3 are answered.
- **D2 (item 17):** gateway (Stripe or Razorpay) is a later stage.
- **D3 (item 9):** trials stay deferred. Any future trial is a new decision.
- **D4 (item 8):** standalone revocation of an active paid period waits for the paid path.
- **D5 (item 14):** manual payment entry, verification and reversal wait for M5.
- **D6 (item 13):** Android licence view is a later stage.
- **D7 (item 22):** custom SMTP provider before production scale, not for 7B.
- **D8 (item 2):** held-job timeout scheduler waits for M1.
- **D9 (item 21):** no premium design.
- **D10 (item 34):** deleting test rows is unrelated to Stage 7 and needs the owner's go-ahead.
- **D11 (item 35):** README and CLAUDE.md drift is for a later documentation pass.

**E. Block Stage 7 implementation.**
- **E1:** planning approval of the corrected document. Blocks everything from 7A onward.
- **E2:** local setup approval, including the `supabase/config.toml` decision. Blocks Gate 1 and all SQL tests.
- **E3:** staging choice (A local or B separate project), with no production access. Blocks all tests.
- **E4:** migration 0010 applied to staging. Blocks 7F and any print-related test.
- **E5:** C-5. Blocks the scope of 7B.
- **E6:** decisions 13–14 and the Auth UUID route. Blocks admin work in 7C–7D.
- **E7:** lock map (item 33). Blocks 7C and 7F.
- **E8:** global denial ceiling (item 15). Blocks denial logging in 7C.
- **E9:** rollback and kill-switch design (item 32). Blocks 7F approval.
- **E10:** S-4 accepted or reduced. Blocks 7F.
- **E11:** test scope covering both `place_order` signatures. Blocks completion of 7F.

Pricing, E, N, the gateway, the refund policy, trials, M1, the refund fix, the duplicate-print fix and privacy text do not block 7B. Each blocks only its own gate or the paid path.

## 8. Completeness audit and explicit blockers

**Audit results**
- **Re-read:** the whole document was re-read after the last edit. No changes have been made since.
- **Cross-references:** every § reference resolves. Decision, C, R, S and M labels are consistent, except for the contradictions below.
- **Contradictions and factual corrections needed (documentation pass):**
  1. C-2 and §12B.6 say no scheduler is confirmed. That is wrong for the purge (`cleanup-files.yml`). Held-job timeouts still have none.
  2. §5, §9 item 7 and §12B.8 say "30 days after finish". That omits the one-day rule for unclaimed files (0003:41, 0010:799–807).
  3. §5C and §12B.8 say "NOT DEPLOYED". That is supported by `PRINTING_STATUS.md`. It should also say that the code and workflow exist, and that 0010 is not applied to any database.
  4. §12B.9 S-5 is "UNVERIFIED". The code shows the agent does not print when a start is refused. A runtime test is still needed.
  5. §12B.5 R18 describes approval only. Mark, finish, retry and claim lock jobs first, and `set_order_payment` takes no lock.
  6. §9 item 2 is marked PENDING. M4 approves the 12-month term.
  7. §9 item 10 does not say which Stage 6 work it means. The unmerged item is the simulated-printer branch.
  8. §12B.2 and §12B.11 should note that the three-argument `place_order` is still granted to `anon` and `authenticated` in the migration chain.
  9. §2 cites `owner.js` lines 327–350 for the resend button. The call sites are at 259, 327, 345 and 358.
  10. README's roadmap (Stripe in Stage 7; unclaimed files deleted after a day) differs from the document. Known drift.
  11. §12A.2's `verify_jwt` statement for `owner-file-link` was not re-checked here.
- **Missing decisions (not assumed):** items 25–34 in §2, plus the global denial ceiling. These are the second `place_order` signature, live migration state, cleanup capacity, Google Play, privacy and terms, customer document sensitivity, Supabase configuration, rollback and kill switch, the lock contract, and test data on live.
- **Owners and next actions:** several R, S and K items have no named owner. Each needs one of: owner, engineering, CA, lawyer, or production owner.
- **Planning versus implementation:** the document says planning approval sets direction and does not authorise setup, migrations, tests or implementation. That distinction holds. Nothing in this report authorises implementation.

**Explicit blockers to planning approval**
1. Corrections 1–7 above. This needs your instruction to make a documentation-only pass.
2. Answers to the Group A items in §7, or an explicit deferral of each.
3. The production-owner checks in B3 and B5 recorded, so the approval rests on facts rather than assumptions.

Items B1 and B2 are not blockers to planning approval, but they block the admin stages.

**Explicit blockers to implementation:** the E-list in §7.

## 9. Final verdict

**NOT READY FOR PLANNING APPROVAL.**

Clear the blockers in §8 and answer Group A in §7. The document could then be re-assessed for planning approval. Planning approval is still separate from implementation approval, and no implementation may begin without a separate approval for each gate.

Waiting for the owner's next instruction.