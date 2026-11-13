# Repair report (2026-11-10)

> Evidence labels: see section 0 of `01_reconciliation_report.md`.


**Rule applied.** Repair only what an approval already covers. Candidate fixes that were not covered are listed in section B with the reason. No code, SQL, migration, workflow or agent logic was changed.

## A. Local changes made

| ID | Change | Reason | Files | Verification |
|---|---|---|---|---|
| R1 | Reverted the licence migration renames: `0015_licence_foundation.sql` → `0011_licence_foundation.sql`; `0016_licence_admin_rpcs.sql` → `0012_licence_admin_rpcs.sql`; `0017_licence_admin_read_rpcs.sql` → `0013_licence_admin_read_rpcs.sql`. Content restored from the pre-rename snapshot | The 2026-11-10 brief: proposal NOT approved; no renumbering until explicit approval. It overrides the earlier working default | `supabase/migrations/0011`–`0013` | SHA-256 of each equals the snapshot manifest. Header now says 0011–0013 |
| R2 | Reversed number tokens in three 7C test files edited by the earlier rename: `00_local_shims.sql` (2 comment lines), `rpc_tests.py` (2 docstring lines), `read_api_tests.py` (1 docstring line) | Same | `supabase/tests/licence_7c/` | Diff against the pre-revert copies shows five changed lines, all comment or docstring text. No snapshot exists for these three files, so they were restored by reversing the token mapping, not byte-for-byte. Python parse OK |
| R3 | Restored from the snapshot: `docs/STAGE7C_OPERATIONS.md`, `supabase/tests/licence_7c/reset_local.sh`, `admin/src/read-api.js`, `admin/src/licence-api.js`, `admin/src/messages.js`, `admin/README.md`, and the admin `*.test.js` files | Same | As listed | SHA-256 matches the snapshot for 0011, 0012, 0013, `reset_local.sh`, `STAGE7C_OPERATIONS.md`, `read-api.js`, `licence-api.js` and `messages.js`. README and admin test files were restored from the snapshot and not hash-checked; `bash -n reset_local.sh` OK; admin `npm test` 72/72 |
| R4 | No file deleted. The three renamed copies were moved to `local evidence folder/renamed_2026-11-10_moved_aside/`. Pre-revert copies are in `local evidence folder/pre_revert_2026-11-10/` | Reversibility | local evidence folder | Both folders listed |
| R5 | Register: the §13E D-MIG row and its mapping sentence annotated SUPERSEDED (original text kept). Added §13F: reconciliation record, evidence table, owner confirmations CF-1 to CF-5 | Source-of-truth consistency. No historical decision text deleted. The §13D heading was reworded (see the §13F note) | `STAGE7_DECISIONS.md` | Heading check (one §13F, one §14); CF-5 present |
| R6 | Decision sheet: appended a "Corrections record 2026-11-10" (three bullets). No existing text changed | Source-of-truth consistency | `OWNER_DECISION_SHEET.md` | Zero lines removed against the 2026-11-10 pre-rename snapshot |
| R7 | Item 32 draft: status line (still DRAFT, NOT APPROVED); Q4 default shown as Option A; "claim count restored" limited to a successful release; D-I32-b fail-safe tension added in §4 and §12 | The draft overstated the Q4 outcome; the tension was not recorded | `local evidence folder/STAGE7F_ITEM32_KILL_SWITCH.md` | Read back |
| R8 | Numbering note at the top of four live local evidence folder working documents (`STAGE7F_PREP.md`, `STAGE7F_ITEM33_PLAN.md`, `STAGE7_INTEGRATION_ANALYSIS.md`, `STAGE7F_C1_GATES.md`) | Stop readers treating 0015–0018 as adopted | local evidence folder | Read back |
| R9 | Created the seven reconciliation deliverables and the evidence files | Brief §9 | `local evidence folder/reconciliation_2026-11-10/` | Files present |
| R10 | Re-ran admin, web, targeted and browser tests with saved logs. Created the publication map (08), the commit and PR sequence (09) and four patch sets (P1–P4) in `patches/`. Checked the patches on a clean export of `5c82d37`. Corrected the reconciliation documents (01, 03, 04, 05, 06, 07) | Brief §6 and §8 | `logs_2026-11-10/`, `patches/`, `patch_check/` | Logs read back. Combined check: admin 72/72, web 212/212. This pass staged and committed nothing. Working-copy edits made later are listed in R11 |
| R11 | Working-copy edits, none committed, staged or stashed. stage7 worktree: `docs/STAGE7C_OPERATIONS.md`, `admin/README.md`, and the socket-path guards in `supabase/tests/licence_7c/rpc_tests.py`, `hash_vectors.py` and `reset_local.sh`. stage7e worktree: `web/tests/browser/licence-smoke.cjs` (`PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`), `web/tests/browser/README.md`, `docs/STAGE7E_LICENCE_STATUS.md` (unlogged counts marked, fixture statement). Migrations 0011–0013 and the owner's decision files were not edited. Patches regenerated as v3 (P2 and P4 changed; P1 and P3 unchanged) | Brief §2, §5 | the two worktrees; `patches_v3_2026-11-11/` | P1 to P4 hashes match `SOURCE_HASHES.txt` (48 files). Matrix v3 identical to v2. Licence browser smoke 33 of 33 on the final P4 (`logs_2026-11-11/`) |

## B. Defects found, not repaired

| Defect or gap | Evidence | Why not repaired | What is needed |
|---|---|---|---|
| `order_not_printable` is not mapped by the print-agent edge function; it returns HTTP 500 `server_error` | Chain A `supabase/functions/print-agent/index.ts` lines 79–96; raised by Chain A `0012` (lines 80 and 181). `supabase/tests/print_eligibility_tests.sql` expects the code (not run) | Mapping belongs to the D-Q4 mechanism (pending). The code is on the unpushed protected `main` line. A fix needs an isolated branch from `37e4623` and approval | Owner approval of codes and HTTP status (EX-06) |
| `licence_inactive` is not referenced by any code or SQL; it appears only in register text | Searched the three worktrees and the main checkout | D-Q4 pending | D-Q4 approval (decision register) |
| Cleanup "disabled" (R-D) is not implemented | `cleanup-files.yml` on `origin/main` is scheduled | Workflow change on `main` needs approval; R-D is owner policy | RB-05 |
| Hold-start hazard: `v_last_end` in `shop_licence_state` includes future coverage ends | `0011` lines 508–523; register Q2 says do not reuse | Hold start is not built. Must not be reused | Note for 7F review; D-HS for never-ACTIVE shops |
| Owner print button does not check licence for inactive shops | `canSendToPrint` in `web/src/logic.js` (line 341) | Enforcement held back (C-3); D-Q5 pending | 7F build approval |
| Customer tracking shows "Printing" for held orders | `logic.js` customer label | D-Q5b pending (customer-facing; lawyer via C-1) | Owner decision |
| S-5: agent behaviour when `markPrinting` throws | Committed `worker.mjs` lines 258–264: returns without printing or reporting | Runtime test needs local-test approval | Owner approval (RB-10) |
| Item 33 code and two-session staging tests | Not built | Not approved | RB-12 |
| Kill switch absent | Design only | D-I32 pending | RB-11 |
| 7F gates need Chain A's function versions; the licence line does not contain them | Function analysis (`03`) | Combining the lines is G16, not approved | EX-03 |
| Uncommitted agent changes in the protected checkout (size-based paper refusal; picture refusal on non-A4) | `git diff` of `agent/src/worker.mjs` | Not part of Stage 7; protected checkout; not run | Owner decision on that work; test before any commit |

## C. Tests

No new code was written, so no test here proves a new change. Results cover existing code only: see `05_test_evidence_report.md`.
