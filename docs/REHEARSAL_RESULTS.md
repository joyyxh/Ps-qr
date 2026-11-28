# Full-chain rehearsal on a disposable copy (nothing applied to staging or production)

Script: `supabase/deploy/full_chain/rehearse_chain.sh` (runs on a throwaway PostgreSQL; CI runs it on PostgreSQL 17 in
`owner-catch-up-rehearsal.yml`). Local run on PostgreSQL 16.

## The copy

Production shape on migrations 0001 to 0009: 4 auth users (3 legacy owners, two with **no password**, and one staff
user), 3 shops, 4 owner/staff memberships, 4 services (one inactive), 3 orders, 2 order items, 2 claimed customer files,
8 feature-catalog rows, 3 order events. A `pg_dump -Fc` backup is taken before anything is applied.

## Order applied, each migration in its own transaction

`0010_print_agents`, `0015_licence_foundation`, `0016_licence_admin_rpcs`, `0017_licence_admin_read_rpcs`,
`0018_auto_print`, `0019_advisor_fixes`, `0020_upi_order_and_print_hardening`, `0021_owner_username_auth`,
`0022_owner_guard_at_commit`, `0023_owner_write_policies_and_indexes`, `0024_owner_legacy_claim`,
`0025_security_hardening`. The script refuses to run if the migration folder differs from this list (so a forgotten or
Chain A file is caught). Dependencies: 0015 needs `is_shop_owner` (0001); 0016 and 0017 need 0015; 0021 needs 0010's
rate limiter and `pgcrypto`; 0024 needs 0021 and `owner_replace_recovery_codes`; 0025 needs 0010's `consume_rate_limit`.

## Results

| Step | Result |
|---|---|
| After **each** of the 12 migrations | Row digests of customer_files, feature_catalog, order_events, order_items, orders, services, shop_memberships, shops and the auth user list (id, email, has-password, app metadata) **identical to the baseline** |
| Access probe (19 checks, real `anon` / `authenticated` roles with JWT claims) | 19 ok, 0 not ok: an owner sees only their shop, orders, memberships and inactive services; cannot read, edit or add to another shop; can add and remove staff in their own shop; staff can read but not write services; visitors see active services only, cannot read orders or call the owner-check function |
| Claim of owner "ravi" (code issued, consumed, database step, auth update, identity sync) | Same user id; only his email, `owner_flow` and password changed; all eight data tables byte-identical; other two owners still legacy; 10 recovery codes stored; access probe 19 ok again |
| Rollback `rollback_0023_0025.sql` (one transaction) on a fresh chain | Schema fingerprint and every function definition equal the state after 0022 (default privileges print differently but are the same); re-applying 0023, 0024, 0025 gives the same state as the first application |
| Recovery: `pg_restore` of the pre-chain backup | Rows, users and structure equal the baseline; the whole chain then applies again with data unchanged |

Also run on the same migrations: all 10 base SQL suites (`run_base_suites.sh`, 344 checks including 70 for the claim and
12 for hardening), the owner-guard probe, and the web tests (276).

## What this does not prove

* It is a local copy built from the repository, not a restore of the real production backup. Step 1 of
  `PRODUCTION_APPROVAL.md` still requires that restore.
* Supabase's own schemas (`auth`, `storage`, `extensions`) are stand-ins here. The only places the migrations touch them are
  `auth.users`, `auth.identities`, `extensions.crypt` and `gen_random_bytes`.
* Rollback of 0015 to 0022 is by restore from backup, which is demonstrated above.
