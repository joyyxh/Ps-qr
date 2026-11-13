# QRquick audit package, 2026-11-13

Status: NOT SUBMITTED TO ANY INDEPENDENT AUDIT. No audit result exists. Do not read any unit here as PASS. Nothing here is an approval, a release, or a decision.

This is a local evidence package. Local tests do not prove hosted behaviour, staging, or physical printing.

## Contents
- `audit_handover_2026-11-13/`: five units (P2 v5, P3 v3, U6, P4 v5, P5), the D-MIG dry run (not approved), logs, publication documents. Start with its `README.md`.
- `audit_submission_2026-11-13/`: P5 implementation and server contract, source snapshot, publication-chain versus worktree mismatch report, origin note for the uncommitted main-checkout paper-size change, decision records, and the 7F gate register. Start with `SUBMISSION_README.md`.
- `audit_submission_2026-11-13.tar.gz`: both folders in one archive.

## Verify
- `sha256sum -c MANIFEST.sha256` inside each folder (71 and 19 files).

## Not included
Secrets (scanned: none), real admin configuration, hosted project data.
