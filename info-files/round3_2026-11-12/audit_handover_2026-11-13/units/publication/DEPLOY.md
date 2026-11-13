# Admin bundle: deployment note (NOT DEPLOYED)

Status: the bundle is built and checked locally. It is not uploaded anywhere. Hosting is not chosen (RB-02). Admin identity and MFA are not decided (RB-01). Do not deploy from this note.

## What the bundle is

- A static folder: `index.html`, `styles.css`, `robots.txt`, `config.js`, and the runtime files in `src/`.
- No server code and no build step on the host.
- `config.js` is empty in the repository. The only value allowed at deploy time is a publishable key. A secret key (`sb_secret_…`) or a `service_role` key must never appear.
- Tests, `package.json` and the README are not shipped.

## Commands (local)

Build from the admin source. The output folder must not exist yet:

    build-bundle.sh <admin_source_dir> <bundle_out_dir>

Check the built bundle before any use:

    node check-bundle.mjs <bundle_out_dir>

The check runs three steps. It compares `SHA256SUMS` with every file. It runs the admin's `config-guard` on `config.js`, which accepts at most a publishable key. It scans for secret values: `sb_secret_` keys, private keys, and any JWT whose role is `service_role`. Negative tests for the checker are in `../logs/bundle_checker_negative_tests.log`.

## Before any deployment (all required, none granted)

1. Owner decides the hosting target (RB-02) and the admin identity and MFA approach (RB-01).
2. Owner approves the staging project (EX-02). Staging checks S1 to S9 and the two-session tests (RB-12) run there, not on the live project.
3. Owner decides D-MIG. The admin code and tests read migration files by path, so the decision affects this bundle's tests (`dmig_option_b/IMPACT_ANALYSIS.md`).
4. Hosted RPC integration is unverified. Only a local, mocked run has been done.
5. Rebuild from the approved source, then run `check-bundle.mjs` and `sha256sum -c SHA256SUMS`. Record the output.
6. Re-run the browser smoke on localhost against the built bundle (last recorded result 65 of 65 pass).

## Rollback

The bundle is static. Keep the previous bundle folder and its `SHA256SUMS`. A rollback is re-publishing the previous folder. Because nothing is hosted yet, there is nothing to roll back today.

## Out of scope

- No Supabase setting, no secret, no edge function secret.
- No production deployment.
- No licence enforcement. Stage 7F is not built.
