-- QRquick 0020: UPI orders, and who may call the auto-print trigger function.
--
-- 1. UPI orders failed with "customer payment method is immutable" (42501).
--    The four-argument place_order (0008, 0009) inserted the order as cash, then changed it to
--    UPI in a second statement. guard_qrquick_payment_intent (0008) forbids that change, so every
--    UPI order was refused. Fix: the order is written with its payment method in the same insert.
--    The guard is unchanged, so the payment method is still immutable once the order exists.
--
--    The body below is the 0003 place_order body, moved into _place_order_core with the payment
--    fields added to the insert. Both public overloads keep their signatures, grants and output.
--
-- 2. auto_print_on_approval (0018) is a SECURITY DEFINER trigger function, but anon and
--    authenticated could call it directly through the API. Triggers do not need EXECUTE to fire,
--    so revoking it stops the direct calls without affecting auto print.

create or replace function public._place_order_core(
  p_shop_slug      text,
  p_items          jsonb,
  p_customer_note  text,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop     public.shops%rowtype;
  v_priced   jsonb;
  v_total    bigint;
  v_order_id uuid;
  v_code     text;
  v_line     jsonb;
  v_note     text;
  v_claimed  integer;
begin
  if p_payment_method not in ('cash', 'upi') then
    raise exception 'choose cash or upi payment' using errcode = '22023';
  end if;

  v_note := nullif(trim(coalesce(p_customer_note, '')), '');
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'customer note is too long' using errcode = '22023';
  end if;

  select * into v_shop from public.shops where slug = lower(trim(p_shop_slug));
  if not found then
    raise exception 'shop not found' using errcode = 'P0002';
  end if;
  if not v_shop.is_open then
    raise exception 'shop is closed' using errcode = 'P0001';
  end if;

  v_priced := public._price_order_items(v_shop.id, p_items);
  v_total  := (v_priced->>'total_paise')::bigint;

  v_code := public.new_tracking_code();
  -- The payment method is written here, in the same insert that creates the order.
  -- Cash starts unpaid until the owner records receipt; UPI starts pending until the owner verifies it.
  insert into public.orders (
    shop_id, tracking_code, total_paise, customer_note,
    customer_payment_method, payment_status, payment_channel
  ) values (
    v_shop.id, v_code, v_total, v_note,
    p_payment_method,
    case when p_payment_method = 'upi' then 'pending' else 'unpaid' end,
    case when p_payment_method = 'upi' then 'online' else null end
  )
  returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(v_priced->'items') loop
    -- Claim first. The update only matches while the file is still unclaimed, so two
    -- orders racing for the same file cannot both succeed. The claim is in this
    -- transaction, so a failure anywhere rolls back the order too.
    update public.customer_files
       set claimed_order_id = v_order_id
     where id = (v_line->>'file_id')::uuid
       and shop_id = v_shop.id
       and claimed_order_id is null
       and expires_at > now();
    get diagnostics v_claimed = row_count;
    if v_claimed <> 1 then
      raise exception 'file not found or no longer available' using errcode = 'P0002';
    end if;

    insert into public.order_items (
      order_id, shop_id, service_id, service_name, pricing_unit,
      file_id, file_name, page_count, copies, colour, duplex,
      billable_units, unit_price_paise, amount_paise
    ) values (
      v_order_id, v_shop.id,
      (v_line->>'service_id')::uuid,
      v_line->>'service_name',
      v_line->>'pricing_unit',
      (v_line->>'file_id')::uuid,
      v_line->>'file_name',
      (v_line->>'page_count')::integer,
      (v_line->>'copies')::integer,
      (v_line->>'colour')::boolean,
      (v_line->>'duplex')::boolean,
      (v_line->>'billable_units')::integer,
      (v_line->>'unit_price_paise')::integer,
      (v_line->>'amount_paise')::integer
    );
  end loop;

  return jsonb_build_object(
    'tracking_code', v_code,
    'status',        'pending',
    'shop_name',     v_shop.name,
    'total_paise',   v_total,
    'items',         v_priced->'items'
  );
end;
$$;

revoke all on function public._place_order_core(text, jsonb, text, text) from public, anon, authenticated;

-- Three-argument overload: unchanged behaviour (cash), kept for existing callers.
create or replace function public.place_order(
  p_shop_slug     text,
  p_items         jsonb,
  p_customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public._place_order_core(p_shop_slug, p_items, p_customer_note, 'cash');
end;
$$;

revoke execute on function public.place_order(text, jsonb, text) from public;
grant execute on function public.place_order(text, jsonb, text) to anon, authenticated;

-- Four-argument overload: the customer chooses cash or UPI. UPI needs a QR on the shop first.
create or replace function public.place_order(
  p_shop_slug      text,
  p_items          jsonb,
  p_customer_note  text,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
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

revoke execute on function public.place_order(text, jsonb, text, text) from public;
grant execute on function public.place_order(text, jsonb, text, text) to anon, authenticated;

-- Triggers fire without EXECUTE, so the auto-print trigger keeps working after this revoke.
revoke execute on function public.auto_print_on_approval() from public, anon, authenticated;
