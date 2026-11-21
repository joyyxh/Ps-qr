-- =========================================================
-- 0018: automatic sending of paid orders to the printing computer (opt-in per shop).
--
-- Off for every shop until its owner switches it on in Orders > Printing computers.
-- While it is on:
--   * approving a paid order queues its files at once, exactly as "Send to printer" does,
--     and moves the order to printing;
--   * a payment verified after approval queues the files at that point;
--   * nothing is queued for an order that is not approved and paid, or that has no file;
--   * orders approved before the switch was turned on are NOT queued automatically;
--     "Send to printer" still works for any approved, paid order that has no job yet.
-- The print rules in 0010 are unchanged: one active job per item, shop-scoped agents,
-- and no automatic reprint of a job that may already have printed.
--
-- Status: written and reviewed, NOT yet run against a database and NOT yet applied to the
-- live project. Run it after 0001-0017 and the dev seed, then the Stage 8 tests.
-- =========================================================

-- ---------- the switch ----------

alter table public.shops
  add column if not exists auto_print_enabled boolean not null default false;

-- Owners only (is_shop_owner), the same check Send to printer uses.
create or replace function public.set_auto_print(p_shop_id uuid, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'you do not have permission to change this shop' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'choose on or off' using errcode = '22023';
  end if;
  update public.shops set auto_print_enabled = p_enabled where id = p_shop_id;
  return jsonb_build_object('auto_print_enabled', p_enabled);
end;
$$;

revoke all on function public.set_auto_print(uuid, boolean) from public, anon;
grant execute on function public.set_auto_print(uuid, boolean) to authenticated;

-- ---------- one place that queues an order ----------

-- Queues the printable files of one approved, paid order and moves the order to printing.
-- The callers check permission and the order's state first: Send to printer
-- (approve_order_for_print) and the automatic trigger below. Browsers cannot call it.
create or replace function public._queue_order_for_print(p_order_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   public.orders%rowtype;
  v_item    public.order_items%rowtype;
  v_queued  integer := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  for v_item in
    select * from public.order_items where order_id = p_order_id order by id
  loop
    if v_item.file_id is null then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'order_item_id', v_item.id, 'name', v_item.service_name, 'reason', 'no_file'));
      continue;
    end if;
    if exists (select 1 from public.print_jobs j where j.order_item_id = v_item.id) then
      continue;
    end if;
    insert into public.print_jobs (shop_id, order_id, order_item_id, file_id, settings, created_by)
    values (
      v_order.shop_id, p_order_id, v_item.id, v_item.file_id,
      jsonb_build_object(
        'copies', v_item.copies,
        'colour', v_item.colour,
        'duplex', v_item.duplex,
        'paper', 'A4',
        'pages', v_item.page_count,
        'file_name', v_item.file_name
      ),
      p_actor
    );
    v_queued := v_queued + 1;
  end loop;

  if v_order.status = 'approved' then
    update public.orders set status = 'printing' where id = p_order_id and status = 'approved';
  end if;

  return jsonb_build_object('queued', v_queued, 'skipped', v_skipped);
end;
$$;

revoke all on function public._queue_order_for_print(uuid, uuid) from public, anon, authenticated;

-- Send to printer. Same checks as 0010; the queueing now lives in _queue_order_for_print.
create or replace function public.approve_order_for_print(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if auth.uid() is null or not public.is_shop_owner(v_order.shop_id) then
    raise exception 'you do not have permission to change this order' using errcode = '42501';
  end if;
  if v_order.status not in ('approved', 'printing') then
    raise exception 'only an approved order can be sent to print' using errcode = '22023';
  end if;
  if v_order.payment_status <> 'paid' then
    raise exception 'verify the payment before printing' using errcode = '22023';
  end if;

  return public._queue_order_for_print(p_order_id, auth.uid());
end;
$$;

-- ---------- automatic sending ----------

-- Runs after an order's status or payment changes. It queues only when the order has just
-- become approved AND paid, and the shop has switched automatic sending on.
-- Approval and payment can happen in either order; whichever comes second triggers it.
create or replace function public.auto_print_on_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved'
     and new.payment_status = 'paid'
     and (old.status is distinct from new.status or old.payment_status is distinct from new.payment_status)
     and exists (select 1 from public.shops s where s.id = new.shop_id and s.auto_print_enabled) then
    perform public._queue_order_for_print(new.id, auth.uid());
  end if;
  return null;
end;
$$;

drop trigger if exists orders_auto_print on public.orders;
create trigger orders_auto_print
  after update of status, payment_status on public.orders
  for each row execute function public.auto_print_on_approval();
