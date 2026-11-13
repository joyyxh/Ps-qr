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
--   * A paid order cannot be cancelled or rejected until its refund is recorded
--     (orders_refund_before_stop). Otherwise the order would read Cancelled and Paid together.
--   * The owner's cash timing setting is removed. Cash is always paid after the owner accepts the
--     order and before it prints. The owner can no longer write shops.cash_payment_timing (the
--     column privilege is revoked). The column stays, unused.
--   * Paper sizes on Windows: a shop whose print computer cannot choose a tray refuses A3 and
--     Letter at order time, before any charge (shop_paper_capability, replaced here). Windows never
--     reports a paper list, and the agent refuses any non-A4 job, so such a size is never offered.
--     A chosen printer that reports no paper list counts the same way. Unknown capability (no
--     chosen printer, or a 20-entry list that may be cut short) still follows the owner's offer.
--   * shop_paper_offer (new): the sizes a customer may choose, by shop slug. A size the printer
--     refuses is shown as not offered, so customers never see a size that place_order would refuse.
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

-- ---------- a paid order is refunded before it is cancelled or rejected ----------
-- Only a change of status is refused, so a refunded order can still be cancelled later.
create or replace function public.guard_paid_order_stop()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('cancelled', 'rejected')
     and old.status is distinct from new.status
     and new.payment_status = 'paid' then
    raise exception 'record the refund before cancelling or rejecting a paid order' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_refund_before_stop on public.orders;
create trigger orders_refund_before_stop
before update on public.orders
for each row execute function public.guard_paid_order_stop();

revoke execute on function public.guard_paid_order_stop() from public, anon, authenticated;

-- ---------- the owner's cash timing setting is removed ----------
-- The column stays, unused. A later migration may drop it.
revoke update (cash_payment_timing) on public.shops from authenticated;

-- ---------- printer capability: a size a print computer cannot choose is refused (replaces 0011) ----------
-- The agent that claims a job is not chosen by the customer, so every active computer of the shop
-- must be able to print the size. Returns:
--   'unsupported'  a computer cannot choose the size: a Windows computer (it never reports a paper
--                  list, and the agent refuses a non-A4 job), a chosen printer whose list lacks the size,
--                  or a chosen printer that reports no list (the agent refuses a non-A4 job then too);
--   'unknown'      no active computer, a computer with no chosen printer, a chosen printer missing from
--                  its report, or a 20-entry list that may be cut short. The shop's own offer decides;
--   'supported'    every active computer has a chosen printer that reports the size.
create or replace function public.shop_paper_capability(p_shop_id uuid, p_paper text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_agent   public.print_agents%rowtype;
  v_printer jsonb;
  v_papers  jsonb;
  v_lacking boolean := false;
  v_unknown boolean := false;
  v_any     boolean := false;
begin
  for v_agent in
    select * from public.print_agents where shop_id = p_shop_id and revoked_at is null
  loop
    v_any := true;
    -- Windows never reports a paper list, and the agent refuses a non-A4 job it cannot choose a tray for.
    if v_agent.platform = 'windows' then
      v_lacking := true;
      continue;
    end if;
    if v_agent.chosen_printer is null then
      v_unknown := true;
      continue;
    end if;
    select e into v_printer from jsonb_array_elements(v_agent.printers) e
     where e->>'name' = v_agent.chosen_printer
     limit 1;
    if v_printer is null then
      v_unknown := true;
      continue;
    end if;
    v_papers := v_printer->'papers';
    if v_papers is null or jsonb_typeof(v_papers) <> 'array' or jsonb_array_length(v_papers) = 0 then
      v_lacking := true;
      continue;
    end if;
    if exists (select 1 from jsonb_array_elements_text(v_papers) x where lower(x) = lower(p_paper)) then
      continue;
    end if;
    if jsonb_array_length(v_papers) >= 20 then
      v_unknown := true;
    else
      v_lacking := true;
    end if;
  end loop;
  if v_lacking then
    return 'unsupported';
  end if;
  if v_unknown or not v_any then
    return 'unknown';
  end if;
  return 'supported';
end;
$$;

-- ---------- the paper sizes a customer may choose (new) ----------
-- The shop's offered sizes, with a size dropped when printer capability refuses it. The same rule as
-- place_order, so customers see only sizes that can be ordered. Owners read their own offer from
-- shop_paper_sizes, unchanged.
create or replace function public.shop_paper_offer(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'paper_size', p.paper_size,
           'is_offered', p.is_offered
                         and (p.paper_size = 'A4'
                              or public.shop_paper_capability(s.id, p.paper_size) <> 'unsupported'),
           'surcharge_paise', p.surcharge_paise
         ) order by p.paper_size), '[]'::jsonb)
    from public.shops s
    join public.shop_paper_sizes p on p.shop_id = s.id
   where s.slug = lower(trim(p_slug));
$$;

revoke execute on function public.shop_paper_offer(text) from public;
grant execute on function public.shop_paper_offer(text) to anon, authenticated;
