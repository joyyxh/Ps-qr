-- Rollback for migrations 0025, 0024 and 0023, in that order. Run as ONE transaction (psql -1).
-- It changes no table data. Rolling back 0015 to 0022 is not done by SQL: restore the backup instead
-- (see RUNBOOK_FULL_CHAIN.md). Converted accounts (0024 claims) are NOT reverted here: a claim changes an
-- auth user's address and password, so to undo a claim restore the backup.

-- ----- 0025 -----
-- Original place_order overloads (0020), without the rate limit.
create or replace function public.place_order(p_shop_slug text, p_items jsonb, p_customer_note text default null::text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
begin
  return public._place_order_core(p_shop_slug, p_items, p_customer_note, 'cash');
end;
$$;

create or replace function public.place_order(p_shop_slug text, p_items jsonb, p_customer_note text, p_payment_method text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_result jsonb;
  v_order  public.orders%rowtype;
  v_shop   public.shops%rowtype;
begin
  if p_payment_method not in ('cash', 'upi') then
    raise exception 'choose cash or upi payment' using errcode = '22023';
  end if;

  select * into v_shop from public.shops where slug = lower(trim(p_shop_slug));
  if not found then
    raise exception 'shop not found' using errcode = 'P0002';
  end if;
  if p_payment_method = 'upi' and v_shop.payment_qr_path is null then
    raise exception 'this shop has not configured UPI payment yet' using errcode = '22023';
  end if;

  v_result := public._place_order_core(p_shop_slug, p_items, p_customer_note, p_payment_method);

  select * into v_order from public.orders where tracking_code = v_result->>'tracking_code';

  return v_result || jsonb_build_object(
    'payment_method', v_order.customer_payment_method,
    'payment_status', v_order.payment_status,
    'cash_payment_timing', v_shop.cash_payment_timing
  );
end;
$$;

revoke execute on function public.place_order(text, jsonb, text) from public;
grant  execute on function public.place_order(text, jsonb, text) to anon, authenticated;
revoke execute on function public.place_order(text, jsonb, text, text) from public;
grant  execute on function public.place_order(text, jsonb, text, text) to anon, authenticated;

-- search_path back to bare "public" for the functions 0025 changed.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef and p.proconfig @> array['search_path=public, pg_temp']
  loop
    execute format('alter function %s set search_path = public', r.fn);
  end loop;
end $$;

-- Trigger functions were executable by everyone before.
grant execute on function public.enforce_qrquick_minimum_order() to public;
grant execute on function public.forbid_order_item_changes() to public;
grant execute on function public.guard_order_changes() to public;
grant execute on function public.guard_qrquick_payment_intent() to public;

-- ----- 0024 -----
drop function if exists public.owner_claim_sync_identity(uuid, text);
drop function if exists public.owner_claim_undo(uuid);
drop function if exists public.owner_claim_apply(uuid, text, text, text, text[]);
drop function if exists public.owner_unconsume_claim_code(uuid, text);
drop function if exists public.owner_consume_claim_code(uuid, text);
drop function if exists public.owner_issue_claim_code(uuid, integer);
drop function if exists public.owner_legacy_user_for(text);
drop function if exists public.owner_is_legacy(uuid);
drop table if exists public.owner_claim_codes;

-- ----- 0023 -----
drop policy if exists memberships_owner_insert on public.shop_memberships;
drop policy if exists memberships_owner_update on public.shop_memberships;
drop policy if exists memberships_owner_delete on public.shop_memberships;
drop policy if exists services_owner_insert on public.services;
drop policy if exists services_owner_update on public.services;
drop policy if exists services_owner_delete on public.services;
create policy memberships_owner_write on public.shop_memberships
  for all to authenticated using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));
create policy services_owner_write on public.services
  for all to authenticated using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));
drop index if exists public.owner_policy_acceptances_kind_version_idx;
drop index if exists public.owner_recovery_codes_user_id_idx;
drop index if exists public.print_agent_pairings_shop_id_idx;
drop index if exists public.print_jobs_agent_shop_idx;
