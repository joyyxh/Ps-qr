-- EMERGENCY ROLLBACK of the owner catch-up (migrations 0010, 0018, 0019).
-- NOT part of the normal deployment. Run only with the owner's approval, and only after a backup of the
-- current state exists (backup_and_verify.sh).
--
-- Removes: every object the three migrations add (four print tables, the auto-print switch and trigger,
-- the print and rate-limit functions, the seven indexes from 0019, and the two new columns).
-- Restores: track_order to its 0009 definition and grants; expired_customer_file_paths to its 0007
-- definition and grants; memberships_read to its 0001 definition.
--
-- Refuses, changing nothing, if a print job or print agent exists, if automatic printing is on for any
-- shop, or if any customer file is marked deleted. Dropping those would delete real operational data.
-- Rate-limit counters are not guarded: they are short-lived, and dropping them only resets the
-- customer tracking limit.
--
-- Does NOT delete rows that apply_migration wrote to supabase_migrations.schema_migrations. Removing
-- ledger rows would rewrite history, so that is a separate decision for the owner.
--
-- Safe on a partly applied catch-up: every drop uses IF EXISTS.
-- Run with:  psql -X -v ON_ERROR_STOP=1 -f rollback.sql   (this file contains its own BEGIN and COMMIT)

begin;

-- 0. Guard. Any error here stops the file before a single change is made.
do $$
declare
  n bigint;
begin
  if to_regclass('public.print_jobs') is not null then
    execute 'select count(*) from public.print_jobs' into n;
    if n > 0 then raise exception 'ROLLBACK REFUSED: public.print_jobs has % rows. Nothing was changed.', n; end if;
  end if;
  if to_regclass('public.print_agents') is not null then
    execute 'select count(*) from public.print_agents' into n;
    if n > 0 then raise exception 'ROLLBACK REFUSED: public.print_agents has % rows. Nothing was changed.', n; end if;
  end if;
  if to_regclass('public.print_agent_pairings') is not null then
    execute 'select count(*) from public.print_agent_pairings' into n;
    if n > 0 then raise exception 'ROLLBACK REFUSED: public.print_agent_pairings has % rows. Nothing was changed.', n; end if;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'shops' and column_name = 'auto_print_enabled') then
    execute 'select count(*) from public.shops where auto_print_enabled' into n;
    if n > 0 then raise exception 'ROLLBACK REFUSED: automatic printing is on for % shop(s). Nothing was changed.', n; end if;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'customer_files' and column_name = 'storage_deleted_at') then
    execute 'select count(*) from public.customer_files where storage_deleted_at is not null' into n;
    if n > 0 then raise exception 'ROLLBACK REFUSED: % customer file(s) are marked deleted. Nothing was changed.', n; end if;
  end if;
end $$;

-- 1. Restore the replaced functions. The bodies and grants are copied from 0009 and 0007.
create or replace function public.track_order(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tracking_code', o.tracking_code,
    'status', o.status,
    'total_paise', o.total_paise,
    'shop_name', s.name,
    'created_at', o.created_at,
    'payment_method', o.customer_payment_method,
    'payment_status', o.payment_status,
    'payment_rejection_reason', o.payment_rejection_reason,
    'cash_payment_timing', s.cash_payment_timing
  )
  from public.orders o
  join public.shops s on s.id = o.shop_id
  where o.tracking_code = upper(trim(p_code));
$$;

revoke execute on function public.track_order(text) from public;
grant execute on function public.track_order(text) to anon, authenticated;

create or replace function public.expired_customer_file_paths(p_limit integer default 100)
returns table (id uuid, storage_path text)
language sql
security definer
set search_path = public
as $$
  select id, storage_path
  from public.customer_files
  where claimed_order_id is null
    and expires_at <= now()
  order by expires_at
  limit least(greatest(coalesce(p_limit, 100), 1), 1000)
$$;

revoke all on function public.expired_customer_file_paths(integer) from public, anon, authenticated;
grant execute on function public.expired_customer_file_paths(integer) to service_role;

-- 2. Restore the membership read policy to its 0001 definition.
drop policy if exists memberships_read on public.shop_memberships;
create policy memberships_read on public.shop_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_shop_owner(shop_id));

-- 3. Remove the auto-print trigger and its functions (0018). The trigger goes first.
drop trigger if exists orders_auto_print on public.orders;
drop function if exists public.auto_print_on_approval();
drop function if exists public._queue_order_for_print(uuid, uuid);
drop function if exists public.set_auto_print(uuid, boolean);

-- 4. Remove the print and rate-limit functions added by 0010 (approve_order_for_print is replaced by 0018).
drop function if exists public.approve_order_for_print(uuid);
drop function if exists public.create_print_agent_pairing(uuid);
drop function if exists public.owner_print_status(uuid);
drop function if exists public.revoke_print_agent(uuid);
drop function if exists public.set_print_agent_printer(uuid, text);
drop function if exists public.retry_print_job(uuid, boolean);
drop function if exists public.consume_print_pairing(text, text, text, text, text);
drop function if exists public.agent_heartbeat(text, text, jsonb);
drop function if exists public.agent_claim_next_job(text);
drop function if exists public.agent_mark_printing(text, uuid, integer);
drop function if exists public.agent_finish_job(text, uuid, integer, text, text, text);
drop function if exists public.mark_customer_file_deleted(uuid);
drop function if exists public.purge_old_rate_limits();
drop function if exists public.recover_expired_print_jobs(uuid);
drop function if exists public.agent_for_token(text);
drop function if exists public.print_code_hash(text);
drop function if exists public.new_print_pairing_code();
drop function if exists public.request_client_key();
drop function if exists public.consume_rate_limit(text, integer, integer);

-- 5. Remove the seven indexes added by 0019 (none of them existed before the catch-up).
drop index if exists public.customer_files_shop_id_idx;
drop index if exists public.customer_files_claimed_order_id_idx;
drop index if exists public.order_items_file_same_shop_idx;
drop index if exists public.order_items_order_id_shop_id_idx;
drop index if exists public.order_items_service_id_shop_id_idx;
drop index if exists public.orders_payment_verified_by_idx;
drop index if exists public.shop_memberships_user_id_idx;

-- 6. Remove the tables and columns added by 0010 and 0018.
drop table if exists public.print_jobs;
drop table if exists public.print_agent_pairings;
drop table if exists public.print_agents;
drop table if exists public.rate_limits;
alter table public.customer_files drop column if exists storage_deleted_at;
alter table public.shops drop column if exists auto_print_enabled;

-- 7. Verify that nothing from the catch-up is left. Any leftover stops the file, so nothing is committed.
do $$
begin
  if to_regclass('public.print_jobs') is not null
     or to_regclass('public.print_agents') is not null
     or to_regclass('public.print_agent_pairings') is not null
     or to_regclass('public.rate_limits') is not null then
    raise exception 'ROLLBACK INCOMPLETE: a print table still exists';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public'
               and ((table_name = 'shops' and column_name = 'auto_print_enabled')
                 or (table_name = 'customer_files' and column_name = 'storage_deleted_at'))) then
    raise exception 'ROLLBACK INCOMPLETE: a catch-up column still exists';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.proname in ('owner_print_status', 'set_auto_print', 'auto_print_on_approval',
                                 'consume_rate_limit', 'request_client_key', 'approve_order_for_print')) then
    raise exception 'ROLLBACK INCOMPLETE: a catch-up function still exists';
  end if;
end $$;

commit;
