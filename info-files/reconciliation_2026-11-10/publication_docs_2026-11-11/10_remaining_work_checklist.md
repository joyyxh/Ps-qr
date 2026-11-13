# Stage 7 remaining-work checklist (2026-11-10)

> Evidence labels: see section 0 of `01_reconciliation_report.md`.


**Status: planning list, not approval.** Each item states what it needs. Nothing here is started unless it says "done locally". Statuses come from the registers and logs as read today; none of them is a hosted or staging result.

Four milestones are kept apart:
- **Code complete**: the change is written and reviewed. It does not mean tested.
- **Local tested**: a test ran on this machine, on the current file hashes, with a saved log.
- **Staging validated**: the same tests run on a staging copy, under approval.
- **Production ready**: the owner's production checks are recorded and approved.

## 0. Position today

| Area | Code complete | Local tested (current files) | Staging validated | Production ready |
|---|---|---|---|---|
| 7B schema (0011) | Written, untracked, unapplied | No. No test result for the current file is logged | No | No |
| 7C RPCs (0012, 0013) and tests | Written, untracked, unapplied | No. Logs are for earlier versions (see §2) | No | No |
| 7D admin (`admin/`) | Written, untracked | Unit tests yes: 72/72 on 2026-11-10. Admin browser smoke: no log dated 2026-11-10 | No | No |
| 7E owner licence status | Written, uncommitted | Unit tests 212/212, targeted 60/60, owner browser smoke (mocked) 33/33 on 2026-11-10. Fixture capture: no saved log | No | No |
| 7F enforcement, kill switch, lock order | Not built. No enforcement code in any worktree (only comments) | No | No | No |
| Physical printer | Not started (Stage 6 simulated printer not merged, EX-14) | No | No | No |
| Staging | Not set up (EX-02) | n/a | No | n/a |
| Production | Nothing deployed or applied | n/a | n/a | No |

Repository: `main` 717717b and `stage7-payments` 5c82d37 on GitHub, matching §0 of `06`. No commits, pushes, branches or PRs for Stage 7 exist.

## 1. Local work that can proceed without new approval

These are read-only or documentation-only, or run only against the local stack and mocks.

- [x] Correct the STAGE7C operations document, admin README and 7E fixture statement (done locally; P2–P4 regenerated).
- [x] Regenerate P1–P4 and verify P1 against its recorded hash (done locally; `patches_v2_2026-11-10/MANIFEST.md`).
- [x] Dependency matrix M1–M7 (done locally; logs in `logs_2026-11-10/matrix/`).
- [ ] Admin browser smoke run on the worktree, with a saved log (no database; stubs). Local only.
- [ ] Re-run admin and web `npm test` on the regenerated patched tree (already done as M6 on 2026-11-10; re-run if any file changes).

## 2. 7B/7C database layer

Each item below needs approval where the "Approval" column says so.

| # | Item | Needs | Done when |
|---|---|---|---|
| 2.1 | Decide migration numbering (D-MIG): keep 0011–0013 and resolve the collision with Chain A, or take Option B (licence 0015–0017, 7F 0018) | Owner (D-MIG) | Decision recorded in `STAGE7_DECISIONS.md`. File names fixed |
| 2.2 | Start a local PostgreSQL 16 cluster and re-run `reset_local.sh`, `hash_vectors.py`, `rpc_tests.py`, `read_api_tests.py` on the current files, with saved logs and file hashes | EX-01 (local database run) | Logs with 0 FAIL, dated, on current hashes. Hash logs recorded for each file |
| 2.3 | Explain the 2026-11-07 FAILs: G-02 (got `overlap`), `test_grant_success` (Python `None` passed as a UUID, probable test defect), `test_global_cap_provisional` (CHECK `licence_denial_windows_detail_count_range` violated) | Local run (2.2) | Root cause written down. Any code change to 0012 needs its own approval; a test-only fix still needs the owner to accept it |
| 2.4 | AR-04 (read RPCs must be VOLATILE): failed once on 2026-11-08 (`read_run1.log`), passed twice | Local run (2.2) | Cause recorded (flaky check or harness) |
| 2.5 | Correct the stale header comments: 0011 says "NOT TESTED"; 0012 says "Tested only on a throwaway local PostgreSQL 16 cluster" with no date | Approval for a migration-file comment edit (`STAGE7_DECISIONS.md` ~line 734) | Proposed text in §5 below. Owner approves, then edit |
| 2.6 | Owner decisions on the emergency-disable, break-glass and admin-recovery procedures (STAGE7C operations §4, marked DRAFT) (O6, O7) | Owner | Approved text, or amended text, recorded. Required before 7C sign-off |
| 2.7 | Hosted AAL2 verification (7C) | EX-02 and hosted approval | Hosted result recorded |
| 2.8 | Global detail ceiling (G) and production backdate window (decision 5) | Owner | Values set in `licence_config` by approved step. Production currently refuses every backdate (fail-closed) |
| 2.9 | Supabase default grants on the new functions (R17) | Hosted check (staging) | Grants listed and matched to the intended set |
| 2.10 | Hosted migration history compared with local (RB-03) | Production owner | Recorded |
| 2.11 | `session_replication_role = replica` bypasses the 0011 triggers (`STAGE7C` operations, "not tested here") | Owner runbook | Runbook forbids it, or the owner accepts the risk |
| 2.12 | Staging copy: apply 0011–0013 to a staging copy (not the live project); run S1–S9 | EX-02, staging approval, D-MIG first | S-series results recorded with dates |

## 3. 7D admin dashboard and hosting

| # | Item | Needs | Done when |
|---|---|---|---|
| 3.1 | Hosting decision (RB-02; item 6) | Owner | Host chosen. Deployment still needs its own approval |
| 3.2 | Admin identity and MFA (RB-01; item 5): admin UUID, AAL2 enforcement | Production owner | Decision recorded. Hosted AAL2 verification not done (see 2.7; no hosted result in this set) |
| 3.3 | `admin/config.js` ships with empty values. At deployment, only the publishable key may be set, never a secret key | Owner, at deploy time | Configuration reviewed. Secret scan repeated on the deployed config |
| 3.4 | Admin browser smoke with saved log (see §1) | Local only | Log dated and kept |
| 3.5 | Deployment of the admin panel | Approval for the exact deployment, plus RB-01 and RB-02 | Deployed to the chosen host. Not done |

## 4. 7E owner licence status

| # | Item | Needs | Done when |
|---|---|---|---|
| 4.1 | Publication order: 7E calls `shop_licence_status`, which exists only in 0012. Publish 7E on a branch based on the 0012 line, or accept a runtime error on `main` | EX-15 (owner) | Order recorded |
| 4.2 | Fixture capture (`web/tests/fixtures/licence-status-rpc.json`): no saved log of the 2026-11-08 capture | EX-01 for a re-capture with a log, or owner acceptance of the statement | Log produced, or the owner accepts the statement in writing |
| 4.3 | Owner browser smoke (`web/tests/browser/owner-smoke.cjs`): 31 PASS, 3 FAIL, then TimeoutError at the 5c82d37 baseline (3 failures named in the baseline file). These are pre-existing, not from 7E | Owner decision: fix or record as known before any publication | Fixed, or recorded as known |
| 4.4 | Integration against the hosted or staging `shop_licence_status` | EX-02 and hosted approval | Result recorded |
| 4.5 | Labels (§13B P1–P9): approved 2026-11-09 | Done | — |
| 4.6 | The "printing permitted" line is removed until 7F enforcement exists (owner decision, 2026-11-09) | 7F | Line restored only after enforcement is tested |

## 5. Proposed header text (requires approval; NOT applied)

**0011 header, line 3** (current: `-- Status: NOT APPLIED. NOT EXECUTED. NOT TESTED.`) proposed replacement:

    -- Status: NOT APPLIED. NOT RUN ON ANY SUPABASE PROJECT. reset.log (2026-11-07) records that the local
    -- reset loaded this file without error on a throwaway PostgreSQL 16 cluster. No test result for this
    -- file is logged; see docs/STAGE7C_OPERATIONS.md (Local testing).

**0012 header, lines 3–5** (current: "Tested only on a throwaway local PostgreSQL 16 cluster… NOT done (see the 7C implementation report).") proposed replacement:

    -- Status: implementation written 2026-11-07; last edited 2026-11-08 09:48. Local PostgreSQL 16 test runs
    -- (supabase/tests/licence_7c) are logged for earlier file versions and for the read checks of 2026-11-08
    -- (docs/STAGE7C_OPERATIONS.md, Local testing). They do not cover the test files as they stand on 2026-11-10.
    -- Hosted AAL2 verification and staging concurrency checks are NOT done.

Neither change has been applied. Each needs the owner's approval for a migration-file edit.

## 6. 7F enforcement, kill switch, lock order and refusal handling

| # | Item | Needs | Done when |
|---|---|---|---|
| 6.1 | C-1 legal answers (L1–L8) | Lawyer | Written answers recorded |
| 6.2 | C-3 confirmed (hold back): §13C says decided, §13B says needs confirming | Owner (CF-1) | Confirmed in writing |
| 6.3 | Print gates in claim and mark: each calls `licence_lock_shop(shop, 'shared')` first | Build (7F) after 2.1 and approval | Code written and tested locally, then staging |
| 6.4 | Refusal handling for the print agent: the `order_not_printable` mapping (EX-06, D-Q4) | Owner approval for D-Q4 and an isolated branch from `37e4623` | Branch created only on approval; tests run |
| 6.5 | Kill switch (item 32): design is a draft; the fail-safe tension is recorded | RB-11 (owner approval) | Approved design, then code and tests |
| 6.6 | Lock-order implementation (item 33) and two-session staging tests | RB-12 (owner approval), EX-02 | Code tested locally; two-session results recorded on staging |
| 6.7 | Items 23 and 24 (implementation gate) | RB-08 | Closed or deferred by owner |
| 6.8 | S-4 file-link window (accepted or reduced) and S-5 `markPrinting` failure test | RB-09, RB-10 (local-test approval for S-5) | Recorded |
| 6.9 | Q4 wording: whether reversing the claim increment after a failed release meets "without incrementing `claim_count`" | CF-2 (owner) | Confirmed |
| 6.10 | 7F migration number (0018 under Option B) | D-MIG | Fixed |

## 7. Physical printer validation (separate milestone)

- [ ] Stage 6 simulated printer (`885d28b`) merged or not: owner decision (EX-14). Not on `origin/main`.
- [ ] Agent changes in the protected checkout (size-based paper refusal; picture refusal on non-A4; 62 insertions and 4 deletions in `agent/*`): owner decision, not run here (W7).
- [ ] Hardware test plan approved by the owner: named printer, driver, paper size, test sheet, expected results for each refusal case.
- [ ] Automated tests never print to a real printer and never call CUPS, PowerShell or SumatraPDF. Hardware checks are manual and recorded separately.
- [ ] Results recorded with date, printer model and driver version. Not done.

## 8. Staging and production

| # | Item | Needs | Done when |
|---|---|---|---|
| 8.1 | Create or approve a staging project (EX-02) | Owner approval | Project exists and is named as staging only |
| 8.2 | Staging validation: 0011–0013 (after D-MIG), S1–S9, two-session tests | 2.12, 6.6 | Results recorded |
| 8.3 | Production-owner checks: items 5, 6, 25, 26, 27, 31, 34 (none made) | Production owner | Each recorded |
| 8.4 | Cleanup workflow: `origin/main` schedules it (`cron: "30 20 * * *"`, secrets `QRQUICK_CLEANUP_URL` and `CLEANUP_SECRET`) while R-D says it stays disabled (RB-05) | Owner (R-D implementation) | One of the two is changed, by approval |
| 8.5 | Live Auth configuration (item 31); demo seed (item 34); live signatures and grants (item 25) | Production owner | Recorded |
| 8.6 | Retention periods (M8 proposal 90 days; S-6) | Lawyer and owner | Decided |
| 8.7 | Stage 7 planning approval (EX-13) and the pull request to `main` (PR A) | Owner | Given. Not given today |
| 8.8 | Commit of the governance text (CF-5) and the branch and PR sequence in `09` | Owner, one approval per commit | Each commit approved by name |

## 9. Owner and legal approvals still open

- **Owner decisions:** D-MIG (2.1); CF-1 (C-3 wording, 6.2); CF-2 (Q4 wording, 6.9); CF-3 (Part 1L items B, C, E; source instruction not in the files reviewed); CF-4 (item 19 conflict: §14.2 item 19 is Advisers; the shop licence view also uses item 19 and cites "owner decision 1, 2026-11-09"); CF-5 (commit of governance text); EX-01 (local database run); EX-02 (staging); EX-03 (Chain A combination); EX-13 (planning approval); EX-14 (Stage 6); EX-15 (7E order, §4.1); RB-01 and RB-02 (3.1, 3.2); D-Q4, D-Q5, D-Q5b, D-HS, D-I32, D-R18-T2 (approve or refuse each).
- **Lawyer:** C-1 written answers L1–L8; legal review of identity-derived hashes (L4); held-order customer wording (L5, D-Q5b); retention (6.1, 8.6).
- **Production owner:** hosted migration history (2.10); items 5, 6, 25, 26, 27, 31, 34 (8.3, 8.5).
- Each approval covers only the action it names. None of them approves a deployment, a migration application, hosted SQL, or a change to staging or production.

## 10. Shortest safe sequence (no approval given yet)

1. Owner decides D-MIG (2.1). Nothing downstream is committed until this is done.
2. Owner approves a local PostgreSQL re-run (EX-01). Re-run and record logs on the current files (2.2). Investigate the three 2026-11-07 FAILs and AR-04 (2.3, 2.4).
3. Owner approves the header-comment corrections (2.5) and the governance commit (CF-5), then commits P1 and then P2–P3 to `stage7-payments` (Steps 1–3 of `09`).
4. Owner decides EX-15, then 7E is committed on its own branch (Step 4 of `09`).
5. Owner approves staging (EX-02). Run S1–S9 and the two-session tests (8.2).
6. 7F (§6) is built and tested locally, then on staging, only after C-1, C-3, RB-11 and RB-12 are answered.
7. Physical printer validation (§7).
8. Production-owner checks (8.3) and EX-13, then PR A to `main`, then deployment, each under its own approval.

Stage 8 cannot begin until the register's criteria (a) to (e) are met (`04`, `07`).

## 11. Update 2026-11-11

Done since the 2026-11-10 pass (local only, nothing committed, pushed or published):
- P4 revised: `licence-smoke.cjs` takes its browser from `CHROMIUM_PATH` (unset: Playwright's own browser); the README and the 7E doc no longer carry sandbox paths; unlogged smoke counts are marked unverified.
- P2 and P4 regenerated as patch set v3 (`patches_v3_2026-11-11/`). P1 and P3 reproduce their hashes. 48 source files checked against the working copies (`SOURCE_HASHES.txt`). Manifest written (`MANIFEST.md`).
- Dependency matrix v3 rerun on the final P4: identical results to v2 (M6 admin 72/72, web 212/212). Licence browser smoke 33 of 33 on the final M6 tree.
- P1 sanitization prepared as a preview only (nine replacements, owner files unchanged). Its blocker is CF-5. The remote `stage7-payments` branch already contains one of the paths (see `11_proposed_changes_and_blockers.md`, B1).
- Blockers and decisions are listed in `11_proposed_changes_and_blockers.md`, sections C and D.

Still open: the gated items in sections 2 to 10 above, with their blockers in `11_proposed_changes_and_blockers.md`, sections C and D.
