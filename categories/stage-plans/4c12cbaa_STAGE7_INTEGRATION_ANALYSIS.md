> Numbering note (2026-11-10 reconciliation): D-MIG is NOT approved, and the licence files are back at 0011 to 0013. Any 0015 to 0018 mention below is the unapproved proposal only. See scratchpad/reconciliation_2026-11-10/03_migration_conflict_report.md.

# Stage 7: migration integration analysis, and 7F preparation

Date: 2026-11-09. Read-only analysis. No migration was edited, renumbered or applied. No commit,
push, PR, merge, deployment, hosted SQL or production change was made. Owner decision 6 applies:
no renumbering or application until the owner approves the plan in section 7.

## 1. Result in brief

- Both migration lines start from the same base, `0001`–`0010`. The files are byte-identical in
  local `main`, `origin/main` and the committed `stage7-payments` (checked by SHA-256).
- **Chain A** is local `main` commit `37e4623` (unpushed): `0011_service_options`,
  `0012_print_eligibility`, `0013_order_workflow`, `0014_create_shop_confirmed_email`. It has
  rollbacks and tests in the same commit.
- **Chain B** is the stage7 worktree, uncommitted: `0011_licence_foundation`,
  `0012_licence_admin_rpcs`, `0013_licence_admin_read_rpcs`. It has no rollbacks.
- No object name is defined by both chains. Chain B refers to no object that only Chain A defines.
  So the chains do not depend on each other and either order works on a database at `0010`.
- The file numbers collide: both chains use `0011`–`0013`. One chain has to be renumbered before any
  combined sequence exists.
- **7F depends on Chain A.** Chain A redefines the functions that 7F gates: `approve_order_for_print`,
  `agent_claim_next_job` and `agent_mark_printing`. Building 7F on `stage7-payments` alone would
  change the wrong bodies. Chain A has to be part of the integrated branch first.
- Recommended, pending approval: keep Chain A exactly as committed, and rename Chain B's three
  uncommitted files to `0015`, `0016`, `0017`. This changes no committed history.

## 2. Histories (git, read-only)

| Ref | Position |
|---|---|
| `origin/main` | `717717b`. Contains `0001`–`0010`. |
| local `main` | `37e4623` = `4d97e40` + 1 commit (adds Chain A). 4 `origin/main` commits are not in local `main`, and 1 local commit is not on `origin/main`. |
| `stage7-payments` | `5c82d37`. Contains all of `origin/main`, plus 8 docs-only commits. |
| `stage7e-owner-licence-status` | `5c82d37`. No commits of its own. |
| merge-base (`main`, `stage7-payments`) | `4d97e40` |

Files changed on both lines since `4d97e40` (conflict surface for any merge of Chain A into the
stage7 line): `web/package.json`, `web/src/auth.js`, `web/src/logic.js`, `web/src/owner.js`,
`web/tests/auth.test.js`, `web/tests/owner-registration.test.js`. The 7E branch also changes
`web/src/owner.js` and `web/package.json`, so 7E will need reconciling in any combined branch.
Local `37e4623` ("Add owner email-code registration and password setup") and origin's `8e29762`
("Restore owner email-code registration and password recovery") cover overlapping work.

## 3. Chain A objects (commit 37e4623)

| File | Creates | Redefines base functions | Other |
|---|---|---|---|
| `0011_service_options.sql` (774 lines) | tables `shop_paper_sizes`, `shop_extra_charges`, `order_charges`; index, immutability trigger; `order_items` altered | `quote_order`, `_price_order_items`, `place_order` (3-arg), `approve_order_for_print` (line 647) | new `set_paper_sizes`, `set_extra_charges`, `shop_paper_capability` |
| `0012_print_eligibility.sql` (191) | `order_is_printable`, `cancel_unprintable_jobs`, trigger `orders_cancel_unprintable_jobs` | `agent_claim_next_job` (line 98), `agent_mark_printing` (line 156) | `print_jobs` status check changed |
| `0013_order_workflow.sql` (398) | `guard_paid_order_stop`, trigger `orders_refund_before_stop` | `place_order` twice (4-arg at line 44; 3-arg SQL wrapper at line 162), `set_order_payment` (175), `shop_paper_capability` (315) | `shop_paper_offer`; revokes `update(cash_payment_timing)` on `shops` |
| `0014_create_shop_confirmed_email.sql` (54) | none | `create_shop` (line 17) | none |

Eight base functions are redefined on purpose. Their first definitions are in `0001`, `0003`,
`0006`, `0008`, `0009` or `0010`.

## 4. Chain B objects (uncommitted, stage7 worktree)

| File | Creates | Depends on |
|---|---|---|
| `0011_licence_foundation.sql` (625) | tables `platform_admins`, `shop_licence_meta`, `licence_coverages`, `licence_audit_log`, `licence_requests`, `licence_denials`, `licence_denial_windows`; guard functions and triggers; `is_platform_admin`, `shop_licence_state`, `licence_lock_shop`; RLS on; revokes | `shops`, `auth.users` |
| `0012_licence_admin_rpcs.sql` (1084) | hash and canonical helpers; `licence_config`; grant, extend, revoke, replace RPCs; owner read `shop_licence_status` | `0011` objects, `shops` |
| `0013_licence_admin_read_rpcs.sql` (307) | `licence_admin_read_gate`, `admin_search_shops`, `admin_shop_licence`, `admin_shop_audit`; indexes on `shops` (`shops_slug_pattern_idx`, `shops_name_pattern_idx`) | `0011`/`0012` objects |

Base objects Chain B needs, all defined in `0001`–`0010`: `shops`, `shop_memberships`, `orders`,
`order_items`, `customer_files`, `print_jobs`, `print_agents`, `is_shop_owner`, `is_shop_member`.
Chain B has no rollback files. Its tests are untracked under `supabase/tests/licence_7c/`.

## 5. Collision and dependency checks

Scripted scan (`scratchpad/migration_scan.py`). It is heuristic, so it is evidence, not proof:

- Names defined by both chains: **none**.
- Chain B names that clash with the base: **none**.
- Chain A clashes with the base: the eight intended redefinitions in section 3.
- Chain B references to objects that only Chain A defines: **none** (checked by grep for
  `order_charges`, `shop_paper_sizes`, `shop_extra_charges`, `order_is_printable`,
  `set_order_payment`, `create_shop`, `shop_paper_capability`, `shop_paper_offer`,
  `guard_paid_order_stop`, `cancel_unprintable_jobs`, `quote_order`, `_price_order_items`,
  `place_order`, `approve_order_for_print`, `agent_claim_next_job`, `agent_mark_printing`).

Still unverified: a real apply. The sequence has not been run on a database, because decision 6
prohibits application until the plan is approved.

## 6. Renumbering options

- **Option A (recommended).** Keep Chain A as committed. Rename Chain B to `0015_licence_foundation`,
  `0016_licence_admin_rpcs`, `0017_licence_admin_read_rpcs`. Chain B is uncommitted, so no history
  changes. Effort: about 40 references to the three file names and about 16 files that mention
  `0011`–`0013` in docs, tests and `admin/`. These need updating.
- **Option B.** Keep Chain B as `0011`–`0013`. Move Chain A to `0014`–`0017`. This changes the
  unpushed commit `37e4623`, so it needs a new commit or a history rewrite. Not recommended.
- **Option C.** Keep both prefixes. Not acceptable: the migration tool keys on the version prefix, so
  two files with the same version cannot be tracked separately.

Precondition for A or B: the owner checks the hosted migration list and live signatures (items 25
and 26), read-only in the dashboard. If any hosted database has applied a `0011`+ file from either
chain, the renumbering changes which file a recorded version refers to. That case needs its own plan.

## 7. Verification plan, not yet run (needs your approval)

1. Create a clean throwaway PostgreSQL 16 database at `0001`–`0010`, and check the checksums.
2. Apply Chain A (`0011`–`0014`), then Chain B renamed (`0015`–`0017`). Dump the schema.
3. On a second clean database, apply in the reverse order. Compare the schema dumps. Identical
   dumps would show order independence.
4. Run Chain A's tests (`supabase/tests/*.sql`) and Chain B's tests (`supabase/tests/licence_7c/`)
   on the combined database.
5. Check the grants on `place_order`. The three-argument version is granted to `anon` and
   `authenticated` (`0003` lines 277–278), so the existing grant has to survive. This is item 25.
6. Hosted database: no action until you approve. The owner checks the migration list and live
   signatures read-only (items 25, 26).

## 8. 7F preparation: touchpoints and status (no enforcement built)

| 7F gate point | Current definition | Note |
|---|---|---|
| Approve | `approve_order_for_print`: base `0010` line 439; Chain A `0011` line 647 (current) | Change the Chain A body |
| Retry | `retry_print_job`: `0010` line 502 only | Base body |
| Claim | `agent_claim_next_job`: base `0010` line 630; Chain A `0012` line 98 (current) | Change the Chain A body |
| Mark printing | `agent_mark_printing`: base `0010` line 688; Chain A `0012` line 156 (current) | Change the Chain A body |
| Intake | `place_order`: not gated under decision A. Two signatures in Chain A (`0013` lines 44 and 162) | Item 25 |

Chain A `0012` also adds `cancel_unprintable_jobs` on `orders`. Its interaction with the 7F hold
rule needs review before any 7F design.

| 7F prerequisite | Status | Evidence |
|---|---|---|
| C-1, lawyer review of held-file release | External, not started | Decision 5: stays blocked |
| C-3, owner policy | Decision 4: hold enforcement back until M1 exists and the held-file release policy is approved | Owner decision, 2026-11-09 |
| M1 (7-day hold rule) | Proposal, not approved for implementation | Decision records |
| S-4, 180-second file-link window | Owner acceptance pending (item 35) | `supabase/functions/print-agent/index.ts` line 23 |
| S-5, agent journal on failed start | Local runtime evidence now exists; the record still says the test is required | Section 9 |
| Item 32, kill switch | No design exists. Owner decision needed on scope and on whether it stops new claims only (decision A allows jobs already printing to finish) | Decision records |
| Item 33, lock-order tests | Design approved; implementation and two-session tests not approved | Decision records |
| Item 25, live signatures | Read-only dashboard check by the owner | Decision records |

## 9. S-5 evidence (local, committed code only)

- The committed agent suite at `5c82d37` passes 61 of 61 (`npm test` in a scratch copy).
- The committed test "does not touch the printer when the server does not confirm the start"
  passes. It checks that when `markPrinting` throws, nothing reaches the printer, the journal is
  cleared, and nothing is queued for reporting.
- Mutation check, in a scratch copy only: removing the `return` after the failed start makes that test
  fail. The unmutated code passes. The scratch copy was restored and checked by SHA-256.
- Caveat: this covers committed code only. The main checkout has uncommitted changes to
  `agent/src/worker.mjs`, `agent/test/worker.test.mjs` and `agent/README.md`. They are not covered.
- The record (`STAGE7_DECISIONS.md` around line 950) still says runtime behaviour is UNVERIFIED. The
  owner should decide whether S-5 is closed.

## 10. Record inconsistency to correct (not edited: protected worktree)

`STAGE7_DECISIONS.md` line 1828 (§14.3, C-3 row) says "The 7F build needs only C-3 decided." Lines
931, 1543 and 1946 say the 7F build needs C-1 answered and C-3 decided (1946 is the §15.3 7F gate). Owner decision 3 (2026-11-09)
requires both. The §14.3 row is stale and should be corrected in an approved edit.
