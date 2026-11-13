# Test evidence report (2026-11-10)

> Evidence labels: see section 0 of `01_reconciliation_report.md`.


**Rule.** Only targeted tests were run. No new code was written, so each result covers the code as it stood today. Commands are exact. Nothing was run against a database, staging or the hosted project.

## 1. Runs made today

| # | Command (working directory) | Result | Notes |
|---|---|---|---|
| T1 | `npm test 2>&1 \| grep -E "^# (tests\|pass\|fail)"` (`<WORKTREE_7>/admin`) | `# tests 72`, `# pass 72`, `# fail 0` | Run after the migration revert. Admin test files were restored from the snapshot first |
| T2 | `npm test 2>&1 \| grep -E "^# (tests\|suites\|pass\|fail\|cancelled\|todo)"`; exit 0 (`<WORKTREE_7E>/web`) | `# tests 212`, `# pass 212`, `# fail 0`, `# cancelled 0`, `# todo 0` | Full web suite, including `tests/licence-status.test.js` |
| T3 | `node --test tests/licence-status.test.js tests/owner-api.test.js` (`<WORKTREE_7E>/web`) | `# tests 60`, `# pass 60`, `# fail 0` | Matches the reported "60/60 targeted" for these files. The reported figure does not say which files it covered |
| T4 | Temporary server: `python3 -m http.server 5174 --bind 127.0.0.1` from `<WORKTREE_7E>/web`; then `node tests/browser/licence-smoke.cjs` (exit 0) | "33 of 33 checks passed." | Output: `logs_2026-11-10/licence_smoke.log` (re-run in the later pass: 33 of 33). The script has no file writes. The first attempt to stop the server missed its PID; it was then stopped and confirmed gone (`pgrep` returned nothing) |
| T5 | `python3 -I` with `ast.parse` on `rpc_tests.py`, `read_api_tests.py`, `hash_vectors.py` (`supabase/tests/licence_7c`) | "python parse ok: 3 files" | Syntax only. Nothing executed |
| T6 | `bash -n reset_local.sh` | OK | Syntax only. Not executed |
| T7 | Working copy compared with the snapshot copy by `sha256sum`, for files present in the snapshot | Match for `0011`, `0012`, `0013`, `reset_local.sh`, `STAGE7C_OPERATIONS.md`, `read-api.js`, `licence-api.js`, `messages.js`. README and admin test files not checked by hash | Re-run in this pass |
| T8 | Residual-token search `\b001[5-8]\b` across `<WORKTREE_7>` (excluding `.git`, `node_modules`) | Hits only in governance text: register §13D, §13E and §13F, and the decision sheet's corrections note. None in SQL, tests, admin or web code | Re-checked in this pass |
| T9 | Function and table name overlap, licence vs Chain A vs `0001`–`0010` (grep and `comm`) | No shared names | See `03_migration_conflict_report.md` §2 |
| T10 | Diff of three test files against pre-revert copies | Five comment or docstring lines differ (2 in `00_local_shims.sql`, 2 in `rpc_tests.py`, 1 in `read_api_tests.py`) | Shows the revert changed comments only |
| T11 | Status-token comparison of all table rows, committed vs working, both governance files (read-only python) | See `01_reconciliation_report.md` §4 | Used to find silent approval changes; four owner confirmations listed |
| T12 | GitHub REST, read-only: `compare/main...stage7-payments`; `git/refs/heads/main`; `git/refs/heads/stage7-payments`; `pulls?state=all` | ahead 8, behind 0; main `717717b`; stage7-payments `5c82d37`; 0 PRs | Matches the brief |

## 1a. Re-runs in the later pass (2026-11-10, logs saved)

| Check | Log (in `logs_2026-11-10/`) | Result |
|---|---|---|
| Admin `npm test` | `admin_npm_test.log` | 72 pass, 0 fail |
| Web `npm test` | `web_npm_test.log` | 212 pass, 0 fail |
| Targeted `node --test tests/licence-status.test.js tests/owner-api.test.js` | `web_targeted_licence_owner_api.log` | 60 pass, 0 fail |
| Browser smoke `licence-smoke.cjs` (server on 127.0.0.1:5174, stopped after the run; port not listening at the check) | `licence_smoke.log` | 33 of 33 |
| Combined tree: base `5c82d37` export with the four change sets applied in order | `combined_admin_npm_test.log`, `combined_web_npm_test.log` | admin 72/72; web 212/212 |
| Python parse of `rpc_tests.py`, `read_api_tests.py`, `hash_vectors.py`; `bash -n reset_local.sh` | terminal output | OK |

## 2. Not run (and why)

| Test | Reason |
|---|---|
| Chain A SQL tests on local `main` (`supabase/tests/print_eligibility_tests.sql`, `order_workflow_tests.sql`, and others) | Need a database; none is running. Not run |
| Behavioural SQL tests for `0011`–`0013` on the current files (`rpc_tests.py`, `read_api_tests.py`, `hash_vectors.py`) | Not re-run in this pass. No local PostgreSQL cluster is running, and starting one needs local-setup approval (EX-01). Earlier logs exist (section 4) |
| `reset_local.sh` (executes `psql` against a local database) | As above |
| Staging tests S1–S9; item 33 two-session tests | Staging is not set up (EX-02); execution needs separate approval |
| Hosted queries of any kind | Not authorised. The brief forbids hosted SQL |
| Agent tests in the protected checkout (`agent/test/worker.test.mjs`, including the two new uncommitted tests) | Uncommitted work in the protected checkout. Not run to avoid touching it. Would need approval |
| S-5 runtime test of `markPrinting` failure | Needs local-test approval (RB-10) |
| Owner browser smoke (`web/tests/browser/owner-smoke.cjs`). A baseline run from 2026-11-08 is in `local evidence folder/baseline-owner-smoke.out` and ends with a TimeoutError. The figure "31 of 34" is supported by the baseline file: 31 PASS lines, 3 FAIL lines and a TimeoutError (checked 2026-11-10) | Not re-run on 2026-11-10. Known failures are in the baseline, not in this change |
| Edge function `print-agent` tests | None exist in the repository; the function was not executed |
| Android build | Not requested; not run |

## 3. Limitations

- All results are local and against mocked backends (browser smoke) or against in-memory test doubles (admin and web tests). They do not show behaviour against the real database, the hosted project or staging.
- The 7C SQL logs (section 4) show results for earlier file versions. They do not show that the current 0012, 0013 or test files pass.
- The 212 web tests include tests that existed before 7E. The 60 targeted tests do not cover the owner-api changes in full. This report does not claim more.

## 4. 7C SQL and read-API logs found in this pass (not re-run)

| Log (local evidence folder) | Written | Content | Relation to the current files |
|---|---|---|---|
| `reset.log` | 2026-11-07 04:33 | "reset ok: stage7c_local (shims, 0011, 0012)" | Loads 0011 and 0012 only; 0013 is not in this log. 0012 changed 2026-11-08 09:48 |
| `hash_vectors.log` | 2026-11-07 04:33 | 41 PASS, 0 FAIL | `hash_vectors.py` changed 2026-11-07 18:46, after this run |
| `rpc_tests.log` | 2026-11-07 04:34 | 134 PASS, 3 FAIL: G-02 (one-year grant overlap); `test_grant_success` (RuntimeError, uuid "None"); `test_global_cap_provisional` (CHECK constraint `licence_denial_windows_detail_count_range` violated) | Predates 0012 (09:48) and `rpc_tests.py` (changed 2026-11-10 06:34). The log gives the error for each FAIL; the root cause is not established. The uuid error suggests a Python `None` was passed where a UUID was expected (not confirmed) |
| `rpc_tests2.log` | 2026-11-07 04:35 | 145 PASS, 0 FAIL ("SUMMARY: 145 passed, 0 failed") | Same as above. It ran one minute after the run with three FAILs; the change between them is not recorded |
| `read_run1.log` | 2026-11-08 09:52 | 124 PASS, 1 FAIL: AR-04 (read RPCs VOLATILE); the failure line has no detail | Postdates 0013 (09:48). `read_api_tests.py` changed 2026-11-10 06:34 |
| `read_run2.log` | 2026-11-08 09:53 | 125 PASS, 0 FAIL | Same. AR-04 passed one minute after the failure; the cause is not recorded |
| `read-api-run.txt` | 2026-11-08 15:42 | 125 PASS, 0 FAIL | Same |
| `bw-targeted.txt` | 2026-11-08 15:41 | BW-01 to BW-06, targeted run of `rpc_tests.py`: 6 PASS, 0 FAIL. BW-07 to BW-14 pass in the three read-API logs above | Postdates 0012 (09:48). `rpc_tests.py` changed 2026-11-10 06:34 |

Two earlier attempts to start a database (`reset3.log`: connection refused; `pg7c-initdb.log`: permission denied) are from the earlier pass and were not re-read here.

**Result.** The most recent 7C SQL evidence is from 2026-11-08. It postdates the current 0012 and 0013 file times, but not the 2026-11-10 edits to the test files. No log shows the current files passing. The 2026-11-07 FAILs and the AR-04 failure have no established root cause.
