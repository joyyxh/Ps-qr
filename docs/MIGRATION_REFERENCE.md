# Migration reference: effect, risk, rollback

**Nothing here is applied by this document.** Files are in `supabase/migrations/` and are applied unchanged.
"Tested" means the local PG16 base suites and the PG17 full-chain rehearsal in CI (`docs/REHEARSAL_RESULTS.md`).
"Backup" means: restore the backup taken immediately before that step (Supabase backup or `pg_dump` of `public` and `auth`).

| Migration | Effect | Data risk | Rollback |
|---|---|---|---|
| 0010 print agents | Creates `print_agents`, `print_agent_pairings`, `print_jobs`, `rate_limits` and their functions; drops and recreates `track_order` (adds the 30 per minute limit) | None to existing rows. Brief window where `track_order` does not exist inside the transaction | Backup. Rows are only added |
| 0015 licence foundation | Adds licence tables (`shop_licence_meta`, `licence_coverages`, `licence_audit_log` and others), guard triggers, `platform_admins` | None to existing rows. Creates tables only | Backup (drop the new tables by hand is possible but untested) |
| 0016 licence admin RPCs | Adds `licence_config` and the licence functions the admin panel calls | None | Backup |
| 0017 licence admin read RPCs | Adds three admin read functions and three indexes on `shops` and the audit log | Index builds lock `shops` briefly (tiny table today) | Drop the indexes and functions, or backup |
| 0018 auto print | Adds `set_auto_print` and the order trigger. Off for every shop | None. Auto-print only starts when an owner turns it on | Backup |
| 0019 advisor fixes | Rewrites one read policy (same rule) and adds 7 indexes | None | Drop the indexes; restore the old policy text from 0001 |
| 0020 UPI order fix | Replaces `place_order`, adds `_place_order_core`. Fixes UPI orders failing with 42501 | None to rows. Changes order-creation code: test one cash and one UPI order after | Backup (or re-apply the previous function bodies from 0009) |
| 0021 owner username auth | Adds `owner_usernames`, `owner_recovery_codes`, `owner_policy_acceptances`, `legal_documents`, session revoke function and a guard on `auth.users` | None to existing rows | Backup |
| 0022 guard at commit | Replaces the 0021 guard with a deferred one: new `auth.users` rows must be username accounts. Existing email rows can still sign in | **Behaviour risk:** after this, no email sign-up can create a new account. Legacy owners cannot use the old email sign-up flow to create anything new | Backup. Dropping the trigger restores old behaviour |
| 0023 owner write policies | Splits two `FOR ALL` policies into insert/update/delete, adds foreign-key indexes. Same rules | None | `rollback_0023_0025.sql` (tested: schema equals post-0022) |
| 0024 legacy claim | Adds `owner_claim_codes` and the claim functions (service role only) | None. No code exists until the operator issues one | `rollback_0023_0025.sql` |
| 0025 security hardening | `place_order` limited to 60 orders per hour per client; `search_path` pinned to `public, pg_temp` for definer functions; EXECUTE revoked on four trigger helpers | **Behaviour risk:** shared networks (campus Wi-Fi, one shop's router) share one limit. A refused call is SQLSTATE 54000 | `rollback_0023_0025.sql` |

Order matters: 0010, 0015, 0016, 0017, 0018, 0019, 0020, 0021, 0022, 0023, 0024, 0025. 0017 needs 0015 and 0016.
0020 needs 0010. 0024 needs 0021 and 0022.

After every migration: row counts and the row digests for all existing tables must be unchanged
(`supabase/deploy/full_chain/rehearse_chain.sh` does this on the rehearsal copy and passed).
