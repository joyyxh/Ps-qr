# Audit submission: QRquick units (2026-11-13)

Status: PACKAGED, NOT SUBMITTED. No ChatGPT or OpenAI connector is available in the session that built this. Nothing has been uploaded anywhere. No audit result exists. No unit may be read as PASS until an independent verdict is recorded. The package is not an approval of anything.

## What to submit
1. The handover folder: `audit_handover_2026-11-13.tar.gz` (inside the archive). It holds the five units, the D-MIG dry run, publication documents, logs, and `MANIFEST.sha256` (71 files, all OK).
2. This folder's files: P5 contract, source snapshot, mismatch report, paper-refusal origin, main-checkout diff, decision records, 7F gate register, and `MANIFEST.sha256`.

## Units for independent review (each returns PASS, FAIL or BLOCKED)
| Unit | Files | Local evidence |
|---|---|---|
| P5 print agent fails closed | `units/P5_7F_agent_fail_closed.patch`, `P5_IMPLEMENTATION_AND_SERVER_CONTRACT.md`, `source_snapshot/` | Agent 62/62 on the chain copy |
| P2 v5 database, 7B and 7C | `units/P2_7B_7C_database_v5.patch` | EX-01 run 2: rpc 282/282, read 125/125, hash vectors 0 FAIL |
| P3 v3 admin, 7D | `units/P3_7D_admin.patch` | Admin 72/72 on the chain copy |
| U6 browser smoke and layout | `units/U6_browser_smoke_and_layout.patch` | Owner 39/39 (via U6). Features 23/24 (open greyed-out wording check) |
| P4 v5 web, 7E | `units/P4_7E_web_v5.patch` | Web 212/212. Licence smoke 33/33 with U6 |
| Chain of five, combined | `logs/p5_chain_2026-11-13/` | Apply 5/5 exit 0 |

Not for review as a release: the D-MIG dry run (`units/dmig/`, not approved), P1 governance (blocked by CF-5), the main checkout's paper-size change (see its origin note).

## Gates that stay closed
D-MIG, D-Q4, D-I32, S-4, C-1, greyed-out wording, EX-02, EX-15, RB-01, RB-02, cleanup workflow, and enforcement (OFF). Gate register: `units/7F/GATE_REGISTER.md`.

## Known mismatches to read before judging (see MISMATCH_REPORT)
- Decision records in the chain are the base versions. The worktree has 615 and 134 uncommitted lines more.
- The main checkout has an uncommitted paper-size refusal that no unit includes and whose origin git cannot show.
- The chain was rebuilt from git, not from the earlier `base_5c82d37.tar`.

## Not claimed
Local only. No hosted behaviour, staging, deployment, or physical printer result. Node 18 CI leg not run. Combined-database suites not run.
