# 11. Proposed changes, blockers and decisions (2026-11-11)

> Evidence labels: see section 0 of `01_reconciliation_report.md`.


**State at the end of this pass.** Nothing is committed, pushed, branched, opened as a pull request, merged, deployed, or applied to any database. GitHub has not changed since the start of the session (06, section 4; re-checked in the final report). Each unit below is prepared locally and is waiting for the approval named against it.

## A. Publication units (patch set v3, `patches_v3_2026-11-11/`)

| Unit | Content | SHA-256 (first 16 hex) | Blocked by | What unblocks it | Prepared now |
|---|---|---|---|---|---|
| P1 governance | `STAGE7_DECISIONS.md`, `OWNER_DECISION_SHEET.md` (uncommitted edits) | `4cbe513617a3c887` | CF-5 (commit §13A–§13F and decision-sheet Parts 1K–1N). Also the sanitization in B1 | Owner approval of CF-5 for this text. A new P1 patch is then regenerated and re-hashed | Nine exact text replacements, applied to a preview copy only: `p1_sanitized_preview/STAGE7_DECISIONS.md`. The preview has no local, sandbox or personal path. The owner's files are unchanged |
| P2 7B/7C database | 10 files: migrations 0011–0013, `docs/STAGE7C_OPERATIONS.md`, `supabase/tests/licence_7c/*` | `8be19fa7a2e1c4c7` | D-MIG (owner decision 2: migration numbers and apply order). Also owner approval to correct the stale header comments in 0011 and 0012 | Owner decides D-MIG. Owner approves the comment text in 10, section 5 | Socket paths removed (environment guard `STAGE7C_SOCK`). Migration SQL not changed. Nothing renumbered, nothing run |
| P3 7D admin | 24 untracked files under `admin/`, including `config.js` (empty) | `cc56fd707ad09a7b` | P2 must land first (the tests read 0011–0013 by path; matrix M1 shows 4 of 7 files fail without them). D-MIG. RB-02 (where the admin runs; `config.js` must stay empty in the repository) | Owner decides D-MIG and RB-02 | Nothing new. Code unchanged. Config guard checked (`isServiceKey`, `isUsableConfig`) |
| P4 7E web | 12 files under `web/` and `docs/STAGE7E_LICENCE_STATUS.md` | `e0762d45f011a259` | EX-15 (publication order: 7E calls `shop_licence_status`, which exists only in 0012). Recommended: publish P2 first and stack P4 on it | Owner approves EX-15 | Sandbox paths removed from `licence-smoke.cjs` (`CHROMIUM_PATH`, `PLAYWRIGHT_MODULE`). README and doc wording corrected. Unlogged smoke counts marked unverified. Smoke 33 of 33 on the final tree |
| Documentation unit | Reports 01–11, `MANIFEST.md`, `SOURCE_HASHES.txt`, sanitized logs and scripts (no patches) | not a patch | No register gate. Needs an explicit approval for this exact branch and push | Owner approves the branch: `stage7-reconciliation-2026-11-10` from origin/main `717717b`, no pull request, no change to `main`, `stage7-payments` or the protected checkout | Built in `publication_docs_2026-11-11/` and checked for local paths, sandbox paths, the owner's address and hosted project references |

## B. Blockers found in this pass (not in the earlier register)

1. **A local path is already on the remote `stage7-payments` branch.** `STAGE7_DECISIONS.md` at `5c82d37` (the GitHub head) has the line `**Worktree:** \`<WORKTREE_7>\`…`. The fix is a new commit on `stage7-payments`, which is a decision-record change. It needs the same CF-5 approval as P1. The owner should decide whether to fix it in a new commit or accept it.
2. **The four base smoke scripts still use sandbox paths.** `owner-smoke.cjs`, `stats-smoke.cjs`, `features-smoke.cjs` and `qr-smoke.cjs` are part of `5c82d37`, not of P4. They launch Chromium from a fixed sandbox path and some read `<HOME>/...` folders. Fixing them is a separate unit on `stage7-payments`. It needs approval.
3. **Unlogged browser counts in the earlier docs.** The 7E README and doc gave counts for `features-smoke` (24 of 24), `stats-smoke` (26 of 26) and `qr-smoke` (16 of 16), and a claim of identical baseline outcomes. None has a saved log. P4 now marks them unverified. To verify them, the owner must allow a local run of those scripts (no hosted service needed).
4. **Hosted checks failing on `main` (already in the register).** The cleanup workflow has failed on all 21 scheduled runs since 2026-10-21 (15 of them on commit `717717b`). In the run logs, `QRQUICK_CLEANUP_URL` and `CLEANUP_SECRET` are both empty, so the workflow's guard exits before any request is sent (RB-05; see 13). The Supabase Preview check reports "Remote migration versions not found in local migrations directory" (RB-03). Hosted tools were not used.
5. **No CI runs the admin or web tests on GitHub.** The `publish` check passes; nothing runs `npm test` in `admin/` or `web/` on a push or pull request.

## C. Defects still open (none needs a decision to inspect; none is fixed here unless noted)

- `rpc_tests` log (2026-11-07, which predates 0012 and 0013): G-02 got `overlap`; `test_grant_success` passes Python `None` as a UUID (a test defect, probably); `test_global_cap_provisional` violates the CHECK `licence_denial_windows_detail_count_range`. Cause not established. No SQL has been run since (EX-01 is needed).
- AR-04 (the read RPCs must be `VOLATILE`): failed once on 2026-11-08 and passed twice. Cause unknown.
- `session_replication_role = replica` bypasses the 0011 triggers. Untested. The owner runbook must forbid it.
- Migration header comments are stale: 0011 says "NOT TESTED"; 0012 says "Tested only on a throwaway local PostgreSQL 16 cluster". Corrected text is proposed in 10, section 5. Needs approval (migration file edit).
- Owner smoke at baseline `5c82d37`: 31 pass, 3 fail, TimeoutError at check 34 (logged 2026-11-08; pre-existing; not caused by 7E).
- 7E fixture capture: no saved log. The statement that it was captured on 2026-11-08 is not backed by a log and is marked so in the doc.
- Admin browser smoke: no log in this set.
- 7F enforcement: not implemented. Item 32 kill switch: design draft only; D-I32 pending.

## D. Decisions needed from the owner (in order of dependency)

1. **D-MIG** (decision 2): migration numbering and apply order. Blocks P2 and P3. Current files stay 0011–0013; the proposed renumbering to 0015–0017 is not approved.
2. **CF-5**: commit §13A–§13F and decision-sheet Parts 1K–1N. Blocks P1, and the fix in B1.
3. **EX-15**: publication order for 7E. Blocks P4. Recommended: publish P2 first.
4. **RB-02**: where the admin panel runs (separate private deployment is recommended). Blocks P3 and any admin deployment.
5. **RB-03**: the owner's read-only list of migrations applied to the hosted project. Needed before any hosted migration decision and to explain the Supabase Preview failure.
6. **RB-05**: whether the cleanup workflow is meant to run. If yes, set the two secrets; if no, disable the schedule. Either is a workflow change that needs approval.
7. **EX-01 and EX-02**: a local PostgreSQL run and a staging database, for current (not 2026-11-07 or 2026-11-08) behavioural evidence of 0011–0013. Without these, the SQL evidence stays as logged in 05.
8. **Documentation branch**: approval for the exact branch, base and push in section A.

## E. External blockers (not for this pass)

- C-1: lawyer review of the licence and printing terms. Needed before 7F.
- C-3: owner policy for held files. Recorded as decided (hold back); the owner's written confirmation is open (CF-1).
- Staging: no staging database exists (EX-02).
- Production: nothing has been applied or deployed.
- Physical printing: not tested. The simulated printer and any API success do not prove a physical print.

## F. Shortest safe path to closure of 7B, 7C, 7D and 7E

1. Owner decides D-MIG and CF-5, and approves the documentation branch (section D, items 1, 2 and 8).
2. Local behavioural run of 0011–0013 on a throwaway PostgreSQL 16 cluster (EX-01), with fresh logs. Fixes the RPC-test defects in C only if they are proved to be test defects.
3. Publish P2 (with the sanitized P1) as a draft pull request on `stage7-payments`, then P3 and P4 stacked on it (EX-15).
4. Staging run (EX-02) of the owner-screen integration test: an owner sees their shop's status; staff and another owner are refused; an expired session is refused.
5. Stage 7 closure in §16 also needs 7F, which is held back: C-1, C-3, D-I32, D-Q4, D-Q5 and the enforcement gates. 7F is not on this path and must not be marked complete.
