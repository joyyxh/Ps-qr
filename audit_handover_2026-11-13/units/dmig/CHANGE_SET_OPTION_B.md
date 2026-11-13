# D-MIG Option B: change set and rollback (NOT APPLIED, DO NOT RUN YET)

Every step below waits for owner approval of D-MIG Option B and the decision in `README.md` (items 1 to 3). Nothing here has been run on the worktree.

## Preconditions

1. Owner approves the mapping in `RENUMBERING_MAP.md`.
2. Owner decides the treatment of decision records (`IMPACT_ANALYSIS.md`, section 3).
3. Owner confirms whether EX-01 covers a re-run on renamed files.
4. The stage7 worktree still matches `MANIFEST_baseline_hashes.txt`. If not, stop and report which file changed.

## Steps after approval

S1. Rename the three untracked files (no git index change, since they are untracked):

    cd /home/claude/joyyxh/ps-qr-stage7
    mv supabase/migrations/0011_licence_foundation.sql supabase/migrations/0015_licence_foundation.sql
    mv supabase/migrations/0012_licence_admin_rpcs.sql supabase/migrations/0016_licence_admin_rpcs.sql
    mv supabase/migrations/0013_licence_admin_read_rpcs.sql supabase/migrations/0017_licence_admin_read_rpcs.sql

S2. Rewrite exact file names in the files listed in `IMPACT_ANALYSIS.md`, section 1 (not the decision records unless the owner chooses). The same script that the dry run used:

    grep -rlE 'licence_foundation\.sql|licence_admin_rpcs\.sql|licence_admin_read_rpcs\.sql' admin docs supabase CLAUDE.md \
      | xargs sed -i -e 's/0011_licence_foundation\.sql/0015_licence_foundation.sql/g' \
                     -e 's/0012_licence_admin_rpcs\.sql/0016_licence_admin_rpcs.sql/g' \
                     -e 's/0013_licence_admin_read_rpcs\.sql/0017_licence_admin_read_rpcs.sql/g'

   The dry run was made with the same substitutions. Check the result against `dryrun_option_b/renumbered_tree` with `diff -r` (it should show only the expected differences).

S3. Manual edits (`IMPACT_ANALYSIS.md`, sections 2 and 4). Rewrite each bare number so it refers to the new file. Keep Chain A references (`0011_service_options.sql` and the other Chain A names) unchanged, and rewrite the sentences that explain the conflict.

S4. Update `reset_local.sh` echo text and comments, the EX-01 runbook (step 1 file list, step 5 log names), `CLAUDE.md` working rules and the checklist.

S5. Regenerate P2 v6, P3 v4 and, if the README path changes, P4 v6. Record sha256 for each. Check each with `git apply --check` on a fresh extraction of `patch_check/matrix/base_5c82d37.tar`.

S6. Validation without a hosted database:
   - `cd admin && npm test`. Expect 72 of 72 (this matched on both dry-run trees).
   - Combined order check (`SCRATCH_ORDER_CHECK.md`) with the renamed files. Expect all steps to exit 0.
   - `node --check` on any changed JavaScript.

S7. Only after EX-01 re-approval: a fresh run of the runbook on a local cluster, using the renamed files. Record new hashes.

## Rollback

R1. If any step after S1 fails, restore the original names and content from `dryrun_option_b/baseline_tree` (which has the same bytes as the worktree today):

    cd /home/claude/joyyxh/ps-qr-stage7
    mv supabase/migrations/0015_licence_foundation.sql supabase/migrations/0011_licence_foundation.sql
    mv supabase/migrations/0016_licence_admin_rpcs.sql supabase/migrations/0012_licence_admin_rpcs.sql
    mv supabase/migrations/0017_licence_admin_read_rpcs.sql supabase/migrations/0013_licence_admin_read_rpcs.sql
    # restore the rewritten text files from baseline_tree (admin/, docs/, supabase/tests/licence_7c/, CLAUDE.md)
    sha256sum -c MANIFEST_baseline_hashes.txt   # expect OK for each line that exists in the worktree

R2. Remove the renamed files only if this change set created them. Never remove `0011_service_options.sql` or any Chain A file: those are in commit `37e4623` on local main.

R3. No database rollback is needed, because no hosted database was touched. If a local scratch database was created, drop it (`dmig_scratch_chain`) and stop the cluster.

R4. Before and after the change, confirm:
   - `git -C /home/claude/joyyxh/ps-qr rev-parse main` is `37e4623`
   - `git -C /home/claude/joyyxh/ps-qr stash list --format='%H %gs'` still has `b559dce`
   - `git -C /home/claude/joyyxh/ps-qr-stage7 status --short` shows only the intended paths

## Not in this change set

- No commit, push, branch, PR or merge.
- No hosted SQL, no Supabase setting, no secret.
- No edit to Chain A or to the main checkout.
- The migration SQL bodies are not changed except for comments and file-name strings.
