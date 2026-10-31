# Stage 7 owner decision sheet

**Status: documentation only.** Prepared 2026-10-31 from `STAGE7_DECISIONS.md` and corrected after the review of the same date. This sheet approves nothing: no decision, gate, setup, migration, test, price, publication, production change or external action. It proposes no price. A "Claude suggests" entry is a suggestion, not a default. Nothing here has been checked against production.

**Item 2 (hold start) is DEFERRED** (owner instruction 1, 2026-10-31). It is not a Stage 7 closure requirement. **Enforcement activation is not a Stage 7 closure requirement** (owner instruction 2).

**How to answer:** for each row, reply Accept, Change, Reject or Defer, in your own words. Part 2 and Part 3 need answers before the 7B design. Part 4 rows are needed only before the stage named in each row. Parts 5 and 9 are blocked or deferred and need no answer now.

**IDs:** Dec n = decision n in §14.6 (1 to 20; this is not the item number). Item n = numbered item in §14.2. C-n = conflict (§14.3). S-n = security finding (§14.4). M1 to M8 = milestones (§14.5). A to L = letters in §12B.2, cited as "§12B.2 A". R-a, R-b, R-c = refund options (§12B.4). "Part" refers to this sheet. "§" refers to `STAGE7_DECISIONS.md`.

## Part 1. Recorded on 2026-10-31

These five owner instructions are recorded in `STAGE7_DECISIONS.md` §13. They change statuses and wording. They approve no gate.

| No. | Instruction | Effect |
|---|---|---|
| 1 | Item 2 is DEFERRED and is not a Stage 7 closure requirement | Counts are now 9 RECOMMENDED, 17 EXTERNAL BLOCKER, 4 IMPLEMENTATION GATE, 5 DEFERRED, 0 DECIDED (total 35). C-2 follows as DEFERRED. |
| 2 | Enabling enforcement is not a Stage 7 closure requirement | Building and validating enforcement is separate from enabling it in production. Enabling is a separate 7F approval. |
| 3 | Items 11 and 26 are not general closure requirements | Item 11 is required before enforcement activation. Item 26 is required before the relevant production migration. |
| 4 | Trials are DEFERRED out of Stage 7, not permanently removed | Trial terms are not approved (Dec 5, item 9, C-10). |
| 5 | Item 23: investigation and targeted local tests are approved only after the proposed code diff is reviewed | Staging tests need a separate explicit approval. Implementation needs its own approval. |

## Part 2. Decide now (owner answers, RECOMMENDED)

These are defaults the owner can confirm or change. A confirmed answer records a decision and approves no gate.

| ID | Decision | File status | Claude suggests | Consequence |
|---|---|---|---|---|
| Dec 2 | Term and renewal (item 16) | RECOMMENDED | Manual renewal each year, with no automatic renewal | The owner pays each year. Nothing is charged automatically. The paid path stays blocked (M5). |
| Dec 13 | Admin accounts (item 5) | RECOMMENDED | One owner admin. An extra admin needs an owner-run SQL row | The admin Auth UUID is still needed (Part 4). |
| Dec 15 | Admin UI hosting (item 6) | RECOMMENDED | A separate private deployment, not linked from the shop app and not published with the public site | 7D needs this decision and the visibility check. |
| Dec 16 | Backdating and lifetime rules (item 7, 7C validation) | RECOMMENDED | Backdating only with explicit confirmation. Lifetime owner-only | These are 7C inputs and do not change the 7B schema. The maximum custom length is in Part 4. |
| Dec 18 | Grace period (item 13) | RECOMMENDED | No grace period | Printing is blocked in every non-ACTIVE state (§12B.3, from B and C). Queued jobs are held and retries are blocked from the end date. Jobs already printing may finish. Any grace days would change this rule. The wording for the NONE state is also open. |
| Dec 19 | Shop-facing view: labels (item 13) | RECOMMENDED | Keep the file's position: Active or Inactive only, with no admin-grant label | Approved (§12B.2 D): the owner-only fields are active or inactive, access end or no-expiry, and next start when relevant. Still open: the label wording, whether an admin grant may show a label, and staff visibility. The Android view is DEFERRED (Part 9). |
| Dec 11 | Advisers (item 19) | RECOMMENDED | Engage an Indian CA and a lawyer before any paid collection | No engagement is evidenced. Their advice is needed for the blockers in Part 6. |
| Dec 10 | Stage 6 merge order (item 20) | RECOMMENDED | No view given here | Decide whether `stage6-simulated-printer` (885d28b) is merged before Stage 7 is rebased. This affects rebase order only. Nothing is merged by this sheet. |
| S-4 | Residual 180-second file-link window (item 35) | RECOMMENDED | Accept it, or reduce it before the 7F build | §15.3 requires S-4 accepted before 7F. |

## Part 3. Decide before the 7B design

| ID | Decision | File status | Claude suggests | Consequence |
|---|---|---|---|---|
| C-5 | Keep `paid_verified` and `licence_payments` out of 0011. `trial` is also out (C-10, deferred) | RECOMMENDED | Accept | 0011 has no paid tables. Paid tables come later, under their own gate. |
| Item 8 (C-8; fixes 5 and 9) | Revoking current coverage does not cancel future coverage. A same-instant tie gives REVOKED. The exclusive end is displayed | RECOMMENDED | Accept all three | The 7B state function and revocation trigger depend on them. |
| Item 16 | Licence unit | RECOMMENDED: per shop | Per shop | A per-owner or per-computer unit would change the 7B data model. The term does not change the schema. |
| Item 7 | Basis ranking: a lifetime grant over an admin grant (§12A.6) | RECOMMENDED; not separately confirmed | Confirm the ranking | Sets the order in the 7B state function. M6 covers paid coverage only. |

Not needed before the 7B design (§15.3): item 5 and Dec 13 to 15; C-6; C-1; C-3; the grant-limit inputs in Part 4; C-7 and the other paid-path items; item 2 (M1 only); item 26 (before a production migration only).

## Part 4. Decide before or during 7C to 7F, and before setup

| ID | Decision | Needed before | Claude suggests | Consequence |
|---|---|---|---|---|
| Item 5, Dec 14 | Production-owner evidence: the admin Auth user UUID (never inferred) and the MFA status. Whether `aal2` is required for admin RPCs. Both are EXTERNAL BLOCKER | 7A, the bootstrap row, 7C, 7D | Require `aal2`. The production owner supplies the UUID | 7A cannot finish without them. The UUID is not put in the migration. |
| Dec 16, maximum length (item 7) | Maximum custom grant length: a number of years, or "none" | 7C validation | The owner sets it. "None" is valid. No value is proposed here | DEFERRED until set. Not a 7B schema prerequisite. |
| Item 15, C-12 | Global denial ceiling value. Accept count-only records above the cap of 20 per user per hour | 7C | Set the ceiling after staging measures row growth. No value is proposed here | Sets denial-log growth. Detail above the cap is lost, and the owner must accept that. |
| Dec 7 | Deletion schedule: whether licence expiry should change file deletion timing. This is separate from the expiry behaviour already approved (A, B, C) | Enforcement activation, and any retention change | No view given here. The current schedule stays until decided | Open under item 1. The current purge schedule is unverified live (§5C). |
| C-1 (item 1) | Lawyer's answer on the release rule for held files. Option (i): a new terminal order status, which changes the 0001 transitions and is out of scope so far. Option (ii): a licence-specific file-release rule | Before the owner's C-3 decision, and before M1 | Lawyer answers first. The owner chooses the option afterwards | Without an answer, held files of paid orders in `printing` are never purged (0010 lines 795–798). |
| C-3 (item 1) | Held files: accept as an interim, or hold enforcement back | The 7F build (C-3 decided). Enabling depends on the choice | Decide after the C-1 answer | Accept as an interim: held files are kept indefinitely until M1 exists. Hold back: enabling waits for M1, for item 2 (reopened) and, where paid orders are affected, for item 10. The build needs C-3 decided, whichever choice is made. |
| Item 10 and M1 effect on paid orders | If M1 is built, a paid order held past 7 days stays `printing` with payment `paid`, and the customer receives no printed output. A refund through `set_order_payment` does not touch the job (§12B.6) | Before M1 implementation (lawyer review) | Lawyer reviews the paid-order effect with the refund policy (item 10) | Refund policy is EXTERNAL BLOCKER (Part 5). |
| Item 32 | Rollback and enforcement kill switch. Engineering designs it, and the owner approves the design | 7F build | Approve only after a written design has been reviewed | Without it, 7F has no designed off switch. No design exists yet. |
| Ordering of items 23 and 24 vs 7F | Whether the printing fixes come before the 7F build. Neither is a 7F prerequisite by default (§15.3). Item 23 changes `retry_print_job`, which 7F gates | Before the 7F build | Owner decides the order. No view given here | Item 23 edits the `retry_print_job` body that 7F gates. If 23 is reviewed after the 7F build, both reviews touch the same function. |
| Item 25 | Retire the three-argument `place_order` overload (checkout change) | Live check by the production owner. Separate checkout approval | Keep both signatures. Retiring one is a checkout change | The checkout-unaffected test covers both signatures. The default is to keep. |
| Item 11 (C-14) | Existing-shop count N and free-period policy | Enabling enforcement only | No free-year promise and no term extension until N is known (§15.3 position) | Enabling waits for N (production owner count, excluding test rows) and for a lawyer's review of the 30-day notice. |
| Local setup | Option A: local Supabase stack (Docker, CLI, containers, `supabase init`, which creates `supabase/config.toml`, item 31). Option B: separate staging project, with nothing from production supplied (§15.2) | A written setup plan, reviewed, then owner approval for each install step | Choose an option. Approve the written plan before any install | Neither option touches the live project. A localhost name does not prove a test database. |
| Decision L and the Auth fixture | Read-only inspection of the local Auth schema, after local setup approval. A synthetic fixture only after its columns are verified (R15) and the approach is reviewed | Local setup approval | Verify the columns first. No user is created | Nothing has been inspected. Any test account needs explicit approval. |
| Item 29 publication | Privacy text, terms, refund text and consent. A lawyer drafts and reviews. The owner approves publication. A worktree search found none of this text | Before publishing terms or any paid collection | Lawyer first, then owner approval | Not a Stage 7 closure requirement. |
| Staging evidence S-1 to S-3 | S-1: `anon` cannot call internal helpers (R9). S-2: default grants on new public tables (R17). S-3: the `aal` claim (R16; needs item 5) | Staging approval, after 7B | Run on staging only | Each is UNVERIFIED now. |
| Runtime evidence S-5 | Worker behaviour when `markPrinting` throws (`agent/src/worker.mjs` lines 258–264). Static reading only so far | Local test approval, before 7F | Test locally first | Runtime behaviour is UNVERIFIED. |
| Item 33 lock tests | Two-session test of the shop-lock order (R18). The designed order is not built | Staging approval, before 7C and 7F | Run after the 7C design | The lock map of the existing code is recorded (§12B.5). |
| Item 26 production migration | Applied migration list (read-only, production owner). The owner's decision to apply 0010 or 0011, after staging evidence | Any production migration | Keep the staging path separate | Not a Stage 7 closure requirement (instruction 3). |

## Part 5. Paid path, pricing and gateway (blocked or deferred; no answer needed now)

| ID | Status | Claude suggests | Consequence |
|---|---|---|---|
| Dec 3, price (item 4) | EXTERNAL BLOCKER | No price is recommended here. The §7 options are proposals, not approved | No price is shown or charged. The CA's tax answer (item 18) and the collection-channel answer come first. |
| Item 4, collection channel | EXTERNAL BLOCKER | Decide after the CA's tax answer: manual collection, or a named processor | Needed before pricing. This is not the gateway decision. |
| Item 18, GST route (Dec 4) | EXTERNAL BLOCKER | The CA decides the registration route, the status of Notification 10/2017-IT, input credit, reverse charge, TDS and invoicing | Pricing tax treatment and invoices wait for this. |
| Dec 6, refunds (item 10) | EXTERNAL BLOCKER | Lawyer first, then the owner | Refund tests and the paid path wait. |
| Item 14, manual payments (Dec 20) | EXTERNAL BLOCKER | When the paid path opens: accept the proposed methods (UPI direct, bank transfer, cash, cheque, other), with references required except for cash. The CA advises on GST invoices for manual receipts. The lawyer advises on audit personal data and its retention | Paid path (M5) only |
| Item 12, email-volume tier E | RECOMMENDED | The owner estimates emails per order from real data | Projections only, not Stage 7 code. Both Free and Pro scenarios stay until then. |
| Item 3 (C-4), stacking | RECOMMENDED | Confirm that paid terms do not overlap | Paid path only (M5). |
| Item 7 (C-7) | RECOMMENDED | Confirm that a valid paid period stays in force after a lifetime revocation (M6) | Paid path only. |
| M5 paid-path block | Approved as a blocking condition | Keep the block | No paid coverage can be recorded until a separate M5 approval names its scope. |

## Part 6. External blockers (evidence needed, by party)

| Party | Evidence needed | Unblocks |
|---|---|---|
| CA | Tax route (Dec 4, item 18): registration, Notification 10/2017-IT, input credit, reverse charge on foreign services, TDS and invoicing. GST invoices for manual receipts (item 14) | Pricing tax treatment (I); invoices; the paid path |
| Lawyer | Release rule for held files (C-1, item 1), with options (i) and (ii) in Part 4. Customer-document sensitivity and DPDP applicability (item 30) | M1; C-3; enabling; retention rules |
| Lawyer | Refund policy (item 10). Consumer-refund obligations are not yet researched (§12B.6) | Refund tests; the paid path |
| Lawyer | Retention. Denial records (`licence_denials`): proposed 90 days, subject to legal review (M8). Successful replay and idempotency records (`licence_requests`): kept as long as necessary to prevent replay, not on a 90-day schedule (M8). Audit rows (item 14). User IDs in ledgers (S-6) | 7C logging; audit rules |
| Lawyer | Privacy policy, terms, consent and takedown text (item 29). Google Play policy (item 28). The 30-day notice to existing shops (item 11) | Published terms; any Android licence payment; existing-shop terms |
| Production owner | Admin Auth user UUID and MFA status (item 5, Dec 14) | 7A; the bootstrap row; 7C and 7D |
| Production owner | Shop count N, excluding test rows (item 11; README lines 395–405) | Enabling; existing-shop terms |
| Production owner | Live function signatures and grants, read-only (item 25) | The checkout-unaffected test; 7F |
| Production owner | Applied migrations, read-only (item 26) | Any production application of 0010 or 0011 |
| Production owner | Whether `cleanup-files` is deployed, whether its secrets are set (not their values), and its recent runs (item 27) | Any claim that the purge runs (§5C, §8) |
| Production owner | Live leaked-password protection, Site URL, SMTP and MFA settings (item 31). Whether `demo_seed` ever ran on live (item 34). Repository visibility and plan (item 6) | MFA decision; configuration; shop count; 7D hosting |
| Processor (only if one is named) | Eligibility evidence. Stripe is invite-only for new Indian businesses. Razorpay India signup is unverified (§3, §4) | Fee basis for pricing only |

## Part 7. Printing defects 23 and 24 (separate technical approvals)

Neither fix is approved, and neither is a 7A to 7F prerequisite by default (§15.3). Stage 7 closure requires both to be closed (§16.1(e)). The code reading in §12B.4 is recorded findings. It is not a fix.

**Item 23, duplicate print (IMPLEMENTATION GATE).** Confirmed from code, not reproduced. Scope: the body of `retry_print_job` only (§15.3). Proposed rule: refuse if any job for the item is `sent`; refuse unless the source is the latest attempt; keep the `needs_check` confirmation.
- Step 1: diff review of the proposed change (M7). No diff has been presented yet.
- Step 2: only after that review, targeted local tests (owner instruction 5).
- Step 3: staging tests, each needing a separate explicit approval.
- Step 4: implementation, needing its own approval.
- Claude suggests: write and present the diff first. Run no tests until the diff is reviewed.

**Item 24, refund and claim (IMPLEMENTATION GATE).** Confirmed from code, not reproduced. The defect (S-8): a refunded order's queued jobs can still be claimed (`agent_claim_next_job`, 0010 lines 646–656). Options:
- R-a: on refund, or on the ready or completed transition, mark the order's queued jobs `failed` with a reason code. This changes `set_order_payment` (0006) and the order-status path, and touches the customer payment ledger. §12B.4 recommends R-a, subject to the diff.
- R-b: add a `cancelled` job status. This is a schema change, plus the same body changes.
- R-c: claim-side eligibility only. Ineligible jobs stay `queued` and pin their files. Not acceptable without a retention decision (C-1).
- Steps: (1) diff review; (2) the owner chooses R-a, R-b or R-c; (3) a separate approval.
- Claude suggests: review the R-a diff, and a test that a refunded order's files are not claimed, before any choice.

## Part 8. Gate summary (matches §15.3)

| Gate | Owner input | External evidence | Approval |
|---|---|---|---|
| 7A owner inputs | Dec 13 to 16 and 18 to 19. Confirmations for items 6, 7, 8, 13 and 16 | Production owner: UUID and MFA status (item 5) | Owner's written answers |
| 7B schema, migration 0011, staging only | C-5; item 8; item 16; item 7 basis ranking. A staging copy with 0010 applied, under its own approval. Option A or B (Part 4). Decision L and the fixture approach (Part 4) | None for staging. A production migration needs item 26 | Separate approval to create 0011, and one for each staging run |
| 7C admin RPCs | 7B on staging; the item 15 ceiling; C-12; the grant-limit inputs (Dec 16, including maximum length); item 33 lock tests on staging | Item 5 | Separate approval |
| 7D admin UI | 7C on staging; hosting (Dec 15) | Item 6 visibility check; item 5 | Separate approval |
| 7E owner status | 7C; the labels (Dec 19, item 13); display rule (item 8) | None | Separate approval |
| 7F build | 7C and 7E; S-4 accepted; C-1 answered and C-3 decided (item 1); item 32 kill-switch design approved; the order of items 23 and 24 decided | Item 25 live signatures; S-5 local test | Separate approval to build |
| 7F enabling | Item 11 (before enforcement activation). M1, item 2 (reopened) and item 10 if C-3 holds enforcement back | Item 11 count (production owner); lawyer's review of the notice | Separate approval to enable |

## Part 9. Deferred (no action until reopened)

Each item below is deferred. None is required now.

| Item | Deferred status | Reopens when |
|---|---|---|
| Item 2: hold start and scheduler (C-2) | Owner instruction 1. Not a closure requirement | C-3 holds enforcement back, or M1 is put forward for build. The owner then chooses (a) the job's `created_at`, which can fail a job a day into a lapse, or (b) the time the shop left ACTIVE, stored as a marker. The file recommends (b). |
| Item 9: trial (Dec 5; C-10) | Deferred, not removed (instruction 4). Trial terms not approved | A new owner decision on product and pricing terms |
| Item 17: processor and gateway (Dec 9) | Gateway deferred. Stripe is invite-only; Razorpay unverified | The owner reopens decision 9. Processor eligibility evidence and CA advice come first |
| Item 8: standalone paid revocation (Dec 17) | Deferred with the paid path | The paid path is approved (M5) |
| Item 21: premium features (Dec 12) | None built | The owner names the features and approves a feature list and build plan |
| Item 7: maximum custom length | Not set | The owner sets it (a 7C input; "none" is valid) |
| Item 22: custom SMTP | Deferred | The owner chooses custom SMTP, or production sign-up volume is about to start (the built-in limit is 2 emails an hour, §3) |
| Item 27: purge capacity change | Deferred | Shop count nears about 3,000. Separate approval needed |
| Item 31: configuration versioning (`supabase/config.toml`) | Deferred | Local setup is approved |
| Item 13: Android licence view | Deferred | The owner decides to show the licence view in the Android app |
| Item 34: deleting test rows on live | Deferred | The owner gives an explicit go-ahead |

## Part 10. Recorded approvals (reference only)

These approvals have no open condition. Blocked, conditional and proposed items are not listed here. They are in Parts 3 to 7 and 9.

- §12B.2 A printing-only enforcement. §12B.2 C retries blocked while inactive. §12B.2 G SCHEDULED state.
- §12B.2 D owner-only status, with the fields approved. Its labels, staff visibility and Android view are open (Parts 2 and 9).
- M2 refusal after the natural end. M3 denial design (cap of 20 per user per hour; the build is gate 7C). M4 custom-grant convention. M5 paid-path block. M6 lifetime over paid coverage, as policy (its tests need the paid path). M7 review required for both printing fixes.
- Approved, but blocked with the paid path (M5): §12B.2 F, H and J, and the paid term in M4.
- Approved for design only: §12B.2 E. Enabling stays blocked until item 11 is answered.

Not listed here, and still open: §12B.2 B (conditional on C-1 and C-3; EXTERNAL BLOCKER), I (pricing, blocked), K (fix implementation, Part 7), L (local setup first), M1 (proposal), and M8 (policy, legal review needed).
