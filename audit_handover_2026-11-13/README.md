# Audit handover: QRquick units (2026-11-13)

Status: packaged for independent audit. NOT SUBMITTED. No audit result exists yet. Do not read any unit here as PASS.

This folder is self-contained. `MANIFEST.sha256` lists every file with its SHA-256. Check it with `sha256sum -c MANIFEST.sha256` from this folder.

## Units

| Unit | File | What it changes | Local evidence | Audit status |
|---|---|---|---|---|
| P5, 7F print agent fail-closed | `units/P5_7F_agent_fail_closed.patch` | `agent/src/worker.mjs` prints only after `{ ok: true }`. New test. | agent 62/62 | NOT SUBMITTED |
| P2 v5, 7B and 7C database | `units/P2_7B_7C_database_v5.patch` | Licence migrations 0011 to 0013 and the licence harness. Base `5c82d37`. | EX-01 run 2 (see logs) | NOT SUBMITTED. Superseded if D-MIG is approved. |
| P3 v3, 7D admin | `units/P3_7D_admin.patch` | Admin app, tests and bundle tooling. | admin 72/72, browser 65/65 | NOT SUBMITTED |
| U6 browser smoke and layout | `units/U6_browser_smoke_and_layout.patch` | Two layout rules and four smoke scripts. | features 23/24, owner 39/39 (via U6) | NOT SUBMITTED |
| P4 v5, 7E web | `units/P4_7E_web_v5.patch` | Licence screen, its tests, fixture, docs. | web 212/212; licence smoke 33/33 with U6 | NOT SUBMITTED |
| D-MIG dry run (not applied) | `units/dmig/CHANGE_SET_MECHANICAL_DRYRUN.patch` | Renumbering proposal only. Not applied. | admin 72/72 on both trees; scratch order 18/18 | NOT SUBMITTED. D-MIG NOT APPROVED. |

P1 (governance, blocked by CF-5) is not included.

## Test commands and expected counts

Run each from the tree it names. Results recorded in `logs/`.

- Agent: `cd agent && node --test` → expect `pass 62, fail 0` (stage7 tree with P5).
- Web, chain tree: `cd web && npm test` → expect `pass 212, fail 0`.
- Admin: `cd admin && npm test` → expect `pass 72, fail 0`.
- Licence smoke with U6: `cd web && python3 -m http.server 5174 --bind 127.0.0.1 &` then `node tests/browser/licence-smoke.cjs` → expect `33 of 33 checks passed`, exit 0.
- Features smoke: port 5173, `node tests/browser/features-smoke.cjs` → expect 23 of 24, exit 1 (the open greyed-out check).
- Admin bundle: `node check-bundle.mjs <bundle>` and `sha256sum -c SHA256SUMS` → 14 OK, RESULT PASS.
- Migration scratch order: `logs/scratch_order_check/` (per-step logs, `input_hashes.txt`). See `units/dmig/SCRATCH_ORDER_CHECK.md`.
- EX-01 (local PostgreSQL 16.15, socket only): `logs/EX01_RESULTS_2026-11-12.md`. Run 1 failed for a harness isolation reason. Run 2 is the passing run: rpc 282/282, read 125/125, hash vectors 0 FAIL.

## What the audit should check

- P5: the new check runs before `printer.print`, and a non-confirmed reply never reaches the printer. Journal behaviour matches the existing thrown-case test.
- P4 and U6: web tree combinations and the licence screen's request shapes against `web/tests/fixtures/licence-status-rpc.json`.
- P2 and P3: whether the licence migrations behave as the EX-01 run 2 logs record, and whether the admin calls only the RPCs its tests cover. Neither has been checked in this package.
- D-MIG dry run: that no old name remains and that admin tests pass on the renumbered tree. It is not an approval.

## Not claimed

No hosted behaviour, no staging result, no deployment, no physical printer result. The greyed-out wording check remains open (owner decision).

## Update 2026-11-13: chain with P5, Stage 8 and F17

- P5 applied fifth on a scratch copy of the publication chain (P2 v5, P3 v3, U6, P4 v5, P5, base `5c82d37`). Test commands and results: `logs/p5_chain_2026-11-13/summary.txt`. Agent `node --test` 62 pass (Node v22.22.0; Node 18 leg not run). Web `npm test` 212 pass. Admin `npm test` 72 pass. The check and apply logs for all five patches exit 0 (`apply_p5_chain.log`).
- `units/publication/PUBLICATION_INDEX.md` has a P5 row and the chain-plus-P5 verification rows.
- `units/STAGE8_AND_F17_CHECK_2026-11-13.md`: no Stage 8 item is approved for new independent work. F17 is read-verified as a design constraint on the 7F hold-start derivation. It is not a defect, and no test was added.
- Still NOT SUBMITTED. No audit result exists. None of these units may be read as PASS. Gates are unchanged (see `RELEASE_READINESS_2026-11-13.md`).

## Protected-state finding (2026-11-13, read-only check)

- The main checkout `/home/claude/joyyxh/ps-qr` (on `main`, `37e4623`) has uncommitted changes in `agent/README.md`, `agent/src/worker.mjs` and `agent/test/worker.test.mjs`: 62 insertions, 4 deletions. The earlier record said "3 uncommitted lines"; that was wrong.
- The change in `worker.mjs` adds a paper-size refusal (`unsupported_setting`) for non-A4 paper when the adapter cannot read the printer's paper list. It is a different change from P5, is not in any unit in this package, and its provenance is not established by the records read.
- Not touched in this session. It was not committed, stashed or copied into any unit. P5 applies to base `5c82d37` in the stage7 worktree, not to this checkout, so a later merge needs a conflict check in `worker.mjs`.
- Owner decision needed on what happens to it. Nothing here approves it.
