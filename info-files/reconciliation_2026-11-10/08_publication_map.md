# Publication map (2026-11-10)

> Evidence labels: see section 0 of `01_reconciliation_report.md`.


**Status: proposed.** Nothing has been committed, pushed, branched or opened as a pull request. Every row needs owner approval (see `09_commit_pr_sequence.md`).

**GitHub re-read in this pass (read-only REST).** `main` = `717717be923589665f733c28d3a77a538f02b4ae`. `stage7-payments` = `5c82d37686880fa57237adb2d3d5848f4d162197`. `stage7e-owner-licence-status` does not exist. Two pull requests exist in total, and none has either branch as its head. Compare `main...stage7-payments`: ahead 8, behind 0; files `OWNER_DECISION_SHEET.md` and `STAGE7_DECISIONS.md`.

## 1. GitHub versus local

| Item | GitHub | Local | Result |
|---|---|---|---|
| `main` | `717717b` | Protected checkout on `main` at `37e4623`: ahead 1, behind 4 (per `06_git_state_report.md`; not re-read in this pass) | Diverged. Chain A (0011–0014) exists only locally |
| `stage7-payments` | `5c82d37` (matches local) | Stage 7 worktree at `5c82d37`; 2 modified and 35 untracked files | Commits match. All Stage 7 work since then is uncommitted |
| `stage7e-owner-licence-status` | Not on GitHub | Worktree at `5c82d37`, no commits of its own; 6 modified and 6 untracked files | Local only |
| Migrations | `0001`–`0010` | `0001`–`0010`; licence `0011`–`0013` (untracked); Chain A `0011`–`0014` (local `main`) | Local only. Numbers 0011–0013 collide |
| Stage 7 governance text | `5c82d37`: decision sheet ends at Part 1J; register §16.2 reads "READY FOR FINAL OWNER REVIEW; NOT APPROVED" | Working copy adds §13A–§13F, Parts 1K–1N and a corrections note | Local text is newer and uncommitted |
| 7B–7E code and tests | None | Local | Local only |
| Pull requests | 2 in total; neither is for Stage 7 | None | No Stage 7 PR |
| Stash | not applicable | `stash@{0}` `b559dce5c72ec1f7b1fd4403a40486d9b8cd793a` only | Preserved, not touched |

## 2. Publication map

| # | Work | Source worktree | Intended branch | Files (patch) | Dependencies | Needs owner approval for |
|---|---|---|---|---|---|---|
| W1 | Stage 7 governance record: register §13A–§13F, sheet Parts 1K–1N, corrections note | `/home/claude/joyyxh/ps-qr-stage7` | `stage7-payments` (fast-forward from `5c82d37`) | `STAGE7_DECISIONS.md`, `OWNER_DECISION_SHEET.md` (P1, 2 files) | None in code. The text records CF-1 to CF-5 for owner confirmation | Commit (CF-5), and owner review of the text |
| W2 | 7B schema; 7C admin and read RPCs; behavioural tests; operations doc | same | `stage7-payments`, after W1 or independently | `supabase/migrations/0011_licence_foundation.sql`, `0012_licence_admin_rpcs.sql`, `0013_licence_admin_read_rpcs.sql`; `supabase/tests/licence_7c/` (6 files); `docs/STAGE7C_OPERATIONS.md` (P2, 10 files) | Base `0001`–`0010` on `origin/main`. The licence tables reference `public.shops` and `public.is_shop_owner` (both in 0001). Numbers collide with Chain A on local `main` (D-MIG). The current SQL is not shown to pass (EX-01) | D-MIG; commit; EX-01 for any local database run |
| W3 | 7D admin dashboard | same | `stage7-payments`, after W2 | `admin/` (24 files, P3) | W2. Admin tests read 0011–0013 by path. The code calls `licence_admin_*` (0012) and `admin_*` (0013). `admin/config.js` ships with empty values; hosting (RB-02) and admin identity and MFA (RB-01) govern any deployment | D-MIG; RB-02 before deployment; commit |
| W4 | 7E owner licence status screen | `/home/claude/joyyxh/ps-qr-stage7e` | `stage7e-owner-licence-status`: new branch, not on GitHub. Base chosen in `09` | 6 modified and 6 new files (P4, 12 files): `web/package.json`, `web/src/owner-api.js`, `web/src/owner.js`, `web/styles.css`, `web/tests/browser/README.md`, `web/tests/owner-api.test.js`; `web/src/licence-status.js`, `web/src/owner-licence.js`, `web/tests/browser/licence-smoke.cjs`, `web/tests/fixtures/licence-status-rpc.json`, `web/tests/licence-status.test.js`, `docs/STAGE7E_LICENCE_STATUS.md` | At runtime, `shop_licence_status` (defined only in `0012`). The other 16 RPC names referenced are on `origin/main`. Tests use a fixture; the fixture's stated capture (2026-11-08, local PostgreSQL 16.15) has no capture log in the scratchpad. No live database is involved | Sequencing (EX-15); commit; branch creation |
| W5 | `CLAUDE.md` draft (project working rules) | `ps-qr-stage7` | None yet | `CLAUDE.md` (untracked) | Owner review; its migration section (EX-07). Its own text says to commit only after owner approval | Owner approval. **Excluded from all sets** |
| W6 | Chain A: service options, print eligibility, order workflow, create_shop confirmation (local, unpushed) | Protected checkout `/home/claude/joyyxh/ps-qr` (`main` at `37e4623`) | `main` (not pushed) | `supabase/migrations/0011`–`0014` and the other committed files on `37e4623` | Collides with W2 numbering. Redefines eight base functions (03 §2). Not to be combined with Stage 7 without approval (G16) | EX-03. **Not part of any set** |
| W7 | Agent changes in the protected checkout (size-based paper refusal; picture refusal on non-A4) | Protected checkout | None | `agent/README.md`, `agent/src/worker.mjs`, `agent/test/worker.test.mjs` (62 insertions, 4 deletions) | Not Stage 7. Not run in this review | Owner decision. **Excluded** |
| W8 | Print-agent mapping for `order_not_printable` (EX-06) | None | Isolated branch from `37e4623` (proposal only) | `supabase/functions/print-agent/index.ts`, lines 79–96 | D-Q4 mechanism. The SQL tests on `main` expect the code; they were not run | Owner approval. **Not started** |
| W9 | Stage 6 `stage6-simulated-printer` (`885d28b`) | `/home/claude/joyyxh/ps-qr-stage6` | Existing `origin/stage6-simulated-printer` | None | Not an ancestor of `origin/main`; no PR (EX-14) | Owner merge-order decision. **Excluded** |
| W10 | Item 32 kill switch; item 33 lock-order code; 7F enforcement | None (scratchpad only) | None | Not in any repository | RB-11, RB-12, D-I32, C-1, C-3 | Not started; excluded |

## 3. Verification of the change sets

- The patches were made with `git diff` (tracked files) and `git diff --no-index /dev/null <file>` (new files). Nothing was staged, and the index was not changed.
- Each patch was applied in the order P1, P2, P3, P4 to a clean export of `5c82d37` (`git archive`, extracted outside any repository). All four `git apply --check` tests passed.
- Combined tests on that export: admin `npm test` 72/72; web `npm test` 212/212. Logs: `logs_2026-11-10/combined_admin_npm_test.log` and `logs_2026-11-10/combined_web_npm_test.log`.
- The four sets touch different files, so they do not conflict. Test dependencies still apply: the admin tests need P2 (they read the migration files by path); the web tests need only P4 and its fixture.
- The browser smoke was not run on the combined export. It was run on the worktree (33 of 33).
- Secret scan: no key values. The only matches in P3 are test strings: the bare prefix `sb_secret_` and `sb_secret_0000` placeholders in `admin/tests/guards.test.js`, `admin/tests/security.test.js` and `admin/README.md`.
- Dependency matrix, re-run 2026-11-10 on the regenerated patches (`patches_v2_2026-11-10/MANIFEST.md` §5): P3 without P2 fails four of seven admin test files (ENOENT on the migration paths; 23 of 27 tests pass); P2 with P3 passes admin 72/72; P4 alone passes web 212/212; the full set P1–P4 passes admin 72/72 and web 212/212. Logs: `logs_2026-11-10/matrix/`.
- Regenerated 2026-11-11 (`patches_v3_2026-11-11/`): P2 and P4 changed (sandbox and socket paths removed, unlogged counts marked); P1 and P3 reproduce their earlier hashes. The table below is v3. The v2 set (2026-11-10, 16:34) is superseded and kept as evidence. v3 manifest and matrix: `patches_v3_2026-11-11/MANIFEST.md`.
- Not verified: the SQL on the current files (EX-01).

| Set | Work | Files | Diff lines | sha256 (first 16 hex) |
|---|---|---|---|---|
| P1 | Stage 7 governance | 2 | 1196 | `4cbe513617a3c887` |
| P2 | 7B/7C database layer | 10 | 5296 | `8be19fa7a2e1c4c7` |
| P3 | 7D admin | 24 | 3582 | `cc56fd707ad09a7b` |
| P4 | 7E web | 12 | 1787 | `e0762d45f011a259` |

Patch files (current, v3, 2026-11-11): `patches_v3_2026-11-11/P1_stage7_governance.patch`, `patches_v3_2026-11-11/P2_7B_7C_database.patch`, `patches_v3_2026-11-11/P3_7D_admin.patch`, `patches_v3_2026-11-11/P4_7E_web.patch`, with `patches_v3_2026-11-11/MANIFEST.md` (in `/tmp/claude-0/-home-claude/0c86edef-9199-55e4-a183-f9fd34ea0c1b/scratchpad/reconciliation_2026-11-10/`). The earlier set is in `patches/`.

## 4. Excluded from every set

- `CLAUDE.md`: awaiting owner review.
- Any file in the protected checkout (`agent/*`, and the Chain A commits on local `main`).
- Stash `b559dce`: preserved and untouched.
- `__pycache__` directories and `node_modules` (both git-ignored; not in any patch).
- Scratchpad material (this folder and the Stage 7F preparation files). These are not repository content.

## 5. Changes ready for owner review (none approved)

- P1: documentation. Review the §13F text and the CF-1 to CF-5 confirmations first.
- P2: unapplied SQL migrations and their tests. Not tested against the current files. Numbering open (D-MIG).
- P3: admin dashboard code. Deployment is blocked (RB-01, RB-02). Its tests need P2.
- P4: owner screen code and a fixture. It calls a database function that is not yet published (EX-15).

## 6. Decisions the publication depends on

- D-MIG (migration numbers): decide before P2 is committed, because a later renumber would change P2's file names and P3's test paths.
- CF-5 (commit of the local governance text): needed for P1.
- EX-15 (order of 7E against 7B/7C): needed for P4.
- RB-02 (hosting): decides whether `admin/config.js` (empty) belongs in P3. Recommended: include it, because the code expects the file, and deployment stays blocked.
- EX-01 (local database run): needed before anyone can say P2 and P3 work against the current SQL.
- EX-13 (Stage 7 planning approval): needed before any pull request to `main`.
