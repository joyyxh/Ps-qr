# Publication index, v6 (2026-11-12)

Status: LOCAL ONLY. Nothing is committed, pushed, branched, opened as a PR, merged, deployed, staged or printed. Stage 7 is not complete. The hosted site, staging, physical printing and release are not verified.

Base: `5c82d37` (`stage7-payments`). Patches were checked with `git apply --check` on a fresh extraction of `patch_check/matrix/base_5c82d37.tar`.

## Units and apply order

Order: P2 v5, then P3 v3, then U6, then P4 v5. The apply chain check and apply exited 0 for all four (`logs/apply_chain.log`). P5 comes after P4 in the chain-plus-P5 run (2026-11-13, `logs/p5_chain_2026-11-13/`).

| Unit | Patch | sha256 | Lines | Status |
|---|---|---|---|---|
| P1 governance | `patches_v3_2026-11-11/P1_stage7_governance.patch` | `4cbe513617a3c88711a9dbf1287af150ebb94289dfea0c4cea1753559eba46d9` | 1196 | NOT in the chain. Blocked by CF-5 and EX-15. |
| P2 v5, 7B and 7C database | `patches_v5_proposed_2026-11-11/P2_7B_7C_database_v5.patch` | `0b51ad5e4065edbb8d1cd43fb1c291d7d6e0b01766e3102a715501d871da20a7` | 5314 | In the chain. Carries migrations 0011 to 0013 and the licence harness. Superseded by P2 v6 if D-MIG Option B is approved. |
| P3 v3, 7D admin | `patches_v3_2026-11-11/P3_7D_admin.patch` | `cc56fd707ad09a7bbb09c44bd9bae8695b8c5ab21be74ce2ea6ee25d00942a43` | 3582 | In the chain. Has 10 migration path hits. Superseded by P3 v4 if D-MIG Option B is approved. |
| U6 browser smoke and layout | `patches_v5_proposed_2026-11-11/U6_browser_smoke_and_layout.patch` | `f19cd2381a5eed65c604a62751855f7f995155da809820332f5f761f0f64be26` | 438 | In the chain. Changes two layout rules and four smoke scripts. Unaffected by D-MIG. |
| P4 v5, 7E web | `patches_v5_proposed_2026-11-11/P4_7E_web_v5.patch` | `7119a05ca701d536cf073324cd4c13aa87ac375104430a10e0071d4298ab5c10` | 1850 | In the chain. The README changed from v3. Superseded by P4 v6 if the README path changes. |
| P5 print agent fails closed (7F) | `7F_prepared_2026-11-12/P5_7F_agent_fail_closed.patch` | `d1bb8fe3325bf194986db85980e662351957c49dd1c139f1f5e5dd5a722f813e` | 46 | Applied fifth on a scratch copy of this chain (2026-11-13). Touches `agent/src/worker.mjs` and `agent/test/worker.test.mjs` only. Local evidence only. Its release is a separate decision (7F gates in `GATE_REGISTER.md`). |

## Verification (local, recorded logs in `logs/`)

| Check | Result | Log |
|---|---|---|
| Apply chain (P2 v5, P3 v3, U6, P4 v5) | 4 of 4 check and apply exit 0 | `apply_chain.log` |
| web `npm test`, chain | 212 pass, 0 fail | `web_npm_test_chain.log` |
| web `npm test`, combined tree (order 1) | 212 pass, 0 fail | `web_npm_test_combined_order1.log` |
| admin `npm test`, chain | 72 pass, 0 fail | `admin_npm_test_chain.log` |
| admin `npm test`, combined tree (order 1) | 72 pass, 0 fail | `admin_npm_test_combined_order1.log` |
| Admin browser smoke, built bundle, localhost stub only | 65 PASS, 0 FAIL | `admin_browser_smoke_bundle.log` |
| Bundle checksums (`SHA256SUMS`, 14 files) | all OK (re-checked 2026-11-12) | `admin-deploy/bundle/SHA256SUMS` |
| Bundle checker negative tests | PASS, no secret value found | `bundle_checker_negative_tests.log` |
| 7E web `features-smoke` with U6 | 23 of 24. One check is open (see below). | U6 manifest, not in this folder |
| 7E `licence-smoke` with U6 applied (web tree byte-identical to this chain; Supabase mocked) | 33 of 33 PASS, exit 0 | `licence_smoke_u6_2026-11-12.log` |
| Migration order on a scratch database (D-MIG) | 18 of 18 steps exit 0 | `../../round3_2026-11-12/dmig_option_b/SCRATCH_ORDER_CHECK.md` |
| Chain plus P5: 5 patches check and apply on a scratch copy of base `5c82d37` (P2 v5, P3 v3, U6, P4 v5, P5) | 5 of 5 exit 0 | `logs/p5_chain_2026-11-13/apply_p5_chain.log`, `patch_hashes_chain_p5.txt` |
| agent `node --test`, chain plus P5 (Node v22.22.0; Node 18 leg not run) | 62 pass, 0 fail, including the fail-closed test | `logs/p5_chain_2026-11-13/agent_node_test_chain_p5.log` |
| web `npm test`, chain plus P5 | 212 pass, 0 fail | `logs/p5_chain_2026-11-13/web_npm_test_chain_p5.log` |
| admin `npm test`, chain plus P5 | 72 pass, 0 fail | `logs/p5_chain_2026-11-13/admin_npm_test_chain_p5.log` |
| Summary of the chain-plus-P5 run | agent 0, web 0, admin 0 exit codes | `logs/p5_chain_2026-11-13/summary.txt` |

P5 is applied to the scratch chain copy only. The protected checkout was not touched, nothing was committed, and the four-patch chain record (`apply_chain.log`) is unchanged.

Open check in the 7E smoke: `the greyed-out boxes say why` fails. The product shows no reason text on a greyed-out Colour or Double-sided card. No approved wording exists for those cards. The check is kept, not weakened. This is an owner wording decision.

Not run: a real phone or tablet; the hosted site; staging (EX-02); physical printer tests.

## Blocking approvals (none granted)

- EX-15: owner approval of the merge order and of the PR to `main`.
- D-MIG: renumbering of the licence migrations (Option B proposal). Affects P2, P3 and P4 (see `dmig_option_b/IMPACT_ANALYSIS.md`, section 5).
- RB-02: where the admin is hosted. Deployment is blocked until this is decided.
- RB-01: admin UUID and MFA.
- EX-02: staging project approval. Staging checks S1 to S9 and the two-session tests (RB-12) are not run.
- C-1: legal review of licence checkout, not done. C-3 is recorded as a hold-back decision.
- CF-5: blocks P1.
- Item 2.7: hosted AAL2 verification, not run.

## Files in this folder

- `admin-deploy/bundle/` (built static admin bundle, `config.js` empty), `admin-deploy/build-bundle.sh`, `admin-deploy/check-bundle.mjs`, `admin-deploy/DEPLOY.md`
- `logs/` (listed above)
- `RELEASE_NOTES_7E.md`
