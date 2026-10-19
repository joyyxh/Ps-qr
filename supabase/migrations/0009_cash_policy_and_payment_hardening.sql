-- QRquick production hardening: owner cash policy, minimum order, and payment guards.

alter table public.shops
  add column cash_payment_timing text not null default 'counter'
    check (cash_payment_timing in ('counter', 'collection')),
  add column minimum_order_paise integer not null default 0
    check (minimum_order_paise between 0 and 1000000);

grant update (cash_payment_timing, minimum_order_paise) on public.shops to authenticated;

create or replace function public.enforce_qrquick_minimum_order()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_minimum integer;
begin
  select minimum_order_paise into v_minimum from public.shops where id = new.shop_id;
  if coalesce(v_minimum, 0) > 0 and new.total_paise < v_minimum then
    raise exception 'order total is below this shop minimum' using errcode = '22023';
  end if;
  return new;
end;
$$;

 drop trigger if exists orders_qrquick_minimum_order on public.orders;
create trigger orders_qrquick_minimum_order
before insert on public.orders
for each row execute function public.enforce_qrquick_minimum_order();

-- Require a configured shop QR before an anonymous customer can choose UPI.
create or replace function public.place_order(
  p_shop_slug text,
  p_items jsonb,
  p_customer_note text,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_code text;
  v_order public.orders%rowtype;
  v_shop public.shops%rowtype;
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

  v_result := public.place_order(p_shop_slug, p_items, p_customer_note);
  v_code := v_result->>'tracking_code';

  update public.orders
     set customer_payment_method = p_payment_method,
         payment_status = case when p_payment_method = 'upi' then 'pending' else 'unpaid' end,
         payment_channel = case when p_payment_method = 'upi' then 'online' else null end
   where tracking_code = v_code
  returning * into v_order;

  return v_result || jsonb_build_object(
    'payment_method', v_order.customer_payment_method,
    'payment_status', v_order.payment_status,
    'cash_payment_timing', v_shop.cash_payment_timing
  );
end;
$$;

revoke execute on function public.place_order(text, jsonb, text, text) from public;
grant execute on function public.place_order(text, jsonb, text, text) to anon, authenticated;

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
