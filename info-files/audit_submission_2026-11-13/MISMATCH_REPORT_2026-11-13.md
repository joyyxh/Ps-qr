# Publication chain versus actual worktrees (2026-11-13, read-only)

Chain tree: scratch copy of `git archive 5c82d37` with P2 v5, P3 v3, U6, P4 v5, P5 applied in that order. Logs: `logs/p5_chain_2026-11-13/`. The earlier chain was built from `patch_check/matrix/base_5c82d37.tar`, which is not in this session; this copy was rebuilt from git. Patch hashes match the index.

| # | Comparison | Result | Verdict |
|---|---|---|---|
| M1 | Chain versus stage7 worktree, migrations 0011 to 0013, `supabase/tests/licence_7c/`, `admin/`, P5 agent files | Byte-identical | Consistent |
| M2 | Chain versus stage7 worktree, decision records | `STAGE7_DECISIONS.md`: 615 changed lines. `OWNER_DECISION_SHEET.md`: 134 changed lines. The worktree holds uncommitted edits. The chain carries the base versions. The 7F gate register was built from the worktree versions. | MISMATCH. Decision records in the chain are stale. |
| M3 | Chain versus stage7 worktree, web | Worktree `web/src/owner.js` equals base. Chain has the P4 licence additions (`licence-status.js`, `owner-licence.js`, `licence-smoke.cjs`, fixtures, `licence-status.test.js`, `docs/STAGE7E_LICENCE_STATUS.md`). The worktree lacks these by design, because 7E lives in `stage7e`. | Expected. Not a defect. |
| M4 | Chain versus stage7 worktree, U6 files (`web/styles.css`, four browser smokes) | Identical, except the P4 licence CSS block that exists only in the chain. | Consistent |
| M5 | Chain versus `stage7e` web (5c82d37 + 12 uncommitted entries) | Differ only in `web/styles.css` and the four browser smokes. `stage7e` has no U6. | Expected. U6 is only in the chain and the stage7 worktree. |
| M6 | Chain versus main checkout | Different base. The chain applies to `stage7-payments` (5c82d37). Main is `37e4623` (Chain A, unpushed). Both have `agent/src/worker.mjs` at blob `b6899ed`. | Expected. Combining needs D-MIG and EX-15. |
| M7 | P5 applied to a copy of the main checkout's working `worker.mjs` and test | `git apply --check` exit 0. Hunk 1 applies at offset 20. Results: `p5_vs_main_working_copy_check.txt`. The chain tests did NOT include the main checkout's paper change. | Patches apply together. Semantics are not tested together. |
| M8 | Worktree `CLAUDE.md`, `__pycache__` | Untracked. Not in any unit. | Not part of the chain. Exclude from any archive. |

## Summary for the audit

- The only tree containing all five units is the chain copy. Its agent and migration files match the stage7 worktree.
- The records mismatch (M2) is the one that matters for release. The chain does not carry the decision edits made after 5c82d37.
- Main checkout's uncommitted paper-size refusal is outside every unit. See `MAIN_CHECKOUT_PAPER_REFUSAL_ORIGIN.md`.
