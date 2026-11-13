# D-MIG Option B: prepared change set (NOT APPLIED)

Status on 2026-11-12: prepared for owner review. Nothing has been renamed, committed, pushed or applied.

- The stage7 worktree (`/home/claude/joyyxh/ps-qr-stage7`) is unchanged. Its migration files are still 0011, 0012 and 0013.
- The main checkout, Chain A (`37e4623`, local main 0011 to 0014) and stash `b559dce` are unchanged.
- No database was touched except a throwaway local PostgreSQL 16 scratch database (`dmig_scratch_chain`), which was stopped afterwards.

## Contents

| Path | What it is |
|---|---|
| `RENUMBERING_MAP.md` | The proposed names and why the change is needed |
| `IMPACT_ANALYSIS.md` | Every reference that a renumbering touches, classified |
| `CHANGE_SET_OPTION_B.md` | Preconditions, the exact steps to run after approval, manual edits, rollback |
| `SCRATCH_ORDER_CHECK.md` | The combined apply order on a scratch database (origin 0001 to 0010, Chain A 0011 to 0014, renamed licence files) |
| `dryrun_option_b/` | `baseline_tree` and `renumbered_tree` copies, the mechanical patch, and admin test logs for both trees |
| `scratch_order_check/` | Inputs, copies, shims and per-step logs of the scratch apply |
| `chain_a_readonly/` | Read-only copies of Chain A 0011 to 0014 taken with `git show 37e4623` |
| `MANIFEST_*.txt` | sha256 lists for the baseline files, the renumbered files and the dry-run artifacts |

## Results

- Scratch combined apply: 18 of 18 steps exit 0 with `ON_ERROR_STOP=1`. Details in `SCRATCH_ORDER_CHECK.md`.
- Static collision check: 0 object-name collisions between Chain A (30 objects) and the licence files (67 objects).
- Admin tests (`npm test` file list): 72 of 72 pass on the baseline copy and on the renumbered copy.
- Not verified: the licence suites (`rpc_tests` 282, `read_api_tests` 125, hash vectors) on the combined database. Their shims create `public.shops`, which conflicts with origin migration 0001. Verifying them needs a harness change, which needs its own approval.

## Status per the record (STAGE7_DECISIONS §13E and §13F)

D-MIG was applied as a working default on 2026-11-10 and reverted the same day. §13F records it as NOT APPROVED. The worktree is back at 0011 to 0013, and its files match the pre-rename hashes. The renamed copies from that day are kept at `scratchpad/renamed_2026-11-10_moved_aside/`. This package does not change that status.

## Owner decisions needed before anything is applied

1. Approve the mapping 0011 to 0015, 0012 to 0016, 0013 to 0017, with 0018 reserved for 7F (`RENUMBERING_MAP.md`).
2. Choose how the decision records are treated. The recommendation is to keep the historical text and add a mapping table (`IMPACT_ANALYSIS.md`, section 3).
3. Confirm whether EX-01 approval covers a re-run on the renamed files. EX-01 was approved for the runbook as written, and its file hashes and file names change with the rename.

## Units that must be regenerated after approval

P2 v5 (carries the three files and the test harness), P3 v3 (admin, 10 path hits), and P4 v5 (prose and one path in the README, plus the fixture `_source` label). U6 has no migration references. P1 was not checked in this pass.

Nothing here is a completion claim. Hosted verification, staging, physical printing and release are still open.
