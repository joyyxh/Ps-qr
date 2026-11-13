-- =========================================================
-- Migration 0013: the order workflow. Requires 0001-0012.
--
-- The order the shop runs. Each step is a separate owner or customer action:
--   1. the customer requests the order; no payment yet            place_order
--   2. the owner accepts it (pending -> approved)                  owner status change (guard, 0001)
--   3. the customer pays; the owner records cash or UPI            set_order_payment
--   4. the owner approves printing (approved -> printing, files queued)
--                                                                 approve_order_for_print (0010, 0011)
--   5. the print agent prints queued files of a paid order that is printing or ready (0012)
--
-- What changes here
--   * place_order (four arguments): the customer's cash or UPI choice is written when the order
--     is created, and the order starts unpaid. Nothing is due until the owner accepts it.
--     Before this migration the UPI choice was written by an UPDATE after the insert (0009), and
--     the payment-method guard (0008) refused that change, so every UPI order was refused.
--   * place_order (three arguments, from 0011): kept for existing callers. It places a cash order.
--   * set_order_payment: a payment can be recorded only after the owner has accepted the order.
--     A pending (not yet accepted) order takes no cash or UPI payment. Clearing a pending payment,
--     refunds and the other payment rules are unchanged.
--
-- Checked, not changed
--   * Recording a payment never queues or starts printing. Only approve_order_for_print does that.
--   * approve_order_for_print needs an approved order that is paid.
--   * The payment guard (0008) still refuses printing, ready or completed without a paid order.
--   * order_is_printable (0012, corrected there) allows only printing and ready orders.
--
-- Not applied to production. Tested only on the local scratch database.
-- Rollback: supabase/rollbacks/0013_order_workflow.down.sql
-- =========================================================

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
  v_shop     public.shops%rowtype;
  v_priced   jsonb;
  v_total    bigint;
  v_order_id uuid;
  v_code     text;
  v_line     jsonb;
  v_charge   jsonb;
  v_note     text;
  v_claimed  integer;
begin
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

  -- The payment method is written with the order. Changing it afterwards is refused (0008).
  if p_payment_method not in ('cash', 'upi') then
    raise exception 'choose cash or upi payment' using errcode = '22023';
  end if;
  if p_payment_method = 'upi' and v_shop.payment_qr_path is null then
    raise exception 'this shop has not configured UPI payment yet' using errcode = '22023';
  end if;

  v_priced := public._price_order_items(v_shop.id, p_items);
  v_total  := (v_priced->>'total_paise')::bigint;

  v_code := public.new_tracking_code();
  insert into public.orders (shop_id, tracking_code, total_paise, customer_note,
                             customer_payment_method, payment_status, payment_channel)
  values (v_shop.id, v_code, v_total, v_note, p_payment_method, 'unpaid', null)
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
      billable_units, unit_price_paise, amount_paise,
      paper_size, paper_surcharge_paise
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
      (v_line->>'amount_paise')::integer,
      v_line->>'paper_size',
      (v_line->>'paper_surcharge_paise')::integer
    );
  end loop;

  for v_charge in select * from jsonb_array_elements(v_priced->'charges') loop
    insert into public.order_charges (
      order_id, shop_id, label, basis, quantity, amount_paise, total_paise
    ) values (
      v_order_id, v_shop.id,
      v_charge->>'label',
      v_charge->>'basis',
      (v_charge->>'quantity')::integer,
      (v_charge->>'amount_paise')::integer,
      (v_charge->>'total_paise')::integer
    );
  end loop;

  return jsonb_build_object(
    'tracking_code', v_code,
    'status',        'pending',
    'shop_name',     v_shop.name,
    'total_paise',   v_total,
    'items',         v_priced->'items',
    'charges',       v_priced->'charges',
    'payment_method',       p_payment_method,
    'payment_status',       'unpaid',
    'cash_payment_timing',  v_shop.cash_payment_timing
  );
end;
$$;

create or replace function public.place_order(
  p_shop_slug text,
  p_items jsonb,
  p_customer_note text default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.place_order(p_shop_slug, p_items, p_customer_note, 'cash');
$$;

create or replace function public.set_order_payment(
  p_order_id uuid,
  p_action   text,
  p_channel  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order       public.orders%rowtype;
  v_status      text;
  v_channel     text;
  v_paid_at     timestamptz;
  v_refunded_at timestamptz;
  v_refund      integer;
  v_row         public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if not public.is_shop_owner(v_order.shop_id) then
    raise exception 'you do not have permission to change this order' using errcode = '42501';
  end if;

  -- A payment is taken only after the owner has accepted the order (pending -> approved).
  if p_action in ('set_pending', 'set_paid') and v_order.status = 'pending' then
    raise exception 'accept the order before taking a payment' using errcode = '22023';
  end if;

  v_status      := v_order.payment_status;
  v_channel     := v_order.payment_channel;
  v_paid_at     := v_order.paid_at;
  v_refunded_at := v_order.refunded_at;
  v_refund      := v_order.refund_paise;

  if p_action = 'set_pending' then
    if v_status <> 'unpaid' then
      raise exception 'only an unpaid order can be marked as payment pending' using errcode = '22023';
    end if;
    if p_channel is distinct from 'online' then
      raise exception 'a pending payment has to be online' using errcode = '22023';
    end if;
    if v_order.status in ('cancelled', 'rejected') then
      raise exception 'a cancelled or rejected order cannot take a payment' using errcode = '22023';
    end if;
    v_status  := 'pending';
    v_channel := 'online';

  elsif p_action = 'set_paid' then
    if v_status not in ('unpaid', 'pending') then
      raise exception 'this order is already paid or refunded' using errcode = '22023';
    end if;
    if p_channel is null or p_channel not in ('cash', 'online') then
      raise exception 'choose cash or online' using errcode = '22023';
    end if;
    if v_order.status in ('cancelled', 'rejected') then
      raise exception 'a cancelled or rejected order cannot take a payment' using errcode = '22023';
    end if;
    v_status  := 'paid';
    v_channel := p_channel;
    v_paid_at := now();

  elsif p_action = 'set_unpaid' then
    if v_status <> 'pending' then
      raise exception 'only a pending payment can be cleared' using errcode = '22023';
    end if;
    v_status  := 'unpaid';
    v_channel := null;

  elsif p_action = 'refund' then
    if v_status <> 'paid' then
      raise exception 'only a paid order can be refunded' using errcode = '22023';
    end if;
    v_status      := 'refunded';
    v_refunded_at := now();
    v_refund      := v_order.total_paise;

  else
    raise exception 'unknown payment action' using errcode = '22023';
  end if;

  update public.orders
     set payment_status  = v_status,
         payment_channel = v_channel,
         paid_at         = v_paid_at,
         refunded_at     = v_refunded_at,
         refund_paise    = v_refund
   where id = p_order_id
  returning * into v_row;

  return jsonb_build_object(
    'id',              v_row.id,
    'payment_status',  v_row.payment_status,
    'payment_channel', v_row.payment_channel,
    'paid_at',         v_row.paid_at,
    'refund_paise',    v_row.refund_paise
  );
end;
$$;
