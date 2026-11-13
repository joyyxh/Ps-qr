# Stage 7F preparation (2026-11-12): local only, enforcement OFF

Status: 7F is NOT built. The 7F build needs its own approval, and its gates are not met (see `GATE_REGISTER.md`).

## Done locally

- P5, the print agent fails closed. `agent/src/worker.mjs` prints only after `markPrinting` resolves to an explicit `{ ok: true }`. A resolved `undefined`, `{}` or `{ ok: false }` now prints nothing and reports nothing, the same as the existing thrown case. Before the change, the new test failed with "printed after reply undefined".
  - Patch: `P5_7F_agent_fail_closed.patch`, sha256 `d1bb8fe3325bf194986db85980e662351957c49dd1c139f1f5e5dd5a722f813e`, 46 lines.
  - Checked: applies cleanly to the HEAD agent files, and the applied copy is byte-identical to the worktree.
  - Agent suite: 62 of 62 pass (61 before, plus one new test with three replies).
  - Production behaviour: unchanged for the real server, which returns `{ ok: true }` on success.
- Gate register (`GATE_REGISTER.md`), built from the decision records.

## What this proves, and what it does not

- S-5 (STAGE7_DECISIONS, security weaknesses in §12B): the agent's decision logic is now tested locally with fake API, adapter and journal objects. It is not a run on a real printer. Runtime on a physical printer is still open.
- Not built: any refusal in `mark_printing`, any release call, the kill switch, held-file release, any customer wording change, migration 0018, and the item 33 lock tests. No enforcement is turned on.
- Dependency G16 (STAGE7_DECISIONS §13F): 7F sits on Chain A's `approve_order_for_print`, `agent_claim_next_job` and `agent_mark_printing`. Combining Chain A and the licence files is a precondition. A scratch apply of the combined order passes (`/tmp/claude-0/-home-claude/0c86edef-9199-55e4-a183-f9fd34ea0c1b/scratchpad/round3_2026-11-12/dmig_option_b/SCRATCH_ORDER_CHECK.md`). The combination itself is not approved.

## Unit status

- P5 is a new local unit. It is not in `publication_v6`. It needs a decision on whether it joins the 7F build or is released earlier as a fail-closed fix.
- No commit, push, branch or PR.

## Checked for other independent 7F work (2026-11-12)

Each finding in `STAGE7F_PREP.md` §7 (F1 to F17) was checked for independence. None gives further safe local code without a pending decision:
- F1, F2, F16: the error names and the refusal branch depend on D-Q4.
- F4, F5: lock class and retry depend on D-R18-T2 and on the order of items 23 and 24.
- F6, F7: wording depends on D-Q5 and D-Q5b.
- F11: hosted check, blocked.
- F12: D-MIG.
- F13, F17: retention and hold-start depend on C-1 and D-HS. F17 is not tested.
- F3, F8: design constraint or no change needed.
- F9, F10: already covered by the EX-01 grant inventory and the licence browser smoke. No new test added.

## Update 2026-11-13

- P5 is applied fifth on a scratch copy of the publication chain (P2 v5, P3 v3, U6, P4 v5, P5). Results: agent 62 of 62, web 212 of 212, admin 72 of 72. Logs: `../publication_v6_2026-11-12/logs/p5_chain_2026-11-13/`. P5 is still not in `apply_chain.log`. Its release is a separate decision.
- F17 is read-verified in `../STAGE8_AND_F17_CHECK_2026-11-13.md`. Future coverage cannot reach `v_last_end` on the path that computes it. F17 remains a constraint on the 7F hold-start derivation, not a defect. No test was added.
- Stage 8: no item is approved for new independent work. Details in `../STAGE8_AND_F17_CHECK_2026-11-13.md`.
- No 7F build, enforcement, refusal, release or kill-switch work was started. Their gates in `GATE_REGISTER.md` are unchanged.
