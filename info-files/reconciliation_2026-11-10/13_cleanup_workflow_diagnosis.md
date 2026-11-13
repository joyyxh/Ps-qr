# 13. Cleanup workflow failures: diagnosis (2026-11-11)

> Evidence labels: see section 0 of `01_reconciliation_report.md`.


**Evidence type:** remote (GitHub Actions run logs and the workflow file on `main` 717717b), read through the REST API and `gh`. Read only. No secret was listed, created, changed or deleted. No schedule was changed. No run was triggered.

## 1. What fails

- Workflow: `.github/workflows/cleanup-files.yml`, named "Clean up expired customer files". It was added in commit `322dc24` (2026-10-21, "Integrate secure printing agent and owner-only app mode") and has not changed since.
- Trigger: `schedule` at `cron "30 20 * * *"` (02:00 India time), plus `workflow_dispatch`.
- Job `cleanup` on `ubuntu-latest`. The steps "Set up job" and "Complete job" succeed. The step "Call the cleanup function" fails.
- Runs: **21 scheduled runs, all failed**, from 2026-10-21 to 2026-11-10. Commit: `4d97e40` for 2026-10-21 to 10-25, `c3931c3` for 10-26, and `717717b` for 10-27 to 11-10 (15 runs). That 15 is the count of check runs on `717717b`, not the total.

| Date (UTC) | Run ID | Commit | Conclusion |
|---|---|---|---|
| 2026-10-21 | 39674949278 | 4d97e40 | failure |
| 2026-10-22 | 39853488895 | 4d97e40 | failure |
| 2026-10-23 | 40023268701 | 4d97e40 | failure |
| 2026-10-24 | 40131687167 | 4d97e40 | failure |
| 2026-10-25 | 40232863219 | 4d97e40 | failure |
| 2026-10-26 | 40400803123 | c3931c3 | failure |
| 2026-10-27 to 11-10 | 40583176188 to 42902937080 (15 runs) | 717717b | failure |

## 2. Exact cause, from the run log

Run 42902937080 (2026-11-10 21:13 UTC), step "Call the cleanup function". The runner prints the step environment as:

```
env:
  CLEANUP_URL:
  CLEANUP_SECRET:
```

Both values are empty. The workflow's own guard then runs:

```
Set QRQUICK_CLEANUP_URL and CLEANUP_SECRET in the repository secrets.
##[error]Process completed with exit code 1.
```

No request is sent to the cleanup function. Run 39853488895 (2026-10-22) shows the same empty variables and the same message.

**The precise missing configuration:** the workflow reads two repository Actions secrets with these exact names:

- `QRQUICK_CLEANUP_URL`, the function URL, `https://<project>.supabase.co/functions/v1/cleanup-files`
- `CLEANUP_SECRET`, the same value as the function's own `CLEANUP_SECRET`

The job has no `environment:` key, so only repository-level secrets reach it. Because the log prints both values as empty, the most likely state is that neither secret exists under these names, though the log cannot separate "not created" from "created under another name".

**Not verified from here:** `gh secret list` returned HTTP 403 ("Access to this GitHub Actions path is not permitted through this proxy"), so the secret names could not be listed. The owner can check the names in GitHub under Settings, Secrets and variables, Actions, without sharing the values.

## 3. What is not the cause

- **The workflow code is correct as far as it goes.** The guard is intended. The header it sends, `x-cleanup-secret`, is the one the function reads. The `curl` call uses `--fail-with-body`, so a server rejection would also fail the step.
- **The function fails closed.** In `supabase/functions/cleanup-files/index.ts`, `sameSecret` returns false when the expected secret is empty. An empty header therefore cannot pass against an unset server secret.
- **Hosted state is not checked.** The function also needs migration `0010` (it calls `expired_customer_file_paths`), a deployed function with JWT checks off, and its own `CLEANUP_SECRET`. None of this was checked on the hosted project, because hosted tools are gated (RB-03, RB-05). If the repository secrets were set but the function secret was not, the step would fail with HTTP 401 instead of the guard message. The current log shows the guard message, so the repository secrets are the first thing to fix.

## 4. Conflict with the decision record

R-D says cleanup stays disabled. The schedule is active, so every day it fails and records a red check on `main`. Deleting files is also irreversible, so the owner has to choose the behaviour. Two options, neither carried out here:

- **Option A: keep the schedule.** The owner sets the two repository secrets with the values above, and confirms the hosted items in section 3 (migration `0010` applied, function deployed with `--no-verify-jwt`, function secret set). No repository file changes.
- **Option B: match R-D.** Remove the `schedule:` block and keep `workflow_dispatch`, or disable the workflow in GitHub. This changes the workflow and needs approval. Until it is done, the failure repeats every day.

Option A is the only one that runs deletion. Option B matches R-D until the owner approves Stage 8 deletion.

## 5. Not done

- No secret created, changed or read.
- No schedule disabled and no workflow run started.
- No hosted SQL or function call.

## Owner-side fix commands (written, not executed)

Nothing below has been run. Setting secrets, changing the workflow, and triggering a run are repository or project changes, so they need your explicit approval. Replace each placeholder yourself. Do not paste a secret value into chat or into a committed file.

Option A: keep the schedule and set the two values the guard step checks.

1. Choose one long random value and set it on the Supabase project, the function side. Use the same value in step 2.
   `supabase secrets set CLEANUP_SECRET='<LONG_RANDOM_VALUE>' --project-ref <PROJECT_REF>`
2. Set the two repository secrets. `gh secret set` reads the value from a prompt or stdin, so it does not appear in shell history.
   `gh secret set QRQUICK_CLEANUP_URL -R joyyxh/Ps-qr --body 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-files'`
   `gh secret set CLEANUP_SECRET -R joyyxh/Ps-qr`
3. Check that both names exist without printing values:
   `gh secret list -R joyyxh/Ps-qr`
4. Only after you approve a manual run, which deletes files: `gh workflow run cleanup-files.yml -R joyyxh/Ps-qr`

If the two `CLEANUP_SECRET` values differ, the function refuses the request, so nothing is deleted. A mismatch is safe but still makes the run fail.

Option B: stop the scheduled runs without changing the workflow file.
   `gh workflow disable cleanup-files.yml -R joyyxh/Ps-qr`
Re-enable later with `gh workflow enable cleanup-files.yml -R joyyxh/Ps-qr`. Use this if you do not want the cleanup job to run until the secrets are set.

Recommendation: Option B now, then Option A when the cleanup function is approved for production. The workflow has failed 21 scheduled runs since 2026-10-21 with the same cause (empty secrets), so disabling it stops the noise without changing any code.
