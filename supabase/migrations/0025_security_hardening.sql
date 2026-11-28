-- =========================================================
-- 0025: security hardening found while reviewing the Supabase security advisor. NOT APPLIED anywhere.
-- Run AFTER 0001 to 0024. Safe to re-run. Changes no table, no column and no policy.
--
--   1. place_order (both overloads) had no rate limit. It is public on purpose (customers have no account),
--      but anyone could create unlimited orders and claim uploaded files. Each connection is now limited to
--      60 orders per hour, using the same limiter and client key as track_order. A refused call raises
--      SQLSTATE 54000, the same code track_order uses. The limit is a number the owner may want to change.
--   2. Every SECURITY DEFINER function that pins search_path to "public" now pins "public, pg_temp".
--      With pg_temp first (the default when it is not listed), a signed-in user could create a temporary
--      table with the same name as a real one. Every table in these functions is already schema-qualified,
--      so this is not exploitable today. It makes the guarantee hold if someone forgets a qualifier later.
--   3. Four trigger functions were executable through the REST API by anon and signed-in users. Calling
--      one directly always fails ("trigger functions can only be called as triggers"), so this is not a
--      risk, but there is no reason to expose them. EXECUTE is revoked. Triggers still fire: PostgreSQL
--      checks EXECUTE when a trigger is created, not when it fires.
--
-- Deliberately NOT changed (see docs/SECURITY_ADVISOR_REVIEW.md for each reason):
--   * quote_order and track_order stay public. track_order is already rate limited. quote_order is a read-only
--     price lookup; limiting it needs it to become VOLATILE, which changes how the REST API calls it.
--   * is_shop_member, is_shop_owner and shop_folder_is_mine stay executable by signed-in users. Row level
--     security policies call them as the signed-in user, and they only ever answer about that user.
-- =========================================================

-- 1. Rate-limited place_order overloads. Bodies are the current ones plus the limit at the top.
create or replace function public.place_order(
  p_shop_slug text,
  p_items jsonb,
  p_customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.consume_rate_limit('order:' || public.request_client_key(), 60, 3600) then
    raise exception 'Too many orders from this connection. Wait a while and try again.' using errcode = '54000';
  end if;
  return public._place_order_core(p_shop_slug, p_items, p_customer_note, 'cash');
end;
$$;

create or replace function public.place_order(
  p_shop_slug text,
  p_items jsonb,
  p_customer_note text,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_order  public.orders%rowtype;
  v_shop   public.shops%rowtype;
begin
  if not public.consume_rate_limit('order:' || public.request_client_key(), 60, 3600) then
    raise exception 'Too many orders from this connection. Wait a while and try again.' using errcode = '54000';
  end if;

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

-- 2. pg_temp last in the search_path of every SECURITY DEFINER function that pins exactly "public".
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.proconfig @> array['search_path=public']
       and not (p.proconfig @> array['search_path=public, pg_temp'])
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.fn);
  end loop;
end $$;

-- 3. Trigger functions are not part of the API.
revoke execute on function public.enforce_qrquick_minimum_order() from public, anon, authenticated;
revoke execute on function public.forbid_order_item_changes() from public, anon, authenticated;
revoke execute on function public.guard_order_changes() from public, anon, authenticated;
revoke execute on function public.guard_qrquick_payment_intent() from public, anon, authenticated;
