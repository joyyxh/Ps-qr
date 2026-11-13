# Stage 7 owner decision sheet

**Status: documentation only.** Prepared 2026-10-31 from `STAGE7_DECISIONS.md`, corrected after the review of the same date, and updated 2026-11-02 for the O1–O13 record and the consistency pass, and updated 2026-11-04 for the ten decisions in Part 1H and the six Stage 7C decisions in Part 1I, and the AAL2 failure decision in Part 1J, and updated 2026-11-06 for the specification correction pass (Part 1L) and the consolidated pass (Part 1M). This sheet approves no gate, setup, migration, test, price, publication, production change or external action. Owner decisions appear only in the Parts that record them. It proposes no price. A "Claude suggests" entry is a suggestion, not a default. Nothing here has been checked against production.

**Item 2 (hold start) is DEFERRED** (owner instruction 1, 2026-10-31). It is not a Stage 7 closure requirement. **Enforcement activation is not a Stage 7 closure requirement** (owner instruction 2).

**How to answer:** for each row, reply Accept, Change, Reject or Defer, in your own words. Part 3 was answered on 2026-11-01 and is complete for the 7B-1 schema. Part 2 items gate only the stages named in Part 8, and none of them blocks 7B-1. Part 4 rows are needed only before the stage named in each row. Parts 5 and 9 are blocked or deferred and need no answer now.

**IDs:** Dec n = decision n in §14.6 (1 to 20; this is not the item number). Item n = numbered item in §14.2. C-n = conflict (§14.3). S-n = security finding (§14.4). M1 to M8 = milestones (§14.5). A to L = letters in §12B.2, cited as "§12B.2 A". R-a, R-b, R-c = refund options (§12B.4). "Part" refers to this sheet. "§" refers to `STAGE7_DECISIONS.md`.

## Part 1. Recorded on 2026-10-31

These six owner decisions, dated 2026-10-31, are recorded in `STAGE7_DECISIONS.md` §13. They change statuses and wording. They approve no gate.

| No. | Instruction | Effect |
|---|---|---|
| 1 | Item 2 is DEFERRED and is not a Stage 7 closure requirement | Counts are now 9 RECOMMENDED, 17 EXTERNAL BLOCKER, 4 IMPLEMENTATION GATE, 5 DEFERRED, 0 DECIDED (total 35). C-2 follows as DEFERRED. |
| 2 | Enabling enforcement is not a Stage 7 closure requirement | Building and validating enforcement is separate from enabling it in production. Enabling is a separate 7F approval. |
| 3 | Items 11 and 26 are not general closure requirements | Item 11 is required before enforcement activation. Item 26 is required before the relevant production migration. |
| 4 | Trials are DEFERRED out of Stage 7, not permanently removed | Trial terms are not approved (Dec 5, item 9, C-10). |
| 5 | Item 23: investigation and targeted local tests are approved only after the proposed code diff is reviewed | Staging tests need a separate explicit approval. Implementation needs its own approval. |
| 6 | Decision 1 (item 16): QRquick licences are issued per shop. Each individual shop requires its own licence. A single owner account may manage multiple shops, but licensing one shop does not automatically license the others. Changing the printer computer does not change the licence. | Decision 1 is DECIDED. Item 16: the renewal rule (decision 2) is DEFERRED by owner decision 7 (2026-11-01). The unit no longer blocks 7B. |

## Part 1A. Recorded on 2026-11-01

These seven owner decisions, dated 2026-11-01, are recorded in `STAGE7_DECISIONS.md` §13. They change statuses and scope. They approve no gate, no migration applied, no test, no setup and no commit.

| No. | Owner decision (2026-11-01) | Effect |
|---|---|---|
| 1 | Stage 7 uses the origin/main baseline (717717b lineage). Migration numbering starts at 0011 | 7B-1 is built on migrations 0001–0010. The next number is 0011, confirmed free on the Stage 7 branch. |
| 2 | Local-main migrations 0011–0014 stay separate and unmerged. Integration is reviewed later | Local main's `0011_service_options` is a different file from the Stage 7 0011. The two must not be combined without renumbering under approval. |
| 3 | C-5: paid verification, payment records and trial coverage are excluded from the 7B foundation | C-5 DECIDED. 0011 has no paid tables, no `payment_id` and no trial kind. |
| 4 | Item 8: revocation preserves future coverage. REVOKED wins same-instant ties. Coverage end is exclusive | Item 8 DECIDED (C-8, fixes 5 and 9). Standalone paid revocation stays DEFERRED (decision 17). |
| 5 | Item 7: a lifetime grant takes precedence over an admin grant | Basis ranking DECIDED. It sets the basis order in `shop_licence_state`. |
| 6 | Dec 16: no maximum custom grant duration | Maximum custom length DECIDED: none. The 7B schema has no duration cap. |
| 7 | Renewal remains DEFERRED and does not block 7B | Dec 2 and the renewal part of item 16 are DEFERRED. The renewal rule reopens with the paid path (M5). |

Counts after this record (items 1–35): 7 RECOMMENDED, 17 EXTERNAL BLOCKER, 4 IMPLEMENTATION GATE, 6 DEFERRED, 1 DECIDED (item 8). Total 35. Item 16 moves from RECOMMENDED to DEFERRED for the renewal part. Its unit is DECIDED under decision 1. Item 1 is held-job file retention and is not the licence unit.

Not approved by this record: implementation of R18 (the lock-order contract; its design was APPROVED later on 2026-11-01, see Part 1C, and its implementation is NOT approved), `licence_lock_shop()`, any admin RPC, any printing change, any test, staging or local setup, any commit or push, and any applied migration. Each needs its own approval.

## Part 1B. Recorded on 2026-11-01 (second record)

These four owner decisions, dated 2026-11-01, are recorded in `STAGE7_DECISIONS.md` §13. They change statuses and wording only. They approve no gate, no migration change, no test, no SQL, no setup and no commit.

| No. | Owner decision (2026-11-01) | Effect |
|---|---|---|
| 8 | ACTIVE `next_start`: shown only in SCHEDULED | Decided. In ACTIVE the next start is NULL, as migration 0011 already returns. The Dec 19 label questions stay open. |
| 9 | C-9: the replacement wording in §12B.9 is adopted | C-9 DECIDED. The superseded passages are in §9 item 7 only. B stays conditional on C-1 and C-3. |
| 10 | `service_role` stays revoked from the licence tables and helper functions (migration 0011) | Decided. This differs from 0010 by design. No service-key path reads licence data now; any future grant needs its own decision. |
| 11 | `p_at`: owner-facing state reads use the current time only. Historical state queries are not supported | Decided. History comes from `licence_audit_log`. |

Not decided by this record: R18 (lock order). Status after the third record on the same date (Part 1C): R18 design is APPROVED; implementation is NOT APPROVED. The deadlock analysis was returned for approval, and no printing or admin change is authorised. *Corrected 2026-11-02:* 7B-2 implementation was approved on 2026-11-01 for its scope only (Part 1F). 7C does not start.

## Part 1C. Recorded on 2026-11-01 (third record): R18 lock-order contract, design only

The owner accepted the final R18 lock-order contract as an approved **design** decision. **Design approval does NOT authorise implementation.** The full contract, function requirements, two-session tests and blockers are in `STAGE7_DECISIONS.md` §13, "Owner decision (2026-11-01, third record)". Counts are unchanged.

| Item | Status after this record |
|---|---|
| R18 lock order: shop meta row → order → agent → jobs (ascending id) | Design APPROVED. Not built, not tested |
| Rate-limit calls before the meta lock; no coverage row without a locked meta row | Part of the approved design |
| Advisory lock from the earlier R18 design | Removed from the design |
| `licence_lock_shop()` and `shop_licence_meta` (7B-2) | *Corrected 2026-11-02:* approved for implementation on 2026-11-01, scope only (Part 1F). As first recorded: NOT approved for implementation |
| Admin RPCs (7C) | NOT approved. Separate approval |
| Retry (item 23), refund R-a (item 24), recovery `SKIP LOCKED` | NOT approved. Each keeps its own gate (Part 8) |
| 7F build and enabling | NOT approved. Gates unchanged |
| Two-session tests (11, in §13) | OUTSTANDING. Staging only, separate approval |
| Migrations, SQL, printing code, tests, local setup, staging, commit, push, merge, deployment | NOT approved by this record |

## Part 1D. Recorded on 2026-11-02: owner approval of Stage 7C recommendations (OWNER-APPROVED)

Source: owner approval given in a ChatGPT conversation on 2026-11-02, in direct response to the Stage 7C recommendations: "Continue, i approve". Recorded here at the owner's instruction. Full wording and applied-to references are in `STAGE7_DECISIONS.md` §13.

This part approves no implementation, SQL, staging, migration application, commit, push, merge or deployment. 7C stays NOT approved.

| No. | Owner decision (2026-11-02, OWNER-APPROVED) | Conditions and OPEN items |
|---|---|---|
| 1 | AAL2: `aal2` is required for every platform-admin RPC. | OPEN: verified recovery procedure if the admin loses the TOTP factor; hosted and local verification of the `aal` claim (R16, S-3). Both remain prerequisites before 7C. 2026-11-04 (Part 1J): a failed AAL2 check is an authorisation failure, returning a committed `forbidden` result, logged and counted; the protected operation is not executed. 2026-11-04 (A3, Part 1I; timing clarification): the recovery procedure is required before 7C implementation sign-off, not before implementation starts. Hosted and local verification of the `aal` claim is not changed by this clarification and remains a separate prerequisite before 7C, as recorded in this row. *Clarified 2026-11-06 (Part 1M, R5):* hosted and local verification is required before 7C sign-off, not before implementation begins; no verification may be claimed without evidence. *Clarified 2026-11-06 (Part 1L, D):* a missing, unreadable or insufficient `aal` claim fails closed. |
| 2 | Item 15: option (a), a provisional ceiling for staging only. | Provisional value set 2026-11-06: 1,000 detail records per UTC hour (Part 1L). OPEN: the production ceiling value; the remaining C-12 and item 15 details. |
| 3 | Migration placement P1: `licence_requests` and `licence_denials` go in the existing `0011_licence_foundation.sql`. | Superseded 2026-11-05 (Part 1K): the three tables are now in 0011, unapplied, untested. Pre-staging review (O2) is still required. Placement is confirmed by O2 (Part 1G). |
| 4 | Lifetime grants: admin-only. | Replaces the earlier "owner-only" recommendation. Under 0011 as written, any platform admin can grant lifetime, because no role column exists. |
| 5 | Backdating: explicit confirmation required. | OPEN: the maximum backdating window. |
| 6 | Extend: rejected while lifetime coverage is active. | Start rule: O3 (Part 1E and Part 1G). *Clarified 2026-11-06 (Part 1M, R1):* Extend is rejected whenever a non-revoked lifetime grant exists, including scheduled lifetime coverage (STAGE7 §12A.17 T). |
| 7 | Denied requests: not written to the replay ledger. A later valid request may reuse the same request ID. | Denial rows are unchanged. |
| 8 | Request ID scope: globally unique. | Replay matching rules are not restated here; they stay as in R5. |
| 9 | Global enforcement audit (`enforcement_change`): deferred to 7F. | Out of 7C scope. No change to 0011 from this decision. |
| 10 | Lock enforcement: no GUC marker. No lock-acquiring trigger, unless staging evidence shows a gap and a separate 7B-2 amendment is approved. | OPEN: that staging evidence and that amendment. |
| 11 | Admin grant arithmetic: Asia/Kolkata calendar arithmetic. | OPEN: month-end clamping, and exact timestamp behaviour. Partly decided 2026-11-04 (Part 1I, A2): calendar-based clock time. Custom-grant boundaries DECIDED 2026-11-06 (Part 1L, B), which clarifies the OPEN wording of 2026-11-04. |

**Still OPEN after this record:** the maximum backdating window; the AAL2 recovery procedure and hosted and local claim verification; admin grant month-end arithmetic confirmation; C-12 and the remaining item 15 details; legal review of production retention and personal-data handling.

**Not approved by this record:** 7C implementation; 7C staging; SQL execution; staging setup and tests; migration application; commit, push, merge and deployment. 7B-2 implementation keeps its 2026-11-01 approval (scope only, Part 1F). R18 implementation keeps its NOT APPROVED status. Item statuses and counts (§14.2) are unchanged.

## Part 1E. Proposed on 2026-11-02, decided by owner (see Part 1G)

**Decided by owner, 2026-11-02 (Part 1G).** These 13 items were proposals. Their decisions are in the status column below and in Part 1G. They change no count or gate, and approve nothing beyond Part 1G: no 7C implementation, SQL, database access, staging setup or runs, tests, migration application, commit, push, merge or deployment. The approved 2026-11-02 decisions in Part 1D are unchanged.

| No. | Proposal | Status |
|---|---|---|
| O1 | Use a separate `licence_denial_windows` table for licence denial counters, replacing the `consume_rate_limit` design. Its placement is decided under O2. | DECIDED 2026-11-02: APPROVED |
| O2 | Keep the 2026-11-02 placement: `licence_requests` and `licence_denials` stay in `0011_licence_foundation.sql`, not a new migration. `licence_denial_windows` is also proposed for the same file, alongside them (approved under O2, Part 1G). | DECIDED 2026-11-02: APPROVED |
| O3 | Extend starts at `greatest(v_now, latest non-revoked coverage end)`. Fills the start-rule point in Part 1D item 6. | DECIDED 2026-11-02: APPROVED |
| O4 | Reject overlapping grants and duplicate non-revoked lifetime grants. No current rule existed. The half-open overlap test is documented in `STAGE7_DECISIONS.md` §12A.6. Scope to confirm: whether O4 applies to same-kind grants only, since lifetime over admin stays allowed (item 7). | DECIDED 2026-11-02: APPROVED WITH CONDITION. Scope decided 2026-11-04 (Part 1H, no. 1): same-kind grants only. *Clarified 2026-11-06 (Part 1M, R3):* enforced by the RPC, not by a database constraint; touching intervals are allowed. |
| O5 | Accept PostgreSQL month-end clamping. The exact timestamp behaviour stays OPEN. | DECIDED 2026-11-02: APPROVED |
| O6 | Defer admin disable from 7C. | DECIDED 2026-11-02: APPROVED WITH CONDITION |
| O7 | Break-glass writes require a documented lock-first procedure (`licence_lock_shop()` before any write). The procedure is not written here. | DECIDED 2026-11-02: CHANGED |
| O8 | Staging backdating window: 31 days, staging only. The production window stays OPEN. | DECIDED 2026-11-02: APPROVED (staging only) |
| O9 | Staging denial ceiling: count and alert, with no automatic refusal. The numeric ceiling stays undecided. | DECIDED 2026-11-02: CHANGED. The wording "count and alert" is superseded (Part 1H, no. 2). |
| O10 | Accept C-12 limitations for synthetic staging only: above 20 detailed denial rows per user per hour only counts are kept, and calls rejected by the permission check are not counted. Not accepted for production. | DECIDED 2026-11-02: APPROVED WITH CONDITION (synthetic staging only). **Omitted-detail marker: approved 2026-11-04 (Part 1H, no. 3).** Permission-rejected calls are counted within the approved staging cap (2026-11-04). Superseded for staging by Part 1I (B2): not counted. The "not counted" limitation above is superseded for staging. No automatic refusal. The counting mechanism is OPEN. |
| O11 | Verify the AAL2 requirement and recovery procedure using hosted staging. Local verification of the `aal` claim stays OPEN. | DECIDED 2026-11-02: APPROVED, OBJECTIVE ONLY |
| O12 | Use a hosted staging project for SQL and staging tests (recommended). No setup is approved. | DECIDED 2026-11-02: APPROVED, APPROACH ONLY. Cost and setup report provided 2026-11-04 (STAGE7_DECISIONS.md §12D; Part 1H, no. 9). Project creation NOT approved. |
| O13 | Approve the proposed staging test scope, including the R18 two-session tests, subject to separate setup and execution approval. | DECIDED 2026-11-02: APPROVED, TEST SCOPE ONLY |

## Part 1F. Status correction (2026-11-02): 7B-2

*Corrected 2026-11-02.* Earlier wording in this file and in `STAGE7_DECISIONS.md` §13 described 7B-2 as NOT approved or waiting for approval. That wording was stale. The accurate status:

- **7B-2 implementation was approved on 2026-11-01**, under the owner's instruction of that date to implement only Stage 7B-2 under the approved R18 design. Scope: `shop_licence_meta`, its guard, and `licence_lock_shop()`. Nothing else.
- The draft is in `supabase/migrations/0011_licence_foundation.sql`, untracked on `stage7-payments`. It is not applied, not tested and not committed.
- **Not approved:** staging verification of 7B-2, SQL execution, database access, staging setup and runs, and migration application. Each needs its own approval.
- **R18 implementation: NOT APPROVED.** The R18 lock-order design is approved (Part 1C). That does not approve R18 implementation or the two-session tests.
- The O1–O13 proposals in Part 1E were decided by the owner on 2026-11-02 (Part 1G). The 2026-11-02 migration-placement approval (Part 1D item 3) is unchanged.

Stale status wording corrected in place: Part 1B (the 7B-2 and 7C sentence), Part 1C (the 7B-2 row), Part 1D (the status sentence), Part 4 (the R18 row), Part 8 (the 7B-2 row), and the 2026-11-01 "Not approved" summary.

## Part 1G. Owner decisions recorded 2026-11-02: O1–O13 confirmed

Source: owner confirmation on 2026-11-02 of the draft record and its four clarifications. Full wording is in `STAGE7_DECISIONS.md` §13 (decision record). These are decisions only. They approve no implementation, staging, setup, SQL, test execution, migration application, commit, push, merge or deployment.

| No. | Owner decision (2026-11-02) | Conditions and outstanding gate |
|---|---|---|
| O1 | APPROVED. Separate `licence_denial_windows` table for licence denial counters. | Counts only. Gate: 7C implementation. |
| O2 | APPROVED. `licence_denial_windows` placed in 0011 with `licence_requests` and `licence_denials`. | Pre-staging review of 0011 required. Gates: pre-staging review; 7C implementation. |
| O3 | APPROVED. Extend starts at `greatest(v_now, latest non-revoked coverage end)`. | Gate: 7C implementation. |
| O4 | APPROVED WITH CONDITION. Reject overlapping grants and duplicate non-revoked lifetime grants. | The half-open overlap rule is documented before 7C implementation sign-off, and tested during separately approved staging. Documented in `STAGE7_DECISIONS.md` §12A.6 (2026-11-02). Scope to confirm: whether O4 applies to same-kind grants only. Scope decided 2026-11-04 (Part 1H, no. 1): same-kind grants only; a lifetime grant over an admin grant stays allowed. *Clarified 2026-11-06 (Part 1M, R3):* enforced by the RPC, not by a database constraint. |
| O5 | APPROVED. PostgreSQL month-end clamping. | The exact timestamp behaviour remains OPEN (decision 11). |
| O6 | APPROVED WITH CONDITION. Admin disable deferred from 7C. | A documented emergency disable and recovery procedure is required before 7C implementation sign-off. |
| O7 | CHANGED. Normal writes go only through the internal SECURITY DEFINER writer and approved RPCs. Owner-role SQL discipline is not the normal control. | Break-glass DB-owner procedure is documented separately and needs separate owner approval before 7C implementation sign-off. |
| O8 | APPROVED. 31-day backdating window, staging only. | Production window OPEN. |
| O9 | CHANGED. Count denials; no automatic refusal. | Alerting is not implemented or claimed. The numeric threshold and alert mechanism are OPEN. Corrected wording approved 2026-11-04 (Part 1H, no. 2); alerting is not approved. |
| O10 | APPROVED WITH CONDITION. C-12 limits for synthetic staging only. | Overflow is recorded as a count per window with a visible omitted-detail marker. Evidence is not silently discarded. Production C-12 OPEN. Omitted-detail marker approved 2026-11-04 and permission-rejected calls counted within the staging cap (Part 1H, no. 3); no automatic refusal; the counting mechanism is OPEN. Superseded for staging by Part 1I (B2): not counted. |
| O11 | APPROVED, OBJECTIVE ONLY. Verify the `aal` claim and recovery on hosted staging. | Execution is not authorised. Staging and execution are gated separately. Local `aal` check OPEN. |
| O12 | APPROVED, APPROACH ONLY. Hosted staging project. | Report cost, plan and setup for separate approval before creation. No production data. Report provided 2026-11-04 (STAGE7_DECISIONS.md §12D). Creation not approved. |
| O13 | APPROVED, TEST SCOPE ONLY. Staging test scope, including the R18 two-session tests. | Does not authorise setup, SQL execution or test execution. R18 implementation NOT APPROVED. |

**Outstanding gates:** 7C implementation; 7C staging and the R18 two-session tests; 7B-2 staging verification; hosted project creation; staging setup, SQL execution and test execution; R18 implementation beyond 7B-2; migration application, commit, push, merge and deployment; all production items. The full list is in `STAGE7_DECISIONS.md` §13.

## Part 1H. Owner decisions recorded 2026-11-04

These ten owner decisions, dated 2026-11-04, are recorded in `STAGE7_DECISIONS.md` (§12A.6, §12A.10, §12B.4, §12B.7, §12B.8, §12B.9, §12B.11, §12B.13, §12C, §12D and the record "Owner decision record (2026-11-04)" in §13). They are cited below as "no. 1" to "no. 10". "Previously approved" means the item was approved before 2026-11-04. "New" means it was first decided on 2026-11-04. They approve no gate, no implementation, no migration change or application, no SQL, no staging setup or run, no project creation, no test, no deployment, no secret change, no commit and no push.

| No. | Owner decision (2026-11-04) | Label | Effect and limits |
|---|---|---|---|
| 1 | O4 scope: option A. Reject overlapping grants of the same kind (admin with admin; lifetime with lifetime). A lifetime grant over an admin grant stays allowed. | New. Closes the O4 scope point. | Lifetime-revocation exposure is documented in §12A.6. Staging tests and 7C sign-off still apply. |
| 2 | O9 corrected wording: denials are counted; no automatic refusal; alerting is not approved, implemented or claimed; the threshold and mechanism remain OPEN. | New. Approves the corrected wording of the CHANGED decision of 2026-11-02. | "Count and alert" is superseded. |
| 3 | O10: the visible omitted-detail marker is approved. Permission-rejected calls are counted within the approved staging cap, with no automatic refusal. The overflow-count behaviour is preserved. | Marker: new. Overflow count: previously approved (2026-11-02). Permission-rejected counting: new; supersedes the "not counted" limitation for staging. | A function-level counter cannot see calls rejected before the function runs. The counting mechanism is OPEN and not designed. Production C-12 remains OPEN. Superseded for staging by Part 1I (B2). |
| 4 | Retention: option R-D selected TEMPORARILY. Cleanup stays disabled until C-1/M1 has legal review and an owner-approved retention policy. | New. Temporary, not final policy. | R-D is one of the retention options R-A to R-D in the 4 November report. It is not the refund options R-a to R-c (§12B.4). |
| 5 | Legal review is required for customer-file retention and related obligations. | New confirmation. The lawyer rows were already listed in Part 6. | Approves no retention change. |
| 6 | Migration 0012 (local main, unmerged): read-only review only. | New. | No implementation, SQL, staging application or deployment. Not an approval of item 23 or item 24. |
| 7 | Completion behaviour: not decided. The comparison of completion, queued-job, cancellation and reprint consequences is prepared for owner approval. | New. Deferred. | §12B.13. No option is selected. |
| 8 | Agent token: proposed 30-day idle expiry, 180-day maximum lifetime, 10-minute rotation overlap, and an in-flight exemption for finish calls after expiry. | New proposal, not decided. | §12C. Rotation implementation deferred until separately approved. |
| 9 | Staging: NOT approved. The O12 hosted-staging cost and setup report is provided first. | New. The O12 approach was previously approved (2026-11-02); no setup is approved. | §12D. No project creation, credentials or data. |
| 10 | Live database queries: NOT approved. The owner checks migration state and live jobs through the dashboard. | New. | Claude runs no live query. Affects the Part 6 rows for items 25 and 26. |

**Counts:** unchanged. No item changed status (§14.2). Earlier approvals are not withdrawn. Where a 2026-11-04 decision supersedes earlier wording for staging (O9 "count and alert"; O10 "not counted"), the earlier text is kept and annotated.

**Correction recorded:** `STAGE7_DECISIONS.md` §15.3 (7C row) read "O9: counted and alerted". It now reads the decided wording.

## Part 1I. Owner decisions recorded 2026-11-04 (Stage 7C)

Six owner decisions on Stage 7C, recorded in `STAGE7_DECISIONS.md` §13 ("Owner decision record (2026-11-04): Stage 7C, A1 to A5 and B2"). They approve no 7C implementation, staging setup or run, test, SQL, migration change (including adding tables to 0011), staging project, commit, push, merge or deployment. O1 and O2 (2026-11-02) are unchanged.

| No. | Owner decision (2026-11-04) | Status | Effect and limits |
|---|---|---|---|
| A1 | Different-kind grants may coexist (admin with lifetime). Same-kind overlap restrictions remain. Lifetime coverage takes precedence. | DECIDED | An admin grant over a lifetime grant is allowed. Closes the reading left open in Part 1H no. 1. |
| A2 | Calendar-based grants (1 month, 1 year) keep the start's clock time, with Asia/Kolkata month-end clamping. | DECIDED for calendar-based grants | Custom-grant boundaries OPEN as recorded on 2026-11-04. Clarified 2026-11-06 (Part 1L, B): DECIDED. Date-only start inclusive and end exclusive at 00:00 IST. |
| A3 | Written emergency-disable, DB-owner break-glass and admin recovery procedure, required before 7C implementation sign-off. | DECIDED (timing only) | Not required before implementation starts. Procedure text NOT WRITTEN. |
| A4 | Authorisation failures: committed `forbidden`, logged, counted. Other rejections: specific committed codes, not counted as authorisation denials. | DECIDED | Code names set in implementation review. |
| A5 | Staff receive no licence information. The owner RPC returns only the D fields. Labels belong to 7E. | DECIDED | Closes staff visibility. Label wording and Android remain open. |
| B2 | No anon-callable counting wrapper. Calls rejected before RPC execution remain uncounted for staging. Limitation documented. | DECIDED. Staging test expectations follow, subject to separate staging approval | Supersedes Part 1H no. 3 for staging only. Production C-12 remains OPEN. |

**Remaining 7C blockers** (detail in the §13 record):

| Scope | Blocker |
|---|---|
| Blocks 7C implementation start | Explicit 7C implementation approval. Adding the three licence tables to 0011: done 2026-11-05 (Part 1K), unapplied; pre-staging review still required. Admin RPC lock order (R18 rules 1 to 3; R18 beyond 7B-2 not approved). Custom-grant boundaries and extend period lengths: DECIDED 2026-11-06 (Part 1L). Global denial-detail ceiling G: provisional value set 2026-11-06 (Part 1L); production value OPEN. Replay-ledger treatment of business rejections: resolved 2026-11-05 (no row). |
| Blocks 7C sign-off | A3 procedure written and approved. Hosted `aal` and recovery verification (O11; execution not approved). |
| Blocks 7C staging only | Staging project (O12, §12D). Provisional ceiling value (set 2026-11-06, Part 1L; staging approval still needed). Staging test expectations for B2 and A4. Item 33 two-session tests. Synthetic admin account, and 0010 on a staging copy. Pre-staging review of 0011. |
| Blocks production only | Backdating window. Denial ceiling, threshold and alert mechanism (O9). Final C-12 acceptance. Lawyer review of retention and DPDP. Production admin UUID and MFA; admin count. Production migration list and live signatures (dashboard). |


## Part 1J. Owner decision recorded 2026-11-04: AAL2 failure handling

Recorded in `STAGE7_DECISIONS.md` §13 ("Owner decision record (2026-11-04): AAL2 failure handling") and §12A.8. It approves no 7C implementation, staging run, test, SQL, migration change, commit, push, merge or deployment.

| No. | Owner decision (2026-11-04) | Status | Effect and limits |
|---|---|---|---|
| AAL2-1 | A platform-admin RPC request that fails the required AAL2 assurance check is an authorisation failure. | DECIDED | Consistent with A4 (Part 1I). |
| AAL2-2 | It returns a committed `forbidden` result. | DECIDED | Committed, as R3 requires. |
| AAL2-3 | It is logged to `licence_denials` and counted toward the authorisation-denial counter. | DECIDED | Not written to the replay ledger or the audit log. |
| AAL2-4 | The protected admin operation is not executed. | DECIDED | No coverage, audit or replay-ledger row is written. |

**Resolved 2026-11-05 (Part 1K):** a denied request does not increment `state_version` (B2-2). **Still open:** hosted and local verification of the claim (O11, R16, S-3); the A3 recovery procedure text. **Resolved 2026-11-06 (Part 1L, D):** a missing, unreadable or insufficient `aal` claim fails closed.


## Part 1K. Owner decisions recorded 2026-11-05: Stage 7C bundles 1 to 3

Source: owner instruction on 2026-11-05 ("Proceed with the three approved Stage 7C decision bundles"). Authorised: documentation edits and the approved migration-file edit only. Not authorised: 7C implementation, SQL, tests, staging, Supabase project creation or configuration, applying the migration, commit, push, PR, merge, deployment, APK build, or changes to the protected main checkout or stash. The full record is in `STAGE7_DECISIONS.md` §13 ("Owner decision record (2026-11-05)").

| No. | Approved (2026-11-05) | Label |
|---|---|---|
| B1-1 | Replay design Option L (ledger as arbiter). Order: isolation check, authorisation, shape and hash validation, shop existence, shop meta lock, replay lookup, business checks, ledger insert, operation writes, state_version increment, commit. READ COMMITTED enforced. Replay contract, clarified 2026-11-06 (Part 1L; STAGE7 §12A.17 A and J): the same `request_id` with the same hash is a replay; the same `request_id` with a different hash is a committed conflict code; a conflicting insert whose row is not visible on re-read fails safely and writes nothing, and never continues as a new operation. `request_id` stays globally unique. | APPROVED. Advisory-lock option not used. |
| B1-2 | `licence_requests` has no `coverage_id`. `target_coverage_id` (immediate FK): required for revoke and replace, forbidden for grant and extend. Created coverage derived from `licence_coverages.request_id`. | APPROVED. Done in 0011. |
| B1-3 | Payload hash includes caller UID and `shop_id`, with action, expected version, confirmation and reason; excludes `request_id`. No separate caller UID column in the ledger. Full field list and encoding: STAGE7 §12A.17 A (2026-11-06). | APPROVED. Done in 0011. |
| B1-4 | Replay response: action, created coverage ID where applicable, target coverage ID where applicable, `state_version_after`. No mutable fields. | APPROVED. |
| B2-1 | Only committed successful operations create replay-ledger rows. | APPROVED. |
| B2-2 | `state_version` increments exactly once per committed successful admin operation. No increment for denials, rejections, replays or reads. | APPROVED. Denied AAL2 requests do not increment. Sequencing of the increment: STAGE7 §12A.17 J (2026-11-06, R13). |
| B2-3 | No `auth.users` foreign key on denial or counter actor columns. `platform_admins` FK kept. | APPROVED. Done in 0011. |
| B2-4 | No DELETE or TRUNCATE on denial or counter records until retention is approved. | APPROVED. Done in 0011. |
| B3-1 | 0011 adds `licence_requests`, `licence_denials`, `licence_denial_windows`, with constraints, indexes, RLS, revokes and guards. | APPROVED. Done in file. NOT applied, NOT tested. |
| B3-2 | Counter rows carry `denial_count` and `detail_count`. Omitted = `denial_count − detail_count`. No `detail_omitted_count` stored. `0 <= detail_count <= denial_count`. | APPROVED. Done in 0011. |
| B3-3 | Lock-order invariant documented: actor row, then global row, both before any meta lock; no meta lock on the denial path. | DOCUMENTED. Implementation not approved. |
| B3-4 | Plain `uuid` actor columns, no `auth.users` FK. | APPROVED. Done in 0011. |
| B3-5 | `target_coverage_id` and its action-dependent constraint. | APPROVED. Done in 0011. |
| B3-6 | Shop meta guard enforces `NEW.state_version = OLD.state_version + 1` per update. | APPROVED. Done in 0011. |

**Superseded in this sheet:** the state_version row (Part 1D item 3 annotation); the business-rejection replay row (Part 1I, now resolved); the AAL2 "still open" item on state_version (Part 1J); the lawyer ledger-user-ID line (Part 6).

**Still OPEN as of 2026-11-05 (not approved here; the 2026-11-06 clarification below supersedes the items it names):** global denial-detail ceiling G (no value); custom-grant date convention, including whether the end date is inclusive; extend period lengths; retention periods for denial rows, counters, the replay ledger and the audit log (legal); hosted or local AAL verification and the meaning of "before 7C"; handling of a missing or unreadable `aal` claim; pre-staging review of 0011 (O2); A3 recovery text and O7 break-glass text. The advisory-lock contract (Part 10, 2026-11-01) stays NOT APPROVED and is not used. *Clarified 2026-11-06 (Part 1L):* the custom-grant date convention, the extend period lengths and the handling of a missing or unreadable `aal` claim are now decided, and the global ceiling has a provisional value. The production ceiling and the other listed items stay OPEN.

**Note on single-update enforcement:** the guard checks each update, not updates per transaction. The 7C RPC must perform exactly one update to `shop_licence_meta` per committed operation.

## Part 1L. Specification correction pass recorded 2026-11-06 (Stage 7C)

Source: `STAGE7_DECISIONS.md` §12A.17 and §13 ("Owner decision record (2026-11-06): specification correction pass"). This Part approves no gate, setup, SQL, test, staging, migration change or application, commit, push, merge or deployment. Nothing has been executed or verified.

| No. | Decision (2026-11-06) | Status | Effect and limits |
|---|---|---|---|
| A | Replay payload hash: server-side canonical encoding, SHA-256, `request_id` excluded. Same hash is a replay; different hash is a conflict; a conflict that disappears on re-read fails safely | DECIDED. Legal review of identity-derived hashes OPEN | Full field list and encoding: §12A.17 A. B1-3 stays; §12A.17 A gives the complete list. |
| B | Custom-grant boundaries: date-only start inclusive and end exclusive at 00:00 Asia/Kolkata; half-open; not for calendar grants with timestamps | DECIDED | Closes the 2026-11-04 hold (Part 1I, A2). §12A.17 B. |
| C | Extend: one calendar month or one calendar year only | DECIDED | Asia/Kolkata arithmetic and month-end clamping kept. No other length approved. §12A.17 C. |
| D | Missing, unreadable or insufficient `aal` claim: fails closed as a committed `forbidden`; the protected operation does not execute | DECIDED. Local and hosted staging verification OPEN. Required before 7C sign-off, not before implementation. No evidence exists | Decision 14. §12A.17 D. |
| E | Denial detail ceiling: 1,000 detail records per UTC hour, global. Exact counts kept after the cap. Omitted = denial count minus detail count. 20-per-actor limit kept | PROVISIONAL. Staging and initial engineering default only. Production OPEN. No automatic alerting | Not a legal or retention decision. §12A.17 E. |

**Mandatory 7C RPC requirements** (specification only, not implemented; §12A.17 G to M, with S and T added 2026-11-06 in Part 1M): no rollback of a committed `forbidden` result (a failed counter or required detail write raises instead, C2); denial-path lock order (actor counter, then global counter, both before any meta lock); ON CONFLICT predicates; UTC-hour alignment; safe replay under READ COMMITTED; target shop check and `clock_timestamp()` after the lock; hardened SECURITY DEFINER; sequence privileges.

**Corrections recorded.** Custom-grant status made consistent (C2). D2 removed. D3 and D5 replaced with the B-labels they correspond to. Stale line references corrected. AAL references now cite decision 14, not licence-unit decision 1. `payment_id` removed from the `licence_coverages` column list. The `licence_lock_shop` signature includes `p_mode`. The omitted-count reference is B3-2. Superseded permission-count wording removed from operative text. The 90-day denial retention is a proposal subject to legal review. The replay conflict contract is stated. The lock order is complete. The append-only description is documented in §12A.17 O.

**Future changes, recorded and not made.** Each needs separate review and approval: the 0011 header (the line 31 append-only description, the D-labels in its comments, and the lock-order comment at lines 40–41); revoking sequence privileges on the `licence_denial_windows` identity sequence after staging review; whether to tighten `search_path`; and whether to add a UTC-hour alignment check; and whether to add a database constraint for O4 overlap or cross-shop target validation (STAGE7 §12A.17 N.7). The 0011 line 53 comment, which says the global ceiling is OPEN, is now provisional (§12A.17 N.6). No change to 0011 was made in this pass.

**Still OPEN** (not decided, not approved here): legal retention periods, including the 90-day denial proposal; the production denial-detail ceiling; the production backdating window; production admin identity and MFA policy beyond the approved requirements; legal review of identity-derived payload hashes; production alert thresholds and the alerting mechanism; actual hosted and local `aal` verification evidence; and completion of the emergency-disable, break-glass and recovery procedure (A3, O6, O7); and database constraints that would need a migration change, including for O4 overlap and cross-shop target validation.

## Part 1M. Consolidated specification correction pass recorded 2026-11-06 (second record)

Source: `STAGE7_DECISIONS.md` §12A.17 (items A, G, J, K, N, Q, S, T and U) and §13 ("Owner decision record (2026-11-06, consolidated pass)"). This Part approves no gate, setup, SQL, test, staging, migration change or application, commit, push, PR, merge, deployment or APK build. Nothing has been executed or verified.

| No. | Decision (2026-11-06, consolidated pass) | Status | Effect and limits |
|---|---|---|---|
| C1 | Replay hash contract: domain and version `qrquick-licence-request-v1` is the first hashed field; fixed common and action-specific field lists; `request_id` excluded; unknown fields rejected; server computes the hash; normalisation; typed, length-prefixed encoding; SHA-256 | DECIDED. Legal review of identity-derived hashes OPEN. Byte-exact test vectors required in staging before 7C sign-off | §12A.17 A. A client never supplies the hash. A change of format is a deliberate version change (A.9). |
| C2 | Counter write failures: an unexpected actor or global counter write failure, or a required detail write failure, aborts and rolls back the whole transaction and raises an error. No committed `forbidden`, no protected operation, no claim that the denial was recorded | DECIDED | §12A.17 G; §12B.7. Detail omission at a cap is not a failure: exact counts continue and the omitted count is recorded (R7). |
| R1 | Extend is rejected whenever a non-revoked lifetime grant exists, including scheduled lifetime coverage. No finite start is calculated from a NULL lifetime end | DECIDED | §12A.6; §12A.17 T |
| R2 | Extend tests: rejection while lifetime exists; one-calendar-month and one-calendar-year options; rejection of every other unit; month-end clamping; the start calculation | DECIDED as test requirements. Not run | §12A.11; §12B.11 |
| R3 | O4 same-kind overlap applies to the RPC. Staging tests for overlapping and touching intervals. Enforced by the RPC, not by a database constraint, unless a constraint is separately approved | DECIDED as the RPC rule. No constraint added | §12A.6; §12A.17 N.7, Q; §12B.11 |
| R4 | Replay tests: every common and action-specific field; `request_id` exclusion; unknown fields; same ID and hash replay; same ID and different hash conflict; cross-shop target; missing actor UID; conflict re-read returning no row | DECIDED as test requirements. Not run | §12A.17 A; §12B.11 |
| R5 | Local and hosted AAL verification required before 7C sign-off, not before implementation begins. No claim without evidence. Missing, unreadable or insufficient `aal` fails closed | DECIDED. Verification OPEN; no evidence exists | §12A.8; §12A.17 D |
| R6 | A valid reason for every admin operation, including Extend. The same validation contract for coverage and audit records. The server checks more than confirmation, state version and admin identity | DECIDED | §12A.8; §12A.17 S |
| R7 | Normal counter updates and any permitted detail row commit atomically. Detail omission at the cap is expected. An unexpected counter or required detail write failure aborts under C2 | DECIDED | §12A.17 G |
| R13 | `state_version_after` is the locked current version plus one, computed before the success-only ledger row is inserted. `state_version` increments exactly once per committed successful admin operation. Replays, denials, rejections and reads do not increment it | DECIDED | §12A.5; §12A.17 J |
| X | Documentation: tests added to §12A.11 and §12B.11; AAL timing clarified; M8 corrected (policy direction approved; 90-day period not approved); Part 10 corrected; provisional 1,000 ceiling in the future-change register (§12A.17 N.5), production OPEN; O4 overlap and cross-shop validation RPC-enforced unless separately approved constraints are added; "specification only, not implemented" on §12A.17 G to M, S and T; dated clarifications; cross-references checked | DONE in this pass | §12A.17; §12B; §14; §15; Parts 1D, 1E, 1G, 1K, 1L and 10 |

**Still OPEN after this Part** (not decided, not approved here): production retention periods and legal or DPDP conclusions; the production denial-detail ceiling (the 1,000 value is provisional only); the production backdating window; the production alert threshold and alert mechanism; production admin identity and MFA policy beyond the existing decisions; legal acceptance of identity-derived hashes; emergency-disable and break-glass procedure completion; database constraints that would need a migration change, including for O4 overlap and cross-shop target validation; hosted and local AAL verification evidence.

**Not approved by this Part:** 7C implementation, staging, SQL and test execution, migration change or application, staging project creation, commit, push, PR, merge, deployment and APK build. No gate is approved.

## Part 2. Decide now (owner answers, RECOMMENDED)

These are defaults the owner can confirm or change. A confirmed answer records a decision and approves no gate.

| ID | Decision | File status | Claude suggests | Consequence |
|---|---|---|---|---|
| Dec 2 | Term and renewal (item 16) | DEFERRED (owner decision 7, 2026-11-01) | Manual renewal each year, with no automatic renewal (not decided) | Renewal is deferred. It does not block 7B. It reopens with the paid path (M5). The 12-month term stays approved as policy (M4). |
| Dec 13 | Admin accounts (item 5) | RECOMMENDED | One owner admin. An extra admin needs an owner-run SQL row | The admin Auth UUID is still needed (Part 4). |
| Dec 15 | Admin UI hosting (item 6) | RECOMMENDED | A separate private deployment, not linked from the shop app and not published with the public site | 7D needs this decision and the visibility check. |
| Dec 16 | Backdating and lifetime rules (item 7, 7C validation) | RECOMMENDED. Maximum custom length DECIDED (none, 2026-11-01). 2026-11-02 (Part 1D): backdating needs explicit confirmation; lifetime admin-only; backdating window OPEN | Backdating only with explicit confirmation. Lifetime admin-only (2026-11-02) | These are 7C inputs and do not change the 7B schema. Maximum custom length: none (owner decision 6). |
| Dec 18 | Grace period (item 13) | RECOMMENDED | No grace period | Printing is blocked in every non-ACTIVE state (§12B.3, from B and C). Queued jobs are held and retries are blocked from the end date. Jobs already printing may finish. Any grace days would change this rule. The wording for the NONE state is also open. |
| Dec 19 | Shop-facing view: labels (item 13) | RECOMMENDED | Keep the file's position: Active or Inactive only, with no admin-grant label | Approved (§12B.2 D): the owner-only fields are active or inactive, access end or no-expiry, and next start when relevant (next start shown only in SCHEDULED, owner decision 8, 2026-11-01). Still open: the label wording, whether an admin grant may show a label, and staff visibility. Staff visibility closed 2026-11-04 (Part 1I, A5). The Android view is DEFERRED (Part 9). |
| Dec 11 | Advisers (item 19) | RECOMMENDED | Engage an Indian CA and a lawyer before any paid collection | No engagement is evidenced. Their advice is needed for the blockers in Part 6. |
| Dec 10 | Stage 6 merge order (item 20) | RECOMMENDED | No view given here | Decide whether `stage6-simulated-printer` (885d28b) is merged before Stage 7 is rebased. This affects rebase order only. Nothing is merged by this sheet. |
| S-4 | Residual 180-second file-link window (item 35) | RECOMMENDED | Accept it, or reduce it before the 7F build | §15.3 requires S-4 accepted before 7F. |

## Part 3. Decided before the 7B design (answered 2026-11-01)

| ID | Decision | File status | Claude suggests | Consequence |
|---|---|---|---|---|
| C-5 | Keep `paid_verified` and `licence_payments` out of 0011. `trial` is also out (C-10, deferred) | DECIDED (owner, 2026-11-01): accepted | Accepted | 0011 has no paid tables. Paid tables come later, under their own gate. |
| Item 8 (C-8; fixes 5 and 9) | Revoking current coverage does not cancel future coverage. A same-instant tie gives REVOKED. The exclusive end is displayed | DECIDED (owner, 2026-11-01): all three accepted | Accepted | The 7B state function and revocation trigger implement them. Standalone paid revocation stays DEFERRED (decision 17). |
| Item 7 | Basis ranking: a lifetime grant over an admin grant (§12A.6) | DECIDED (owner, 2026-11-01): confirmed | Confirmed | Sets the order in the 7B state function. M6 covers paid coverage only. |

Not needed before the 7B design (§15.3): item 5 and Dec 13 to 15; C-6; C-1; C-3; the grant-limit inputs in Part 4; C-7 and the other paid-path items; item 2 (M1 only); item 26 (before a production migration only).

## Part 4. Decide before or during 7C to 7F, and before setup

| ID | Decision | Needed before | Claude suggests | Consequence |
|---|---|---|---|---|
| Item 5, Dec 14 | Production-owner evidence: the admin Auth user UUID (never inferred) and the MFA status. Whether `aal2` is required for admin RPCs. Both are EXTERNAL BLOCKER | 7A, the bootstrap row, 7C, 7D | Require `aal2`. The production owner supplies the UUID | 7A cannot finish without them. The UUID is not put in the migration. 2026-11-02 (Part 1D): `aal2` requirement OWNER-APPROVED. Recovery procedure and hosted and local claim verification OPEN. A3 (2026-11-04, Part 1I): the written procedure is required before 7C sign-off. AAL2 failure handling decided 2026-11-04 (Part 1J). Missing or unreadable `aal` claim: fails closed (Part 1L, 2026-11-06). |
| Dec 16, maximum length (item 7) | Maximum custom grant length | 7C validation | DECIDED (owner, 2026-11-01): none. No maximum duration | Closed. The 7B schema has no duration cap. The 7C validation must not impose one. |
| Item 15, C-12 | Global denial ceiling value. Accept count-only records above the cap of 20 per user per hour | 7C | Set the ceiling after staging measures row growth. No value is proposed here. **Circular:** §15.3 requires this ceiling accepted before 7C, but the measurement needs the 7C denial log on staging. Owner to choose: (a) a test-only provisional ceiling for staging measurement, or (b) a value set without measurement. 2026-11-02 (Part 1D): option (a) chosen, a provisional ceiling for staging only. Production ceiling and remaining C-12 details OPEN. Provisional value set 2026-11-06: 1,000 detail records per UTC hour (Part 1L). The production value is OPEN. | Sets denial-log growth. Detail above the cap is lost, and the owner must accept that. |
| Dec 7 | Deletion schedule: whether licence expiry should change file deletion timing. This is separate from the expiry behaviour already approved (A, B, C) | Enforcement activation, and any retention change | No view given here. The current schedule stays until decided | Open under item 1. The current purge schedule is unverified live (§5C). |
| C-1 (item 1) | Lawyer's answer on the release rule for held files. Option (i): a new terminal order status, which changes the 0001 transitions and is out of scope so far. Option (ii): a licence-specific file-release rule | Before the owner's C-3 decision, and before M1 | Lawyer answers first. The owner chooses the option afterwards | Without an answer, held files of paid orders in `printing` are never purged (0010 lines 795–798). 2026-11-04 (Part 1H, no. 4): retention option R-D is selected temporarily; cleanup stays disabled until this item has legal review and an owner-approved retention policy. Temporary, not final policy. |
| C-3 (item 1) | Held files: accept as an interim, or hold enforcement back | The 7F build (C-3 decided). Enabling depends on the choice | Decide after the C-1 answer | Accept as an interim: held files are kept indefinitely until M1 exists. Hold back: enabling waits for M1, for item 2 (reopened) and, where paid orders are affected, for item 10. The build needs C-3 decided, whichever choice is made. 2026-11-04 (Part 1H, no. 4): C-3 is not decided. R-D (temporary) keeps cleanup disabled, so no file is released; this is not the C-3 decision. |
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
| Item 33 lock tests | Two-session test of the shop-lock order (R18). The lock-order contract is design-approved (Part 1C) and not built | Staging approval, before 7C and 7F | Run after the 7C design | The lock map of the existing code is recorded (§12B.5). |
| R18 lock-order contract | Shop meta row → order → agent → jobs (§13 third record; Part 1C). Not built | 7B-2 approved for implementation 2026-11-01 (scope only). Separate implementation approval for the rest of R18 | Design approval: GIVEN (2026-11-01). R18 implementation approval beyond 7B-2: NOT GIVEN | 7B-2 is not blocked. The rest of the R18 implementation and all admin RPCs (7C) still need separate approval. The print-side changes (items 23, 24 and rule 10) have their own gates. |
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
| Lawyer | Release rule for held files (C-1, item 1), with options (i) and (ii) in Part 4. Customer-document sensitivity and DPDP applicability (item 30) | M1; C-3; enabling; retention rules. Legal review of customer-file retention and related obligations is required (2026-11-04, Part 1H, no. 5). |
| Lawyer | Refund policy (item 10). Consumer-refund obligations are not yet researched (§12B.6) | Refund tests; the paid path |
| Lawyer | Retention. Denial records (`licence_denials`): proposed 90 days, subject to legal review (M8). Successful replay and idempotency records (`licence_requests`): kept as long as necessary to prevent replay, not on a 90-day schedule (M8). Audit rows (item 14). The replay ledger has no actor column, but its payload hash is derived from the caller UID (Part 1K). Denial and counter rows hold plain actor UUIDs, and their retention is OPEN (S-6) | 7C logging; audit rules |
| Lawyer | Privacy policy, terms, consent and takedown text (item 29). Google Play policy (item 28). The 30-day notice to existing shops (item 11) | Published terms; any Android licence payment; existing-shop terms |
| Production owner | Admin Auth user UUID and MFA status (item 5, Dec 14) | 7A; the bootstrap row; 7C and 7D |
| Production owner | Shop count N, excluding test rows (item 11; README lines 395–405) | Enabling; existing-shop terms |
| Production owner | Live function signatures and grants, read-only (item 25). Owner checks through the dashboard (2026-11-04, Part 1H, no. 10); Claude does not query live data. | The checkout-unaffected test; 7F |
| Production owner | Applied migrations, read-only (item 26). Owner checks through the dashboard (2026-11-04, Part 1H, no. 10); Claude does not query live data. | Any production application of 0010 or 0011 |
| Production owner | Whether `cleanup-files` is deployed, whether its secrets are set (not their values), and its recent runs (item 27) | Any claim that the purge runs (§5C, §8). Cleanup stays disabled until C-1/M1 has legal review and an owner-approved retention policy (2026-11-04, Part 1H, no. 4). Temporary, not final. |
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
- Local main migration 0012 (unmerged; not on the Stage 7 line) already combines R-b with claim and mark checks. It is not one of R-a, R-b or R-c as written, and it has not been reviewed. Its effect on retention is open under C-1 (cancelled jobs are not in the 0010 keep-list). Read-only review approved 2026-11-04 (Part 1H, no. 6). No implementation, SQL, staging application or deployment is approved, and the review is not a fix approval.

## Part 8. Gate summary (matches §15.3)

| Gate | Owner input | External evidence | Approval |
|---|---|---|---|
| 7A owner inputs | Dec 13 to 16 and 18 to 19. Confirmations for items 6, 7 (backdating and lifetime admin-only, 2026-11-02) and 13. Item 8 is DECIDED (2026-11-01). Item 16 renewal is DEFERRED and is not a 7A input | Production owner: UUID and MFA status (item 5) | Owner's written answers |
| 7B-1 schema, migration `0011_licence_foundation.sql` on the origin/main line. File only, unapplied | DECIDED (2026-11-01): C-5; item 8; item 7 basis ranking. Licence unit DECIDED (item 16, decision 1). Renewal DEFERRED and not an input. Numbering per Part 1A | None for file creation. A production migration needs item 26 | File creation approved 2026-11-01. Pre-staging review of 0011 required (O2). Each staging run needs its own approval |
| 7B-2 lock helper and meta row (`licence_lock_shop()`, `shop_licence_meta`) | R18 lock-order contract (Part 1C): design approved 2026-11-01 | APPROVED for implementation 2026-11-01 (scope only). Draft in 0011: unapplied, untested, uncommitted | Staging verification and SQL execution NOT approved. Each needs its own approval |
| 7B tests only: Option A or B (Part 4); Decision L and the fixture approach (Part 4) | Local or staging setup; Auth-schema inspection | NOT APPROVED | Separate approval for each step |
| 7C admin RPCs | 7B on staging; the item 15 ceiling (provisional 1,000 per UTC hour set 2026-11-06, Part 1L; production OPEN); C-12; the grant-limit inputs (Dec 16; maximum length is closed as none); item 33 lock tests on staging; O1 counter in 0011 after pre-staging review (O2); O9 and O10 limits as recorded | Item 5 (`aal2` approved 2026-11-02) | Separate approval. Before 7C sign-off also: O4 overlap rule documented; O6 emergency disable and recovery procedure approved; O7 break-glass procedure approved (A3, 2026-11-04: sign-off items, not implementation-start items) |
| 7D admin UI | 7C on staging; hosting (Dec 15) | Item 6 visibility check; item 5 | Separate approval |
| 7E owner status | 7C; the labels (Dec 19, item 13); display rule (item 8) | None | Separate approval |
| 7F build | 7C and 7E; S-4 accepted; C-1 answered and C-3 decided (item 1; both OPEN, not decided); item 32 kill-switch design approved; the order of items 23 and 24 decided | Item 25 live signatures; S-5 local test | Separate approval to build |
| 7F enabling | Item 11 (before enforcement activation). M1, item 2 (reopened) and item 10 if C-3 holds enforcement back | Item 11 count (production owner); lawyer's review of the notice | Separate approval to enable |

## Part 9. Deferred (no action until reopened)

Each item below is deferred. None is required now.

| Item | Deferred status | Reopens when |
|---|---|---|
| Item 2: hold start and scheduler (C-2) | Owner instruction 1. Not a closure requirement | C-3 holds enforcement back, or M1 is put forward for build. The owner then chooses (a) the job's `created_at`, which can fail a job a day into a lapse, or (b) the time the shop left ACTIVE, stored as a marker. The file recommends (b). |
| Item 9: trial (Dec 5; C-10) | Deferred, not removed (instruction 4). Trial terms not approved | A new owner decision on product and pricing terms |
| Item 17: processor and gateway (Dec 9) | Gateway deferred. Stripe is invite-only; Razorpay unverified | The owner reopens decision 9. Processor eligibility evidence and CA advice come first |
| Decision 17 (part of item 8): standalone paid revocation (Dec 17) | Deferred with the paid path | The paid path is approved (M5) |
| Item 21: premium features (Dec 12) | None built | The owner names the features and approves a feature list and build plan |
| Item 7: maximum custom length | Decided 2026-11-01: none (no maximum duration) | Closed |
| Dec 2 and item 16: renewal rule | DEFERRED (owner decision 7, 2026-11-01). Does not block 7B | The paid path opens (M5) |
| Item 22: custom SMTP | Deferred | The owner chooses custom SMTP, or production sign-up volume is about to start (the built-in limit is 2 emails an hour, §3) |
| Item 27: purge capacity change | Deferred | Shop count nears about 3,000. Separate approval needed |
| Item 31: configuration versioning (`supabase/config.toml`) | Deferred | Local setup is approved |
| Item 13: Android licence view | Deferred | The owner decides to show the licence view in the Android app |
| Item 34: deleting test rows on live | Deferred | The owner gives an explicit go-ahead |

## Part 1N. Owner decisions recorded 2026-11-08 (Stage 7C corrections and the 7D read API)

Recorded in `STAGE7_DECISIONS.md` §13A (S1 to S9). The engineering items below are APPROVED for local implementation only. They approve no deployment, hosted or staging run, migration apply, commit, push or pull request.

| No. | Owner decision (2026-11-08) | Status | Effect and limits |
|---|---|---|---|
| N1 | Backdating fails closed when no staging window is configured, using `backdate_window_exceeded`. | APPROVED (engineering) | Production window: OPEN (decision 5). |
| N2 | Preserve H4. The owner status read is an explicit exception to A4: its denials are not logged. | APPROVED (engineering) | A4 wording for owner reads: OPEN for the owner's signature. |
| N3 | Three admin read RPCs (shop search, shop licence view with coverage IDs and state version, paginated audit), as proposed. | APPROVED (engineering) | Applying or deploying: OPEN. Hosted AAL2 (O11): OPEN. |
| N4 | Search and coverage limits as proposed (2 to 80 characters, prefix match, limit 25, coverage cap 50). | APPROVED (engineering) | Substring search: OPEN. Showing expired or revoked history: OPEN. |
| N5 | Audit page sizes as proposed (25 default, 100 maximum). Visibility of admin user IDs to other admins: **UNRESOLVED**. | Page sizes: APPROVED (engineering). User IDs: UNRESOLVED (owner decision). | Interim: the 7D audit view hides `actor_user_id` (not shown on screen). The database field and the API response keep it. Owner decision needed before any production use. |
| N6 | Indexes on the Stage 1 `shops` table (two) and the audit log (one). | APPROVED in migration text | Applying the `shops` indexes: OPEN. |
| N7 | Migration number 0013, provisional. | PROVISIONAL | Final numbering: OPEN (E7). |

Still OPEN and unchanged: production backdate window (decision 5), production denial cap and alerting (C-12, O9), hosted AAL2 (O11), staging project (O12), staging concurrency (item 33), legal retention and DPDP (decision 20, M8), the admin UI hosting decision (§14.2 item 6), and the 7D gate.

## Part 10. Recorded approvals (reference only)

These approvals are listed for reference. Several carry open conditions, which are recorded in each entry and in Parts 1D to 1M. Blocked, conditional and proposed items are not listed here. They are in Parts 3 to 7 and 9. *Corrected 2026-11-06 (Part 1M):* the earlier statement that these approvals have no open condition was incorrect.

- §12B.2 A printing-only enforcement. §12B.2 C retries blocked while inactive. §12B.2 G SCHEDULED state.
- §12B.2 D owner-only status, with the fields approved. Its labels, staff visibility and Android view are open (Parts 2 and 9). Staff visibility closed 2026-11-04 (Part 1I, A5).
- M2 refusal after the natural end. M3 denial design (cap of 20 per user per hour; counter `licence_denial_windows`, O1; overflow marker, O10; the build is gate 7C; provisional global ceiling of 1,000 detail records per UTC hour, set 2026-11-06, production OPEN). M4 custom-grant convention (boundaries decided 2026-11-06, Part 1L). M5 paid-path block. M6 lifetime over paid coverage, as policy (its tests need the paid path). M7 review required for both printing fixes. M3 staging limitation (Part 1I, B2, 2026-11-04): calls rejected before RPC execution are not counted; no automatic refusal.
- Approved, but blocked with the paid path (M5): §12B.2 F, H and J, and the paid term in M4.
- Approved for design only: §12B.2 E. Enabling stays blocked until item 11 is answered.
- Licence unit: per shop (decision 1, owner decision 2026-10-31). Item 16: renewal DEFERRED (decision 2; owner decision 7, 2026-11-01). The unit is DECIDED.
- 2026-11-01: Stage 7 baseline is origin/main (717717b lineage), numbering from 0011, and local-main 0011–0014 kept separate and unmerged. C-5 accepted. Item 8 accepted (C-8, fixes 5 and 9). Item 7 basis ranking confirmed (lifetime over admin). Dec 16 maximum custom length: none. Renewal deferred and not a 7B blocker.
- 2026-11-01, second record: next start shown only in SCHEDULED (decision 8); C-9 replacement wording adopted (decision 9); `service_role` stays revoked in 0011 (decision 10); owner-facing state reads use the current time only (decision 11).
- Not approved (2026-11-01): the superseded advisory-lock admin contract. This refers only to the earlier advisory-lock R18 design. It does not refer to the R18 lock-order design, whose design is APPROVED (Part 1C) and whose implementation is NOT approved. Also not approved: admin RPCs, printing fixes 23 and 24, tests, staging, local setup, commits and pushes. (`licence_lock_shop()` was approved for implementation on 2026-11-01, scope only: Part 1F.)
- 2026-11-01, third record: R18 lock-order contract approved as design only (Part 1C). Implementation is not approved; no code, SQL, test, setup, commit or push is approved.
- 2026-11-04, Part 1I (Stage 7C): A1 different-kind grants may coexist; A2 calendar-based grants keep the start's clock time (custom-grant boundaries OPEN as recorded; decided 2026-11-06, Part 1L); A3 procedure required before 7C implementation sign-off, not before implementation starts; A4 response contract; A5 staff receive no licence information; B2 permission-rejected calls not counted for staging. No gate approved.
- 2026-11-04, Part 1J: AAL2-1 to AAL2-4 decided. A failed AAL2 check is an authorisation failure: committed `forbidden`, logged and counted, protected operation not executed. No gate approved.

Not listed here, and still open: §12B.2 B (conditional on C-1 and C-3; EXTERNAL BLOCKER), I (pricing, blocked), K (fix implementation, Part 7), L (local setup first), M1 (proposal), and M8 (policy direction approved; the 90-day retention period is NOT approved; legal review needed before any period is fixed).


## Corrections record 2026-11-10 (see STAGE7_DECISIONS.md §13F)

No approval is given or changed by this note.

- D-MIG: the 0015–0017 renaming was reverted the same day. The licence files are back at 0011–0013. The numbering proposal is NOT approved. Owner approval is required before any renumbering.
- Cleanup (decision row 4, and the production-owner row): "cleanup stays disabled" describes the intent of R-D. The repository's `cleanup-files.yml` on `origin/main` is still scheduled. Whether it runs depends on secrets and deployment (UNVERIFIED, item 27). An owner decision is needed on how R-D is implemented.
- "item 32 kill-switch design approved" (7F build row) is a gate condition, not a status. D-I32 is PENDING.
