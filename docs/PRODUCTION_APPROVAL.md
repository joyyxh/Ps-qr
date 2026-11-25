# Production approval package (nothing here has been run)

Target: production Supabase project `qvnwqrevgyootaaunrto`. **Nothing in this file has been applied.**
Every step needs the owner's explicit approval. Staging is `nbzojqlqkrydcjtogwrb` and is separate.

## Why this is bigger than "0021 to 0023"

Read-only inspection on 2026-11-25 shows production is at about migration 0009 and has none of the
print, licence, owner-username or hardening objects (8 public tables against 16 on staging). Applying
only 0021 to 0023 would fail or leave a mixed schema. The plan is the whole chain, rehearsed first.

## Preconditions (all must be true before approval is asked)

1. Rehearsal on a **production-shaped copy** (restore of a fresh backup into a scratch project), applying the
   chain below, then the full SQL regression suites and `owner-auth-live.mjs` against it. Result recorded.
2. The licence migrations 0015 to 0017 are applied and tested on staging first (they are missing there too).
3. Owner decisions made: B4 (legacy owners), B8 (keep the email provider), B3 and B1 dashboard toggles.
4. A backup is taken and its restore tested (Supabase backups or `pg_dump` of `public` and `auth`).

## Ordered plan

| # | Action | Expected effect | Rollback |
|---|---|---|---|
| 1 | Read-only preflight: `list_migrations`, `list_tables`, row counts, advisors | Confirms the map in `AUTH_REDESIGN.md` section 7 is still true | none needed |
| 2 | Backup, record its id and time | Restore point | n/a |
| 3 | Repair migration history for 0001 to 0009 (names differ) and register the two remote-only entries, using `supabase migration repair` metadata only | History matches the repo; no schema change | `migration repair` reverse; metadata only |
| 4 | Apply 0010, then 0015 to 0020 in order, one at a time, checking after each | Print agents, licences, auto-print, UPI hardening | Restore from backup (these create objects and alter functions) |
| 5 | Apply 0021, then 0022, then 0023 | Username tables, deferred owner guard, split write policies, indexes | 0023: recreate `memberships_owner_write` and `services_owner_write` as `FOR ALL` and drop the new indexes. 0021 and 0022: restore from backup (the guard blocks email rows) |
| 6 | Deploy `owner-auth` (`verify_jwt=false`) and set its secrets in the dashboard | Username sign-up, sign-in, recovery, breach check | Redeploy the previous version or remove the function |
| 7 | Run `owner-auth-live.mjs` against production with the publishable key (creates test accounts: approve this) | 21/21 | Delete the QA accounts |
| 8 | Legacy owners (3 accounts, 2 without a password): apply the B4 option the owner chose | Each owner can sign in with a username | Per-account |
| 9 | Dashboard: turn email sign-up off, leaked-password protection on, **keep the email provider on** | Closes B1 and B3 | Toggle back |
| 10 | Build and sign Android and Windows releases (owner supplies keystore and certificate), publish the website | Customer release | Withdraw the release |

Risks: migration 0022's guard refuses every email-style row on `auth.users`, so step 8 must happen with or
immediately after step 5 or legacy owners cannot be re-created. The breach check fails closed, so a
HaveIBeenPwned outage pauses sign-ups. Unsigned installers show a warning on Windows.

Exact SQL is the files in `supabase/migrations/` (0010, 0015 to 0023), applied unchanged.
