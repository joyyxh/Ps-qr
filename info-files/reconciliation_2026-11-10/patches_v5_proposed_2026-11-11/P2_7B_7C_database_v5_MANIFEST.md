# P2 v5: 7B/7C database (test harness isolation fix; migrations unchanged)

**Status.** LOCAL ONLY. Not committed, not pushed, no branch, no PR. Not to be published before EX-15 and before the owner accepts the test-only fix (checklist 2.3).

**Replaces** P2 v3 (`patches_v3_2026-11-11/P2_7B_7C_database.patch`, sha256 `8be19fa7a2e1c4c73ecab0a77a2d8fbe7b781b892fc62c6b56b05adb314a5627`) for publication.

| Unit file | Lines | sha256 |
|---|---|---|
| `P2_7B_7C_database_v5.patch` | 5314 | `0b51ad5e4065edbb8d1cd43fb1c291d7d6e0b01766e3102a715501d871da20a7` |

**What differs from v3.** Only `supabase/tests/licence_7c/rpc_tests.py` and `supabase/tests/licence_7c/read_api_tests.py`. The other 8 sections are byte-identical to v3. The migrations 0011, 0012 and 0013 are unchanged (sha256 in `current_file_hashes.txt`).
- `rpc_tests.py`: `require_fresh_database()`, called by `main()`, refuses to run while `licence_denial_windows` holds rows.
- `read_api_tests.py`: calls `R.require_fresh_database()` at the start of `main()`.

**Validation (local).**
- Apply chain on a fresh extraction of `patch_check/matrix/base_5c82d37.tar`: P2 v5, P3, U6, P4 v5. Each `git apply --check` and `git apply` passes.
- All ten P2 files after apply are byte-identical to the stage7 worktree.
- No added line contains a private or sandbox path.
- EX-01 run 2 on this exact test code (PostgreSQL 16.15, socket only): hash vectors 0 FAIL; rpc_tests 282/282; read_api_tests 125/125 (each on a freshly reset database); hashes unchanged. See `round2_2026-11-11/sql/logs_EX01_2026-11-12/EX01_RESULTS_2026-11-12.md`.

**Not validated.** Hosted or staging. Hosted AAL2. Physical hardware. Migrations 0011 to 0013 are not renumbered (D-MIG open); this patch keeps those names.
