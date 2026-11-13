# Combined migration order: scratch apply (2026-11-12)

## What was run

On a throwaway local PostgreSQL 16.15 cluster (socket only, port 55433, `/home/claude/pg7c_data`), in a new scratch database `dmig_scratch_chain`:

1. `00_platform_shims_for_base.sql`: scratch-only Supabase stand-ins (auth schema and `uid()` and `jwt()`, storage schema, roles `anon`, `authenticated`, `service_role`). It does not create `public.shops`.
2. origin/main migrations `0001` to `0010` (read from `37e4623`; byte-identical to the worktree copies, checked with `cmp`).
3. Chain A `0011_service_options`, `0012_print_eligibility`, `0013_order_workflow`, `0014_create_shop_confirmed_email` (read-only `git show 37e4623`).
4. Renamed copies of the licence files: `0015_licence_foundation`, `0016_licence_admin_rpcs`, `0017_licence_admin_read_rpcs` (copies, not the worktree files).

Each step used `psql -v ON_ERROR_STOP=1` and stopped the run on any non-zero exit.

## Result

- All 18 steps exit 0. The first error line per log: none.
- After the apply: 23 tables in `public`, 92 functions in `public`, 38 licence-related functions, and the tables `platform_admins`, `shop_licence_meta` and `licence_denial_windows` present.
- Cluster stopped afterwards with `pg_ctl -m fast`.

## Attempts that were discarded (for the record)

- First attempt: the licence harness shims (`supabase/tests/licence_7c/00_local_shims.sql`) were applied before origin 0001. They create `public.shops`, so 0001 failed with `relation "shops" already exists`. Not a migration defect. Those shims are not used in this check.
- Second attempt: the platform shim defined `auth.uid()` before `auth.jwt()`, which it calls. Fixed by reordering. Also, my first runner returned the echo status instead of the psql status, so the `break` guards did not fire. Fixed before the final run. The logs of the discarded attempts were removed.

## Static collision check

Chain A has 30 named objects and the licence files have 67. There are 0 exact name collisions, and 0 bare-name collisions of any kind. Chain A has no reference to the licence files.

## Not covered

- The licence suites (`rpc_tests` 282, `read_api_tests` 125, hash vectors) were not run on the combined database. Their shims conflict with origin 0001 (`public.shops`). Running them against the combined chain needs a harness change, which needs its own approval.
- Grants and RLS on the combined database were not compared with the hosted project.
- Only a local scratch database was used. No hosted project, no staging copy, no Supabase setting.

## Logs

`scratch_order_check/logs/*.log` (one per step) and `scratch_order_check/logs/input_hashes.txt` (sha256 of every input).
