# EX-01 runbook: 0011 to 0013 on a LOCAL THROWAWAY PostgreSQL 16 cluster

STATUS: PREPARED. NOT EXECUTED. Requires explicit approval of EX-01 before any step is run.

Rules that apply to every step:
- The database must be a local throwaway cluster that the tester starts, on a socket directory. It must never be the
  live Supabase project, a hosted project, or any staging project. `reset_local.sh` drops and recreates `stage7c_local`
  on that cluster.
- Do not run `hash_vectors.py` with `--update`. It rewrites the pinned vectors and needs its own approval.
- Do not edit a migration file during a run. Step 6 checks this.
- D-MIG is still open. The files are named 0011 to 0013 (provisional, decision E7). Do not rename them.
- Do not commit, push, or apply anything to any Supabase project from this runbook.

Placeholders: `<WORKTREE>` = `/home/claude/joyyxh/ps-qr-stage7`, `<SOCK>` = the local cluster's socket directory,
`<LOG>` = an empty folder for this run's logs, `<DATE>` = the run date.

## Step 0: confirm the target is local

    test -d "<SOCK>" && PGHOST="<SOCK>" PGPORT=55433 PGUSER=postgres psql -X -d postgres -tAc "select inet_server_addr() is null, version();"

Expected: `t` for `inet_server_addr() is null` (a Unix socket, not a TCP host) and a PostgreSQL 16.x version string. Stop if the answer
is `f` or the version is not 16.

## Step 1: record the file hashes before the run

    cd "<WORKTREE>" && mkdir -p "<LOG>" && sha256sum supabase/migrations/0011_licence_foundation.sql \
      supabase/migrations/0012_licence_admin_rpcs.sql supabase/migrations/0013_licence_admin_read_rpcs.sql \
      supabase/tests/licence_7c/*.py supabase/tests/licence_7c/*.sql supabase/tests/licence_7c/*.json \
      supabase/tests/licence_7c/*.sh > "<LOG>/hashes_before_<DATE>.txt"

Compare with `current_file_hashes.txt` (2026-11-11). If they differ, stop and record which files changed.

## Step 2: rebuild the throwaway database

    export STAGE7C_SOCK="<SOCK>" PYTHONDONTWRITEBYTECODE=1
    cd "<WORKTREE>" && supabase/tests/licence_7c/reset_local.sh "<SOCK>" 55433 2>&1 | tee "<LOG>/reset_<DATE>.log"

Expected last line: `reset ok: stage7c_local (shims, 0011, 0012, 0013, staging window row 31 days)`.
Any `ERROR:` line means stop. Record it and do not edit the migrations.

## Step 3: hash vectors (read-only check against pinned values)

    cd "<WORKTREE>" && python3 supabase/tests/licence_7c/hash_vectors.py --db stage7c_local --socket "<SOCK>" --port 55433 2>&1 | tee "<LOG>/hash_vectors_<DATE>.log"

Expected: no FAIL lines and exit status 0. Do not add `--update`.

## Step 4: RPC tests

    cd "<WORKTREE>" && python3 supabase/tests/licence_7c/rpc_tests.py 2>&1 | tee "<LOG>/rpc_tests_<DATE>.log"

Expected: every line starts with `PASS`. The final summary reports zero failed. Run this on a freshly reset database.
Its global-cap test (`test_global_cap_provisional`) changes this UTC hour's counters, so reset first.

Expected to be confirmed by this run: (a) G-02 passes on a fresh shop; (b) `test_grant_success` no longer raises; (c) the
global-cap setup no longer violates the CHECK constraint.

## Step 5: read API tests

Run step 2 again first (`reset_local.sh`). The suites share one hourly global denial cap, and `rpc_tests` uses it up. Both suites now refuse to start while `licence_denial_windows` holds rows, with the message `database is not fresh`. A run without the reset stops at that check; it is not a test result.

    cd "<WORKTREE>" && python3 supabase/tests/licence_7c/read_api_tests.py 2>&1 | tee "<LOG>/read_api_tests_<DATE>.log"

Expected: zero FAIL lines. AR-04 must pass. If AR-04 fails with the message "query returned no rows", capture this before
rerunning:

    PGHOST="<SOCK>" PGPORT=55433 PGUSER=postgres psql -X -d stage7c_local -c "select proname, provolatile from pg_proc where proname like 'admin_%' or proname = 'licence_admin_read_gate' order by 1;"

## Step 6: confirm nothing changed during the run

    cd "<WORKTREE>" && sha256sum <same file list as step 1> > "<LOG>/hashes_after_<DATE>.txt" && diff "<LOG>/hashes_before_<DATE>.txt" "<LOG>/hashes_after_<DATE>.txt" && echo "hashes unchanged"

## Record

For each run write one line in the checklist with: date, cluster version, socket-only confirmation (step 0), the three log
file names, the hash file names, and the pass counts. A run counts only if its hashes match step 1 and step 6.

Stop conditions: any FAIL in steps 3 to 5, any ERROR in step 2, a socket answer of `f` in step 0, or a hash change in step 6.
On a stop, record the log and do not edit the migrations. A migration fix needs its own approval.

## Not covered by this runbook (each needs its own approval)

- Hosted AAL2 verification (checklist item 2.7; EX-02 and hosted approval).
- Staging copy with S1 to S9 (item 2.12).
- Default grants on the new functions in a hosted project (item 2.9).
- The cleanup of the hosted migration history (item 2.10).
