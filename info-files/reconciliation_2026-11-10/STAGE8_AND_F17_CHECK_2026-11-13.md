# Stage 8 and F17 check (2026-11-13, local, read-only)

Status: findings only. No code, migration, workflow, secret or setting changed. Nothing approved here.

## Stage 8 items against recorded approvals

| Item | What the records say | Built | Approved for new independent work |
|---|---|---|---|
| Automatic file deletion (retention purge) | Purge function `expired_customer_file_paths` (0010, around lines 785 to 810) and `cleanup-files` function exist in the repo. Live deployment UNVERIFIED (STAGE7_DECISIONS §5C). Cleanup stays disabled until C-1 and M1 get legal review and an owner-approved retention policy. Retention option R-D is a temporary position (2026-11-04). | In repo only | No. Gated on C-1, M1 and the cleanup workflow choice (A, B or C). 22 scheduled runs failed 2026-10-21 to 2026-11-11. No change made. |
| Rate limits | Licence denial counters in `licence_denial_windows` approved as design (O1, M3, 2026-11-02). Built in migration 0011 and exercised by EX-01 (rpc 282/282, read 125/125). Global ceiling of 1,000 detail rows per UTC hour is provisional; the production value is OPEN. Alerting not approved. | Yes, local | No further item. The production ceiling needs an owner decision. |
| Audit log | Consequential audit rows and the replay ledger exist for licence admin writes (0011 to 0013). Item 20 (manual payments and audit) is PARTLY APPROVED: denial logging (M3) and retention split (M8). PENDING: accepted payment methods, reference rules, GST handling (CA), DPDP treatment (lawyer). Retention periods OPEN. | Partly, local | No. Remaining parts are owner, CA or lawyer decisions. |

Conclusion: no Stage 8 item is approved for new local implementation without a decision first. Nothing was added. README line 23 ("Not started") is stale drift and needs owner approval to correct.

## F17: v_last_end can include future coverage periods (read-verified, not run)

- Source: `supabase/migrations/0011_licence_foundation.sql`, `shop_licence_state`, the `v_last_end` block (about lines 496 to 520).
- `v_last_end` is computed only on the path where no coverage covers `p_at` (`v_cur` is null) and no future start exists (`v_next` is null).
- On that path every valid coverage has `starts_at <= p_at` and an effective end `<= p_at`. A future period would have set `v_next` and returned SCHEDULED first. So `v_last_end` cannot include future coverage on this path.
- `v_last_end` is internal. The function returns only state, basis, access_until and next_start.
- Existing suite covers the reachable states: SCHEDULED precedence (G-20, GF-04, SL-07) and EXPIRED and REVOKED (HB-01, HB-04, EX-01, SL-08, SL-09) in `supabase/tests/licence_7c/rpc_tests.py` and `read_api_tests.py`.
- Consequence for 7F: F17 stays a design constraint. The 7F hold-start derivation must not reuse `v_last_end` as it is. The 7F build is still gated on D-HS and C-1.
- Limitation: this is a reading of the SQL. It was not run on PostgreSQL in this check, and no test was added.
