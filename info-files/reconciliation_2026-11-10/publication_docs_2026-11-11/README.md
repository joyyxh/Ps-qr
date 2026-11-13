# Stage 7 reconciliation evidence, 2026-11-10 and 2026-11-11 (documentation unit)

Status: prepared, not published. Nothing in this folder has been committed, pushed or opened as a pull request. Each step needs the owner's explicit approval for that exact action; `12_publication_units.md` section 2 gives the commands and the approval each one needs.

## Contents

- `01` to `11`: reconciliation reports. Section 0 of `01` defines the evidence labels (local, remote, historical SQL log, mocked browser, hosted or staging, physical printer, no log); the other reports point to it.
- `12_publication_units.md`: the publication units. For each: exact files and hashes, parent commit, dependency order, tests run on that exact unit, missing evidence, draft-PR readiness, and the commit and push commands.
- `13_cleanup_workflow_diagnosis.md`: why the `cleanup` workflow fails on every scheduled run (run logs; no secret was read or changed).
- `proposals/`: three proposals, none applied. `ci_tests_workflow_proposed.yml` is a CI test workflow for `.github/workflows/tests.yml` (kept outside `.github/` here, so GitHub does not run it). `README_proposed_717717b.md` is the full proposed README and `README_proposal_717717b.patch` is its diff against `717717b`. The rationale is in `12`, section 3.
- `patches_manifests/`: manifests and source-file hashes for patch sets v2, v3 and v4 (v4 covers the governance patch only).
- `logs_2026-11-10/` and `logs_2026-11-11/`: saved test and browser-check logs (admin and web `npm test`, targeted tests, licence smoke, the dependency matrix, and `npm test` on the `717717b` export).
- `logs_historical_2026-11-07_08/`: SQL and test logs from 2026-11-07 and 2026-11-08. They ran on earlier versions of the migration files, so they are historical evidence, not current results.
- `scripts/`: `make_patches.sh` (builds the patches from the working copies) and `run_matrix_v3.sh` (dependency matrix). Both are templates: set the placeholders to real local paths before running them.
- `UNIT_FILES.sha256`: checksums of every file in this folder.

## Placeholders and exclusions

Local paths were replaced with placeholders such as `<WORKTREE_7>`, `<WORKTREE_7E>`, `<PROTECTED_CHECKOUT>`, `<EVIDENCE>` and `<HOME>`. The owner's address was replaced with `<owner-email>`. The only e-mail-like string left is the commit attribution address.

Not included, on purpose:
- The patch files. The P1s governance patch and the sanitizer script are held locally because the patch carries the owner's governance text, whose publication is blocked by CF-5.
- The extracted test trees.
- The preview of the owner's governance text and the owner's decision files.
