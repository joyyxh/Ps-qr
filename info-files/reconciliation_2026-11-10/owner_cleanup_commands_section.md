
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
