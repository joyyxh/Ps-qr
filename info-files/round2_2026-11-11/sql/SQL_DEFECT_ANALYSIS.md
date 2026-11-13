# 7B/7C SQL defect analysis (round 2, static only)

Scope: migrations 0011, 0012, 0013 and the tests in `supabase/tests/licence_7c/`, as they stand in
`/home/claude/joyyxh/ps-qr-stage7` on 2026-11-11. No SQL was run, no database was touched, and EX-01 is not approved.
Migration numbering (D-MIG) is unchanged.

Evidence sources: historical logs (`logs_historical_2026-11-07_08/`: rpc_tests.log, read_run1.log, read_run2.log,
read-api-run.txt) and the current source. Each defect below is classified on its evidence. A historical log describes
the test file that was present when it ran. Several of these defects have already been edited out of the current file.

## Summary

| Defect | Classification | Status after this round |
|---|---|---|
| (a) G-02 returned `overlap` | Test defect, already fixed in the current file (historical wording "on version 1" is gone) | Current G-02 uses a fresh shop and expected version 0, so `overlap` is not expected. Confirm with EX-01 run |
| (b) `test_grant_success` raised `invalid input syntax for type uuid: "None"` | Test-harness defect: `lit(None)` sent the text `'None'` | **Fixed** in `rpc_tests.py` (`lit` now emits SQL `NULL`). Covers `read_api_tests.py`, which imports `lit` |
| (c) `test_global_cap_provisional` violated `licence_denial_windows_detail_count_range` | Test setup defect, already fixed in the current file (`greatest(denial_count, 999)`). The migration denial path is correct as written | No change. Confirm with EX-01 run |
| (d) AR-04 failed once (`read_run1.log`), passed twice | Not a function defect: 0013 declares no volatility, so the default VOLATILE applies. The failing run's detail is empty, so the `pg_proc` query returned no rows, and run1 has no `ERROR` lines | **Message improved** in `read_api_tests.py` so an empty result is labelled as missing functions or a harness problem. Cause is undetermined from logs |

No migration change is proposed. `proposed_migration_fixes.diff` is empty by design.

## (a) G-02

- Historical FAIL: `G-02 one_year grant on version 1 | got={"ok": false, "code": "overlap"} before=(1, 1, 1, 1)`.
  That version of the test granted a one_year on the shop already holding the G-01 one_month grant. The overlap was the
  correct business answer (0012 step 9, `licence_admin_overlaps`), so the test expectation was wrong.
- Current `rpc_tests.py` (around line 207): `shop_y = new_shop()` then `payload(shop_y, 0, grant_kind="one_year")`.
  A new shop has no coverage and state_version 0 (`shop_licence_meta.state_version default 0`, 0011). The overlap test
  does not fire, and step 7 (`v_expected <> v_ver`) passes.
- Remaining risk: none found statically. Only a local run can confirm this (EX-01).

## (b) `None` sent as UUID

- Historical: `test_grant_success raised RuntimeError | query failed: ... invalid input syntax for type uuid: "None"`.
- Cause: `lit(s)` used `str(s)`. In the chain G-02 failure, `r.get("coverage_id")` was `None`, and `cov_field(None, ...)` then
  sent `'None'::uuid`. The same path breaks in `cnt(... {lit(cid)}::uuid)` for G-01 when the grant is refused.
- Fix (applied, test-side): `lit(None)` returns `NULL`. `NULL::uuid` matches no row, so `cov_field` returns an empty string
  and the check fails cleanly with a FAIL line instead of an exception. `read_api_tests.py` imports `lit` from `rpc_tests`, so it
  is covered too. `hash_vectors.py` has its own `lit` and is unaffected (no failing path).

## (c) Global cap, provisional

- Historical: `new row for relation "licence_denial_windows" violates check constraint "licence_denial_windows_detail_count_range"`
  at the setup update in the then-current test.
- Constraint (0011, line 197): `detail_count >= 0 and detail_count <= denial_count`.
- Current setup (`rpc_tests.py` around line 878): `set denial_count = greatest(denial_count, 999), detail_count = 999`.
  Postgres evaluates SET expressions on the old row, so the new row has denial_count >= 999 = detail_count and the CHECK holds.
- Denial path (0012 lines 293 to 321): `denial_count` is increased in the upsert first. Each detail increment comes after it,
  so the CHECK holds for the code as written.
- Monotonic guard (0011 line 362): counters may not decrease. The test sets the global detail count to 999, which is only
  valid because earlier tests in the same UTC hour keep it below 999. The test runs last for this reason. Re-run `reset_local.sh`
  before each run so the hour's window starts clean.
- Provisional caps (1,000 global per UTC hour, 20 per actor) are unchanged. Production values remain OPEN.

## (d) AR-04

- `read_run1.log`: `FAIL AR-04 ... |` (empty detail). `read_run2.log` and `read-api-run.txt`: `PASS`.
- The check compares `pg_proc.provolatile` for three names with `v`. An empty detail means the query returned no rows.
  Run1 has no `ERROR` lines, so the cause is not a SQL error in the log.
- Current 0013 declarations (`admin_search_shops`, `admin_shop_licence`, `admin_shop_audit`, `licence_admin_read_gate`) do not
  name `stable` or `immutable`, so VOLATILE is the default. The `stable`/`immutable` keywords in 0012 belong to hash helpers, not
  to the read functions.
- Conclusion: most likely a harness or load-ordering problem in run1. Not provable from logs. The message now says so.
  If it recurs under EX-01, capture `select proname, provolatile from pg_proc where proname like 'admin_%'` before rerunning.

## What still needs EX-01 (not approved)

Every fix above is static. None of the tests has been run on the current files. The runbook in `EX01_RUNBOOK.md` lists the exact
run. Until a dated log with 0 FAIL exists on the hashes in `current_file_hashes.txt`, these tests are "local tested: no" in the checklist.
