# Publication manifest, regenerated 2026-11-10 16:34

**Status: proposed evidence only.** Nothing has been committed, pushed, branched, merged, or opened as a pull request. Each set needs the approval named in `../09_commit_pr_sequence.md`. These patches do not approve migration numbers (D-MIG), governance commits (CF-5), 7E ordering (EX-15), or any local database run (EX-01).

## 1. Current patch set

| Set | File | Files | Diff lines | sha256 |
|---|---|---|---|---|
| P1 | `P1_stage7_governance.patch` | 2 | 1196 | `4cbe513617a3c88711a9dbf1287af150ebb94289dfea0c4cea1753559eba46d9` |
| P2 | `P2_7B_7C_database.patch` | 10 | 5287 | `767ccd38997d142bb279327b747e074ef6db53d9a4bd40907688b5d628d3ed23` |
| P3 | `P3_7D_admin.patch` | 24 | 3582 | `cc56fd707ad09a7bbb09c44bd9bae8695b8c5ab21be74ce2ea6ee25d00942a43` |
| P4 | `P4_7E_web.patch` | 12 | 1755 | `6ba3d0f0def0349e5ce2f5e2fe83ae72cd007b5542ea722c64c81f86589f3cd0` |

Base for every test: `git archive 5c82d37`, saved as `../patch_check/matrix/base_5c82d37.tar`, sha256 `0e79bc8f6d23e1b668aef5becf01d40a9b2a4b1c9334ab6c899ecbeb0035f6f9`.

## 2. What changed since the earlier set

The earlier set in `../patches/` (made 2026-11-10 11:54) is kept as evidence and is superseded for P2, P3 and P4. P1 is unchanged and reproduces the recorded hash `4cbe513617a3c887` exactly.

| Set | Change | Working copy edited |
|---|---|---|
| P2 | `docs/STAGE7C_OPERATIONS.md`: test-results row (line 14), backdate sentence (line 125), two lines in the open-items list (lines 175–176). Line count unchanged; no migration or SQL file changed | `ps-qr-stage7` |
| P3 | `admin/README.md` line 103–104: read-RPC test sentence now dated | `ps-qr-stage7` |
| P4 | `docs/STAGE7E_LICENCE_STATUS.md`: fixture-capture sentence (line 74) and database-shape row (line 129) | `ps-qr-stage7e` |

No migration file (0011, 0012, 0013), no SQL test, no code file and no test file changed in this pass. The 0011 and 0012 header comments still contain claims that approval is needed to change (see the remaining-work checklist).

## 3. File lists

**P1 (2, modified, tracked):** `OWNER_DECISION_SHEET.md`, `STAGE7_DECISIONS.md`

**P2 (10):** `supabase/migrations/0011_licence_foundation.sql` (new), `supabase/migrations/0012_licence_admin_rpcs.sql` (new), `supabase/migrations/0013_licence_admin_read_rpcs.sql` (new), `docs/STAGE7C_OPERATIONS.md` (new), `supabase/tests/licence_7c/00_local_shims.sql`, `hash_vectors.json`, `hash_vectors.py`, `read_api_tests.py`, `reset_local.sh`, `rpc_tests.py` (all new)

**P3 (24, all new):** `admin/README.md`, `admin/config.js`, `admin/index.html`, `admin/package.json`, `admin/robots.txt`, `admin/styles.css`; `admin/src/` `app.js`, `auth.js`, `config-guard.js`, `http.js`, `licence-api.js`, `messages.js`, `qr.js`, `read-api.js`, `read-model.js`, `validate.js`; `admin/tests/` `auth.test.js`, `browser-smoke.cjs`, `guards.test.js`, `licence-api.test.js`, `read-api.test.js`, `read-model.test.js`, `security.test.js`, `validate.test.js`

**P4 (12):** modified: `web/package.json`, `web/src/owner-api.js`, `web/src/owner.js`, `web/styles.css`, `web/tests/browser/README.md`, `web/tests/owner-api.test.js`. New: `web/src/licence-status.js`, `web/src/owner-licence.js`, `web/tests/browser/licence-smoke.cjs`, `web/tests/fixtures/licence-status-rpc.json`, `web/tests/licence-status.test.js`, `docs/STAGE7E_LICENCE_STATUS.md`

## 4. How the patches were made

Script: `../make_patches.sh <output-dir>`. For tracked files it runs `git diff -- <file>`. For new files it runs `git diff --no-index /dev/null <file>` from the worktree root. It adds, stages, commits and checks out nothing. `git diff --no-index` exits with 1 when it finds differences, so the script's exit status is not an error signal. The P1 reproduction above is the check that the method is unchanged.

## 5. Dependency matrix (run 2026-11-10 on the regenerated patches)

Commands, run in each extracted directory:

    tar -x -C <dir> -f base_5c82d37.tar
    git apply --check <patch> && git apply <patch>        (in patch order P1, P2, P3, P4)
    (cd <dir>/admin && npm test)
    (cd <dir>/web && npm test)

Node v22.22.0, npm 10.9.4. Logs: `../logs_2026-11-10/matrix/`.

| Case | Patches | Expected | Observed | Log |
|---|---|---|---|---|
| M1 | P3 only | Admin fails: tests read migrations by path | Admin: 27 run, 23 pass, 4 fail. Four test files (`guards`, `licence-api`, `read-api`, `read-model`) fail to load with ENOENT on `supabase/migrations/0011`–`0013`. Web: 163/163 (base suite, unaffected) | `M1_P3_only.admin.log`, `.web.log` |
| M2 | P4 only | Web 212/212 | Web 212/212 (base 163 + 49 new). No admin directory | `M2_P4_only.web.log` |
| M3 | P2 + P3 | Admin 72/72 | Admin 72/72; web 163/163 (no P4) | `M3_P2_P3.*.log` |
| M4 | P2 + P4 | Web 212/212 | Web 212/212; no admin directory | `M4_P2_P4.web.log` |
| M5 | P3 + P4 | Admin fails as in M1; web 212/212 | Admin 27 run, 23 pass, 4 fail (same four files); web 212/212 | `M5_P3_P4.*.log` |
| M6 | P1 + P2 + P3 + P4 | Admin 72/72; web 212/212 | Admin 72/72; web 212/212. All four `git apply --check` pass in order | `M6_P1_P2_P3_P4.*.log` |
| M7 | P2 only | Applies cleanly. No npm test covers it | `git apply --check` passes. Not run: the SQL, hash and read-API suites need a local PostgreSQL (EX-01) | none |

Conclusion: the admin suite depends on P2 (the migration files); the web suite depends only on P4. P1 does not affect either suite.

## 6. Not run in this manifest

- Browser smoke on any extracted tree (admin `browser-smoke.cjs`; web `licence-smoke.cjs`). The web smoke was run on the worktree on 2026-11-10 (33/33, `logs_2026-11-10/licence_smoke.log`). The admin browser smoke has no 2026-11-10 log.
- Every SQL, hash and read-API test: they need a local PostgreSQL cluster (EX-01), not started.
- Agent tests in the protected checkout (uncommitted; not part of any set).
