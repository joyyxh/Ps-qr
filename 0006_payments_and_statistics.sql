-- =========================================================
-- PrintNest Stage 7: payments recorded by the owner, cancellation reasons,
-- order history and owner statistics.
--
-- Nothing here talks to a payment provider. The owner records cash and online
-- receipts by hand (set_order_payment). The statistics are read from those
-- records every time the page loads, so they follow each change at once.
--
-- Rules used by every statistic:
--   * Dates are Indian calendar days (Asia/Kolkata), start and end inclusive.
--   * Order counts use the day the order was placed (created_at).
--   * Earnings use the day the payment was recorded (paid_at).
--   * Net earnings = paid orders that are not cancelled or rejected and not
--     refunded. Order value is never counted as earnings.
--
-- Run AFTER 0001-0005. Applied to the live project as stage7_payments_and_statistics.
-- =========================================================

-- ---------- 1. order columns ----------

alter table public.orders
  add column payment_status  text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'refunded')),
  add column payment_channel text check (payment_channel in ('cash', 'online')),
  add column paid_at         timestamptz,
  add column refunded_at     timestamptz,
  add column refund_paise    integer check (refund_paise is null or refund_paise between 0 and 1000000),
  add column cancel_reason   text check (cancel_reason in (
    'customer_asked', 'file_problem', 'out_of_stock', 'shop_closed', 'payment_problem', 'other'
  )),
  add column approved_at     timestamptz,
  add column completed_at    timestamptz,
  add column cancelled_at    timestamptz,
  add column rejected_at     timestamptz,
  add constraint orders_paid_has_channel check (
    payment_status not in ('paid', 'refunded') or (payment_channel is not null and paid_at is not null)
  ),
  add constraint orders_refund_has_amount check (
    payment_status <> 'refunded' or (refunded_at is not null and refund_paise = total_paise)
  ),
  add constraint orders_cancel_reason_needs_status check (
    cancel_reason is null or status in ('cancelled', 'rejected')
  );

-- Milestone times for orders that already exist. Their exact history is not known,
-- so the last update time is used. The guard trigger is paused only for this backfill.
alter table public.orders disable trigger orders_guard_changes;
update public.orders set approved_at  = coalesce(approved_at, updated_at)  where status in ('approved', 'printing', 'ready', 'completed');
update public.orders set completed_at = coalesce(completed_at, updated_at) where status = 'completed';
update public.orders set cancelled_at = coalesce(cancelled_at, updated_at) where status = 'cancelled';
update public.orders set rejected_at  = coalesce(rejected_at, updated_at)  where status = 'rejected';
alter table public.orders enable trigger orders_guard_changes;

-- ---------- 2. order history ----------

create table public.order_events (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete restrict,
  shop_id      uuid not null references public.shops (id) on delete restrict,
  kind         text not null check (kind in ('created', 'status', 'payment', 'refund')),
  from_value   text,
  to_value     text,
  detail       text,
  amount_paise integer,
  actor_id     uuid,
  created_at   timestamptz not null default now()
);

create index order_events_shop_time_idx on public.order_events (shop_id, created_at desc);
create index order_events_order_idx on public.order_events (order_id, created_at);

alter table public.order_events enable row level security;
create policy order_events_owner_read on public.order_events
  for select to authenticated
  using (public.is_shop_owner(shop_id));
revoke all on public.order_events from public, anon, authenticated;
grant select on public.order_events to authenticated;

-- Every order that already exists gets a "created" entry, so the activity list is complete from now on.
insert into public.order_events (order_id, shop_id, kind, to_value, amount_paise, created_at)
select o.id, o.shop_id, 'created', 'pending', o.total_paise, o.created_at
from public.orders o;

create or replace function public.order_history_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_events (order_id, shop_id, kind, to_value, amount_paise, actor_id)
  values (new.id, new.shop_id, 'created', new.status, new.total_paise, auth.uid());
  return new;
end;
$$;

create trigger orders_history_insert
after insert on public.orders
for each row execute function public.order_history_on_insert();

-- Runs after orders_guard_changes (names sort that way), so only allowed changes get logged.
create or replace function public.order_history_on_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      new.approved_at := coalesce(new.approved_at, now());
    elsif new.status = 'completed' then
      new.completed_at := now();
    elsif new.status = 'cancelled' then
      new.cancelled_at := now();
    elsif new.status = 'rejected' then
      new.rejected_at := now();
    end if;

    insert into public.order_events (order_id, shop_id, kind, from_value, to_value, actor_id)
    values (new.id, new.shop_id, 'status', old.status, new.status, auth.uid());
  end if;

  if new.payment_status is distinct from old.payment_status then
    if new.payment_status = 'refunded' then
      insert into public.order_events (order_id, shop_id, kind, from_value, to_value, amount_paise, actor_id)
      values (new.id, new.shop_id, 'refund', old.payment_status, new.payment_status, new.refund_paise, auth.uid());
    else
      insert into public.order_events (order_id, shop_id, kind, from_value, to_value, detail, actor_id)
      values (new.id, new.shop_id, 'payment', old.payment_status, new.payment_status, new.payment_channel, auth.uid());
    end if;
  end if;

  return new;
end;
$$;

create trigger orders_history_update
before update on public.orders
for each row execute function public.order_history_on_update();

-- ---------- 3. RPC: owner records a payment or a refund ----------
-- Actions: set_pending (online, awaiting confirmation), set_paid (cash or online),
-- set_unpaid (clears a pending payment), refund (only after payment).

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

-- ---------- 4. RPC: owner records why an order was cancelled or rejected ----------

create or replace function public.set_cancel_reason(p_order_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if not public.is_shop_owner(v_order.shop_id) then
    raise exception 'you do not have permission to change this order' using errcode = '42501';
  end if;
  if v_order.status not in ('cancelled', 'rejected') then
    raise exception 'a reason can only be recorded for a cancelled or rejected order' using errcode = '22023';
  end if;

  update public.orders set cancel_reason = p_reason where id = p_order_id;
  return p_reason;
end;
$$;

-- ---------- 5. statistics ----------

create or replace function public._stats_check_range(p_from date, p_to date)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_from is null or p_to is null then
    raise exception 'choose a start and an end date' using errcode = '22023';
  end if;
  if p_to < p_from then
    raise exception 'the end date is before the start date' using errcode = '22023';
  end if;
  if p_to - p_from > 800 then
    raise exception 'choose a range of 800 days or less' using errcode = '22023';
  end if;
end;
$$;

-- One period, as a single JSON document. The page calls it for the chosen period and
-- for the period it compares with.
create or replace function public.shop_stats_summary(p_shop_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start      timestamptz;
  v_end        timestamptz;
  v_orders     jsonb;
  v_payments   jsonb;
  v_earnings   jsonb;
  v_refunds    jsonb;
  v_completed  jsonb;
  v_cancels    jsonb;
  v_reasons    jsonb;
  v_services   jsonb;
  v_total      bigint;
  v_cancelled  bigint;
  v_rejected   bigint;
  v_pages      bigint;
  v_items      bigint;
  v_refund_n   bigint;
  v_refund_sum bigint;
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'you do not have permission to see this shop''s statistics' using errcode = '42501';
  end if;
  perform public._stats_check_range(p_from, p_to);

  v_start := (p_from::timestamp) at time zone 'Asia/Kolkata';
  v_end   := ((p_to + 1)::timestamp) at time zone 'Asia/Kolkata';

  -- Orders placed in the period, grouped by their current status.
  select jsonb_build_object(
      'total', count(*),
      'pending', count(*) filter (where o.status = 'pending'),
      'approved', count(*) filter (where o.status = 'approved'),
      'printing', count(*) filter (where o.status = 'printing'),
      'ready', count(*) filter (where o.status = 'ready'),
      'completed', count(*) filter (where o.status = 'completed'),
      'cancelled', count(*) filter (where o.status = 'cancelled'),
      'rejected', count(*) filter (where o.status = 'rejected'),
      'order_value_paise', coalesce(sum(o.total_paise), 0)
    )
    into v_orders
  from public.orders o
  where o.shop_id = p_shop_id and o.created_at >= v_start and o.created_at < v_end;

  -- Payment state of orders placed in the period.
  select jsonb_build_object(
      'unpaid', count(*) filter (where o.payment_status = 'unpaid'),
      'pending', count(*) filter (where o.payment_status = 'pending'),
      'paid', count(*) filter (where o.payment_status = 'paid'),
      'refunded', count(*) filter (where o.payment_status = 'refunded')
    )
    into v_payments
  from public.orders o
  where o.shop_id = p_shop_id and o.created_at >= v_start and o.created_at < v_end;

  -- Money received in the period (by payment date).
  select jsonb_build_object(
      'net_paise', coalesce(sum(o.total_paise) filter (
          where o.payment_status = 'paid' and o.status not in ('cancelled', 'rejected')), 0),
      'net_orders', count(*) filter (
          where o.payment_status = 'paid' and o.status not in ('cancelled', 'rejected')),
      'net_cash_paise', coalesce(sum(o.total_paise) filter (
          where o.payment_status = 'paid' and o.status not in ('cancelled', 'rejected')
            and o.payment_channel = 'cash'), 0),
      'net_online_paise', coalesce(sum(o.total_paise) filter (
          where o.payment_status = 'paid' and o.status not in ('cancelled', 'rejected')
            and o.payment_channel = 'online'), 0),
      'collected_paise', coalesce(sum(o.total_paise) filter (
          where o.payment_status in ('paid', 'refunded')), 0),
      'refund_due_paise', coalesce(sum(o.total_paise) filter (
          where o.payment_status = 'paid' and o.status in ('cancelled', 'rejected')), 0)
    )
    into v_earnings
  from public.orders o
  where o.shop_id = p_shop_id and o.paid_at >= v_start and o.paid_at < v_end;

  -- Refunds issued in the period (by refund date).
  select count(*), coalesce(sum(o.refund_paise), 0)
    into v_refund_n, v_refund_sum
  from public.orders o
  where o.shop_id = p_shop_id and o.refunded_at >= v_start and o.refunded_at < v_end;
  v_refunds := jsonb_build_object('count', v_refund_n, 'paise', v_refund_sum);

  -- Completed orders placed in the period, with the printing volume they used.
  select jsonb_build_object('count', count(*), 'revenue_paise', coalesce(sum(o.total_paise), 0))
    into v_completed
  from public.orders o
  where o.shop_id = p_shop_id and o.status = 'completed'
    and o.created_at >= v_start and o.created_at < v_end;

  select coalesce(sum(oi.page_count * oi.copies), 0), count(*)
    into v_pages, v_items
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.shop_id = p_shop_id and o.status = 'completed'
    and o.created_at >= v_start and o.created_at < v_end;
  v_completed := v_completed || jsonb_build_object('pages', v_pages, 'items', v_items);

  -- Cancellations and rejections placed in the period.
  select count(*) filter (where o.status = 'cancelled'),
         count(*) filter (where o.status = 'rejected'),
         count(*)
    into v_cancelled, v_rejected, v_total
  from public.orders o
  where o.shop_id = p_shop_id and o.created_at >= v_start and o.created_at < v_end;

  v_cancels := jsonb_build_object(
    'cancelled', v_cancelled,
    'rejected', v_rejected,
    'rate_percent', coalesce(round(100.0 * (v_cancelled + v_rejected) / nullif(v_total, 0), 1), 0)
  );

  select coalesce(jsonb_agg(jsonb_build_object('reason', r.reason, 'count', r.n)
                            order by r.n desc, r.reason), '[]'::jsonb)
    into v_reasons
  from (
    select coalesce(o.cancel_reason, 'not_given') as reason, count(*) as n
    from public.orders o
    where o.shop_id = p_shop_id and o.status in ('cancelled', 'rejected')
      and o.created_at >= v_start and o.created_at < v_end
    group by 1
  ) r;

  -- Services ordered in the period (cancelled and rejected orders left out), top 12.
  select coalesce(jsonb_agg(jsonb_build_object(
      'service', s.service_name,
      'colour', s.colour,
      'items', s.items,
      'orders', s.orders,
      'copies', s.copies,
      'pages', s.pages,
      'revenue_paise', s.revenue_paise
    ) order by s.items desc, s.revenue_paise desc, s.service_name), '[]'::jsonb)
    into v_services
  from (
    select oi.service_name,
           oi.colour,
           count(*) as items,
           count(distinct oi.order_id) as orders,
           coalesce(sum(oi.copies), 0) as copies,
           coalesce(sum(oi.page_count * oi.copies), 0) as pages,
           coalesce(sum(oi.amount_paise), 0) as revenue_paise
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.shop_id = p_shop_id
      and o.status not in ('cancelled', 'rejected')
      and o.created_at >= v_start and o.created_at < v_end
    group by oi.service_name, oi.colour
    order by count(*) desc, sum(oi.amount_paise) desc
    limit 12
  ) s;

  return jsonb_build_object(
    'from',          p_from,
    'to',            p_to,
    'orders',        v_orders,
    'payments',      v_payments,
    'earnings',      v_earnings,
    'refunds',       v_refunds,
    'completed',     v_completed,
    'cancellations', v_cancels,
    'reasons',       v_reasons,
    'services',      v_services
  );
end;
$$;

-- One row per calendar day (IST), so the page can draw the weekly chart and group
-- the earnings by week, month or year.
create or replace function public.shop_stats_daily(p_shop_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end   timestamptz;
  v_rows  jsonb;
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'you do not have permission to see this shop''s statistics' using errcode = '42501';
  end if;
  perform public._stats_check_range(p_from, p_to);

  v_start := (p_from::timestamp) at time zone 'Asia/Kolkata';
  v_end   := ((p_to + 1)::timestamp) at time zone 'Asia/Kolkata';

  with days as (
    select g::date as day
    from generate_series(p_from, p_to, interval '1 day') as g
  ),
  placed as (
    select (o.created_at at time zone 'Asia/Kolkata')::date as day,
           count(*) as n,
           sum(o.total_paise) as paise
    from public.orders o
    where o.shop_id = p_shop_id and o.created_at >= v_start and o.created_at < v_end
    group by 1
  ),
  done as (
    select (o.completed_at at time zone 'Asia/Kolkata')::date as day,
           count(*) as n,
           sum(o.total_paise) as paise
    from public.orders o
    where o.shop_id = p_shop_id and o.status = 'completed'
      and o.completed_at >= v_start and o.completed_at < v_end
    group by 1
  ),
  stopped as (
    select (coalesce(o.cancelled_at, o.rejected_at) at time zone 'Asia/Kolkata')::date as day,
           count(*) as n
    from public.orders o
    where o.shop_id = p_shop_id and o.status in ('cancelled', 'rejected')
      and coalesce(o.cancelled_at, o.rejected_at) >= v_start
      and coalesce(o.cancelled_at, o.rejected_at) < v_end
    group by 1
  ),
  earned as (
    select (o.paid_at at time zone 'Asia/Kolkata')::date as day,
           count(*) as n,
           sum(o.total_paise) as paise
    from public.orders o
    where o.shop_id = p_shop_id and o.payment_status = 'paid'
      and o.status not in ('cancelled', 'rejected')
      and o.paid_at >= v_start and o.paid_at < v_end
    group by 1
  ),
  refunded as (
    select (o.refunded_at at time zone 'Asia/Kolkata')::date as day,
           sum(o.refund_paise) as paise
    from public.orders o
    where o.shop_id = p_shop_id
      and o.refunded_at >= v_start and o.refunded_at < v_end
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'date', to_char(days.day, 'YYYY-MM-DD'),
      'orders', coalesce(placed.n, 0),
      'order_value_paise', coalesce(placed.paise, 0),
      'completed', coalesce(done.n, 0),
      'completed_paise', coalesce(done.paise, 0),
      'stopped', coalesce(stopped.n, 0),
      'earned_orders', coalesce(earned.n, 0),
      'earned_paise', coalesce(earned.paise, 0),
      'refunds_paise', coalesce(refunded.paise, 0)
    ) order by days.day), '[]'::jsonb)
    into v_rows
  from days
  left join placed on placed.day = days.day
  left join done on done.day = days.day
  left join stopped on stopped.day = days.day
  left join earned on earned.day = days.day
  left join refunded on refunded.day = days.day;

  return v_rows;
end;
$$;

-- The latest changes to this shop's orders: placed, approved, printed, paid, refunded...
create or replace function public.shop_recent_activity(p_shop_id uuid, p_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'you do not have permission to see this shop''s activity' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'kind', e.kind,
      'from', e.from_value,
      'to', e.to_value,
      'detail', e.detail,
      'amount_paise', e.amount_paise,
      'tracking_code', o.tracking_code,
      'at', e.created_at
    ) order by e.created_at desc, e.id desc), '[]'::jsonb)
    into v_rows
  from (
    select *
    from public.order_events
    where shop_id = p_shop_id
    order by created_at desc, id desc
    limit least(greatest(coalesce(p_limit, 30), 1), 100)
  ) e
  join public.orders o on o.id = e.order_id;

  return v_rows;
end;
$$;

-- ---------- grants ----------

revoke all on function public.order_history_on_insert() from public, anon, authenticated;
revoke all on function public.order_history_on_update() from public, anon, authenticated;
revoke all on function public._stats_check_range(date, date) from public, anon, authenticated;

revoke execute on function public.set_order_payment(uuid, text, text) from public, anon;
grant execute on function public.set_order_payment(uuid, text, text) to authenticated;
revoke execute on function public.set_cancel_reason(uuid, text) from public, anon;
grant execute on function public.set_cancel_reason(uuid, text) to authenticated;
revoke execute on function public.shop_stats_summary(uuid, date, date) from public, anon;
grant execute on function public.shop_stats_summary(uuid, date, date) to authenticated;
revoke execute on function public.shop_stats_daily(uuid, date, date) from public, anon;
grant execute on function public.shop_stats_daily(uuid, date, date) to authenticated;
revoke execute on function public.shop_recent_activity(uuid, integer) from public, anon;
grant execute on function public.shop_recent_activity(uuid, integer) to authenticated;
