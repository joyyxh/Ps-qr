# cleanup-files workflow: options (prepared 2026-11-12; nothing applied)

## Current state (read-only, 2026-11-12)

- Workflow `cleanup-files.yml` (id 391505993): **active**. Schedule `30 20 * * *` UTC (02:00 India).
- Run history: **22 of 22 scheduled runs failed**, 2026-10-21 to 2026-11-11 (the 22 runs in `cleanup_runs_last30.json`).
- Cause: both repository secrets are empty at run time (`CLEANUP_URL` and `CLEANUP_SECRET`). The job prints "Set QRQUICK_CLEANUP_URL and CLEANUP_SECRET" and exits 1 **before any call to the function**. Nothing is deleted by a failing run.
- The function (`supabase/functions/cleanup-files/index.ts`) has **no enable switch**. Any call that carries the correct `x-cleanup-secret` deletes storage objects for expired customer files and marks their rows.
- Decision 4 (`STAGE7_DECISIONS.md:1228`; `OWNER_DECISION_SHEET.md:158`, worktree root): retention option R-D is selected **temporarily**; cleanup stays disabled until C-1/M1 has legal review and an owner-approved retention policy.

**Consequence for every option:** setting the two secrets is what turns deletion on. Option A therefore conflicts with decision 4 unless the owner first makes the retention decision.

## Option A: fix the secrets (owner-side). NOT RECOMMENDED while decision 4 stands

Needs: owner approval for the secret change and a retention decision (C-1/M1).

Before-state check (names only, owner runs):
    gh api repos/joyyxh/Ps-qr/actions/secrets --jq '.secrets[].name'

Commands (owner runs; never paste the value into a shell history or a chat):
    supabase secrets set CLEANUP_SECRET='<LONG_RANDOM_VALUE>' --project-ref <PROJECT_REF>
    gh secret set CLEANUP_SECRET -R joyyxh/Ps-qr          # prompts for the same value
    gh secret set QRQUICK_CLEANUP_URL -R joyyxh/Ps-qr --body 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-files'

After-state check: the same names command shows both names; `./verify_cleanup_state.sh` still shows `active`.

Manual run (deletes files; separate approval): `gh workflow run cleanup-files.yml -R joyyxh/Ps-qr`

Reversal:
    gh secret delete CLEANUP_SECRET -R joyyxh/Ps-qr
    gh secret delete QRQUICK_CLEANUP_URL -R joyyxh/Ps-qr
    supabase secrets unset CLEANUP_SECRET --project-ref <PROJECT_REF>
Reversal stops the failing-job loop only; it does not restore deleted files.

## Option B: disable the schedule (RECOMMENDED)

Needs: owner approval for a GitHub workflow state change. This matches decision 4 (cleanup stays disabled).

Before-state check (read-only):
    ./verify_cleanup_state.sh        # workflow state: active

Command:
    gh workflow disable cleanup-files.yml -R joyyxh/Ps-qr

After-state check: `gh api repos/joyyxh/Ps-qr/actions/workflows/cleanup-files.yml --jq .state` returns `disabled_manually`, and no new scheduled run appears the next day.

Reversal (restores the schedule exactly as before):
    gh workflow enable cleanup-files.yml -R joyyxh/Ps-qr

Consequence: no scheduled runs. Failures stop. No files are deleted (the same as today). Retention stays as decision 4 describes.

## Option C: leave as is

Needs: nothing.

Consequence: one failed run per day, with no deletions while the secrets are empty. The failures keep appearing in the Actions history. If someone later sets the secrets without a retention decision (see Option A), deletion starts on the next schedule with no further review.

## Recommendation

Option B now. It stops the daily failures, keeps the decision-4 position, and reverses with one command. Option A waits for the retention decision (C-1/M1). Option C is acceptable only until B is approved.

## Files

- `verify_cleanup_state.sh`: read-only; prints the state and last 10 conclusions. Checked: no write verb in the file; run once on 2026-11-12 (exit 0).
- `cleanup_runs_last30.json`: the 22 run records used above.
