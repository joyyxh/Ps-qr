# 7B/7C SQL defect analysis: addendum after the EX-01 local run (2026-11-12)

Supersedes the status column of `SQL_DEFECT_ANALYSIS.md` where they differ. The root causes and the historical logs are unchanged.

| Item | Status now | Evidence |
|---|---|---|
| (a) G-02 `overlap` | Fixed in the current test file. Passes on a fresh database | run2 `rpc_tests` 282/282 |
| (b) `None` sent as UUID | Fixed in `rpc_tests.py` (`lit(None)` gives SQL NULL). Passes | run2 `rpc_tests`, `test_grant_success` |
| (c) global cap CHECK | Fixed in the test setup. Migration denial path correct. Passes | run2 GC-01, GC-02, C-02, DN-01 |
| (d) AR-04 failed once (2026-11-08, empty detail) | Not reproduced. AR-04 passes in run1 and run2 of 2026-11-12. The 2026-11-08 cause has no log evidence and stays unexplained | run1 and run2 `read_api_tests` |
| (e) NEW: read suite failed after the RPC suite (run1, 2026-11-12) | Harness isolation defect. `rpc_tests` fills the hourly global detail cap, and the read suite then runs in the same hour. Fixed by `require_fresh_database()` in both suites. No migration change | run1 `read_api_tests` 12 FAIL and one unpacking error; run2 guard message; run2 read suite 125/125 |

No migration change is proposed. `proposed_migration_fixes.diff` remains empty.
Open: EX-01 results are local only. Hosted and staging checks remain separate approvals.
