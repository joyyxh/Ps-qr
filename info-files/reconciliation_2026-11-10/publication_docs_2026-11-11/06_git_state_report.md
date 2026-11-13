# Git state report (2026-11-10)

> Evidence labels: see section 0 of `01_reconciliation_report.md`.


Read-only. No `git` write, checkout, reset, clean, stash, commit, push or fetch was run. Remote values come from read-only REST calls.

## 1. Worktrees

| Path | Branch | HEAD | Upstream | Tracked changes | Untracked |
|---|---|---|---|---|---|
| `<PROTECTED_CHECKOUT>` (protected main checkout) | `main` | `37e4623` | `origin/main`: ahead 1, behind 4 | `agent/README.md`, `agent/src/worker.mjs`, `agent/test/worker.test.mjs` (62 insertions, 4 deletions) | none |
| `<PROTECTED_CHECKOUT>-auth-otp` | `auth-owner-otp` | `8e29762` | none configured | none | none |
| `<PROTECTED_CHECKOUT>-stage5` | `stage5-polling` | `034ab17` | `origin/stage5-polling` | none | none |
| `<PROTECTED_CHECKOUT>-stage6` | `stage6-simulated-printer` | `885d28b` | none configured (`origin/stage6-simulated-printer` exists) | none | none |
| `<WORKTREE_7>` | `stage7-payments` | `5c82d37` | none configured (remote has the same SHA) | `OWNER_DECISION_SHEET.md`, `STAGE7_DECISIONS.md` | `CLAUDE.md`, `admin/`, `docs/STAGE7C_OPERATIONS.md`, `supabase/migrations/0011_licence_foundation.sql`, `0012_licence_admin_rpcs.sql`, `0013_licence_admin_read_rpcs.sql`, `supabase/tests/licence_7c/` |
| `<WORKTREE_7E>` | `stage7e-owner-licence-status` | `5c82d37` (no commits of its own) | none configured | `web/package.json`, `web/src/owner-api.js`, `web/src/owner.js`, `web/styles.css`, `web/tests/browser/README.md`, `web/tests/owner-api.test.js` | `docs/STAGE7E_LICENCE_STATUS.md`, `web/src/licence-status.js`, `web/src/owner-licence.js`, `web/tests/browser/licence-smoke.cjs`, `web/tests/fixtures/`, `web/tests/licence-status.test.js` |

File counts (`git status --porcelain --untracked-files=all`, 2026-11-10): stage7-payments worktree has 2 modified and 35 untracked files (CLAUDE.md 1; admin/ 24; docs/STAGE7C_OPERATIONS.md 1; supabase/migrations 0011–0013, 3; supabase/tests/licence_7c/ 6). The 7E worktree has 6 modified and 6 untracked files.

## 2. Commits

- `main` `37e4623` ("Add owner email-code registration and password setup") is local only.
- `origin/main` `717717b` is the head on GitHub. Four origin-only commits: `8e29762`, `c3931c3` (PR #1), `034ab17`, `717717b` (PR #2).
- `stage7-payments` `5c82d37` matches the GitHub branch (REST check). Git has no local remote-tracking ref for it (`origin/stage7-payments` is absent), so the branch is not tracked. Eight commits ahead of `origin/main`.
- Ancestry: `8e29762` and `034ab17` are ancestors of `origin/main`. `885d28b` is not.

## 3. Stash

| Entry | SHA | Message |
|---|---|---|
| `stash@{0}` | `b559dce5c72ec1f7b1fd4403a40486d9b8cd793a` | On main: stage1 local duplicate of printing work (disk backup: local evidence folder stage1-backup) |

The stash is the only entry and is preserved. Not popped, applied or dropped.

## 4. GitHub

- `main`: `717717be923589665f733c28d3d77a538f02b4ae`
- `stage7-payments`: `5c82d37686880fa57237adb2d3d5848f4d162197`
- Compare `main...stage7-payments`: ahead 8, behind 0; files `OWNER_DECISION_SHEET.md`, `STAGE7_DECISIONS.md`
- Pull requests with head `stage7-payments` or `stage7e-owner-licence-status`: 0
- Other remote branches (GitHub branches API, 2026-11-11): `auth-owner-otp` 8e29762, `gh-pages` 9935e82, `stage5-polling` 034ab17, `stage6-simulated-printer` 885d28b. There is no `stage7e` branch on GitHub.
- Check runs on `main` 717717b: 21 scheduled `cleanup` runs since 2026-10-21, all failed; 15 of them on `717717b` (2026-10-27 to 2026-11-10; latest run 42902937080; see 13), 1 `publish` passing, 1 `Supabase Preview` failing. On `stage7-payments` 5c82d37: 1 `Supabase Preview` skipped. Commit status: no statuses on either head.

## 5. Preservation

- Protected main checkout: not modified. Its three uncommitted files are intact.
- Stash `b559dce`: not touched.
- Other worktrees: not modified. No branch created, deleted or moved.
- Uncommitted work in the stage7 and 7E worktrees: preserved. One exception, documented: the revert of migration renames (the renamed files were moved to a local folder outside the repository, not deleted; their content is preserved there).
- Files created or changed this session: listed in `02_repair_report.md` (R10 and R11). Working-copy edits in the stage7 and 7E worktrees are docs, test scripts and READMEs only. No migration SQL and no owner decision file was changed. Nothing was committed, staged or stashed.
- A temporary file I created at `<TMP>/chainA_fn.txt` during analysis was removed.
- The temporary HTTP server started for the browser smoke was stopped.

## 6. Notes

- `stage7-payments`, `stage7e-owner-licence-status` and `auth-owner-otp` have no upstream tracking configured.
- The decision records dated 2026-11-02 to 2026-11-10 exist only in the working copies. The committed text predates them.
