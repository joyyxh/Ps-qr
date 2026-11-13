-- QRquick customer payment intent and fulfilment guard.
-- Existing payment ledger columns remain authoritative for owner verification.

alter table public.orders
  add column customer_payment_method text not null default 'cash'
    check (customer_payment_method in ('cash', 'upi')),
  add column payment_reference text
    check (payment_reference is null or char_length(payment_reference) between 1 and 120),
  add column payment_rejection_reason text
    check (payment_rejection_reason is null or char_length(payment_rejection_reason) between 1 and 300),
  add column payment_verified_by uuid references auth.users(id),
  add column payment_verified_at timestamptz;

create index orders_payment_queue_idx
  on public.orders (shop_id, payment_status, created_at desc);

-- Customer payment method is an immutable order intent. Payment status itself
-- remains owner-controlled through set_order_payment.
create or replace function public.guard_qrquick_payment_intent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.customer_payment_method is distinct from old.customer_payment_method then
    raise exception 'customer payment method is immutable' using errcode = '42501';
  end if;

  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    new.payment_verified_by := auth.uid();
    new.payment_verified_at := coalesce(new.payment_verified_at, now());
    new.payment_rejection_reason := null;
  end if;

  if new.payment_status = 'unpaid' and old.payment_status = 'pending' then
    new.payment_rejection_reason := coalesce(new.payment_rejection_reason, 'Payment was not verified by the shop.');
  end if;

  if new.status in ('printing', 'ready', 'completed')
     and old.status is distinct from new.status
     and new.payment_status <> 'paid' then
    raise exception 'payment must be verified before printing or completion' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger orders_qrquick_payment_guard
before update on public.orders
for each row execute function public.guard_qrquick_payment_intent();

-- Four-argument overload keeps existing integrations working while allowing
-- anonymous customers to choose cash or UPI. UPI starts as pending; cash starts
-- unpaid until the owner records receipt through set_order_payment.
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
begin
  if p_payment_method not in ('cash', 'upi') then
    raise exception 'choose cash or upi payment' using errcode = '22023';
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
    'payment_status', v_order.payment_status
  );
end;
$$;

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
    'payment_rejection_reason', o.payment_rejection_reason
  )
  from public.orders o
  join public.shops s on s.id = o.shop_id
  where o.tracking_code = upper(trim(p_code));
$$;

revoke execute on function public.place_order(text, jsonb, text, text) from public;
grant execute on function public.place_order(text, jsonb, text, text) to anon, authenticated;
revoke execute on function public.track_order(text) from public;
grant execute on function public.track_order(text) to anon, authenticated;
