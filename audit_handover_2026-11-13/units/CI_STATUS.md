# CI status (2026-11-12, local only)

Nothing here is applied to the repository. The v2 workflow file is a proposal.

- `ci_tests_workflow_v2.yml` (sha256 `f1d99f55b01da64f40a8a3db16fad8918077e8666200c30a707a3894c3d807b0`): not applied, not committed. It references no secret. Checked by reading it.
- Local runs on Node 22.22.0 (`ci_local_run.log`): web 212 pass; admin 72 pass; agent 61 pass (recorded before P5; now 62 with the P5 test, see `7F_prepared_2026-11-12/`); SQL harness AST parse exit 0.
- Node 18 leg: NOT RUN. Node 18.17 or newer is not installed here, and the agent declares `engines: >=18.17`. This leg is unverified.
- Scheduled cleanup workflow on `origin/main`: 22 scheduled runs, all failed (2026-10-21 to 2026-11-11), from the read-only check in `cleanup_runs_last30.json`. Options are in `CLEANUP_OPTIONS.md`. Option B (`gh workflow disable`, reversible with `gh workflow enable`) is recommended. Nothing has been changed on GitHub.
