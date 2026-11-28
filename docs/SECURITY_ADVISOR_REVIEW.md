# Supabase security advisor review (staging, 2026-11-25, read-only)

Staging reports 4 `anon` and 22 `authenticated` "SECURITY DEFINER function executable" warnings, plus leaked-password
protection (see `DASHBOARD_SETTINGS.md`) and 9 "RLS enabled, no policy" notes. Each was checked against the function
source and the live grants. Fixes are in migration **0025** (not applied).

## Public functions (anon): place_order (2 overloads), quote_order, track_order

Intentionally public: customers have no account.

| Function | Reads/writes | Finding | Action |
|---|---|---|---|
| `place_order` (both) | Inserts an order, claims uploaded files | **Real gap: no rate limit.** Anyone could create unlimited orders and claim other people's uploaded files for a shop | **Fixed in 0025**: 60 orders per hour per connection (same limiter and client key as `track_order`), error `54000`. Numbers are an owner decision |
| `quote_order` | Read-only price of a basket for an open shop | Low. It exposes only what a visitor can already read (open shops, active prices). Limiting it needs it to become `VOLATILE`, which changes how PostgREST calls it | **Left as is, with this reason** |
| `track_order` | Returns one order by tracking code | Already rate limited at 30 per minute per connection; a code has about 40 bits | **Left as is** |
| `_place_order_core` and other `_` helpers | internal | Not executable by anon or authenticated | none |
| legacy 3-argument `place_order` | cash only | Same path as above, now limited | kept for old clients |

Checked: all four set a search path, validate every argument, and take no table name from input.

## Signed-in functions (authenticated)

All 15 owner functions (`approve_order_for_print`, `create_print_agent_pairing`, `create_shop`, `owner_print_status`,
`retry_print_job`, `revoke_print_agent`, `set_auto_print`, `set_cancel_reason`, `set_order_payment`, `set_payment_qr`,
`set_print_agent_printer`, `set_shop_features`, `shop_recent_activity`, `shop_stats_daily`, `shop_stats_summary`)
begin with an explicit check: `auth.uid()` is not null and the caller is a member or owner of the shop that owns the
row. Verified by reading each body. They are exercised by `stage1` and `stage3` to `stage9` and by the 19-check access
probe in `supabase/deploy/full_chain/access_probe.sql` (owner A cannot touch shop B).

| Function | Finding | Action |
|---|---|---|
| `is_shop_member`, `is_shop_owner`, `shop_folder_is_mine` | Called by row level security policies as the signed-in user, so they must stay executable. They only answer about `auth.uid()` | Keep. `anon` cannot execute them |
| `create_shop` | Any signed-in account can create shops. Safe today because only username accounts exist (0022 guard) and public signup is to be switched off | **Owner decision:** cap shops per owner? |

## Hardening applied in 0025

* `search_path` for every definer function that pinned `public` is now `public, pg_temp`. With `pg_temp` first, a user
  could shadow a table with a temporary one if a qualifier were ever forgotten. Today every table is qualified, so this is
  defence in depth, not an exploitable bug.
* Four trigger functions were executable through the REST API. Calling them fails ("trigger functions can only be called
  as triggers"), but there is no reason to expose them: `EXECUTE` revoked; triggers still fire.

## RLS-enabled-without-policy notes (9 tables)

`customer_files, legal_documents, owner_policy_acceptances, owner_recovery_codes, owner_usernames, print_agent_pairings,
print_agents, print_jobs, rate_limits`: deliberate. No policy means no access for `anon` and `authenticated`; only the
service role and definer functions touch them. `owner_claim_codes` (0024) follows the same pattern.

## Decisions that need the owner

1. Order limit: 60 per hour per connection is a guess. A busy campus network shares one address. Raise or lower?
2. Cap on shops per owner (`create_shop`)?
3. Keep `quote_order` unlimited (recommended), or accept the `VOLATILE` change and limit it?
