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
