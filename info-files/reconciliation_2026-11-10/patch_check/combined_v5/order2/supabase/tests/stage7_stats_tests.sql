-- =========================================================
-- Stage 7 database tests: payments, cancellation reasons, order history and
-- the owner statistics.
-- Run AFTER migrations 0001-0006 and the dev seed.
--
-- Part A checks the rules as the owner and the public would meet them.
-- Part B builds seven orders with fixed dates (5 to 11 March 2001, Indian time),
-- so every expected number can be worked out by hand and checked exactly.
--
-- The run is one transaction, rolled back at the end, so it leaves no rows.
-- Every row in the result should show ok = true.
-- =========================================================

begin;

create temp table stage7_results (name text, ok boolean, detail text) on commit drop;
grant select, insert on stage7_results to anon, authenticated;

create or replace function pg_temp.set_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', 'authenticated')::text end,
    true
  );
  if p_uid is null then
    execute 'set role anon';
  else
    execute 'set role authenticated';
  end if;
end $$;

create or replace function pg_temp.clear_user() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.expect_error(p_name text, p_state text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into stage7_results values (p_name, false, 'no error was raised');
exception when others then
  insert into stage7_results values (p_name, sqlstate = p_state, sqlstate || ': ' || sqlerrm);
end $$;

create or replace function pg_temp.expect_ok(p_name text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into stage7_results values (p_name, true, 'ok');
exception when others then
  insert into stage7_results values (p_name, false, sqlstate || ': ' || sqlerrm);
end $$;

create or replace function pg_temp.expect_equal(p_name text, p_expected text, p_sql text) returns void language plpgsql as $$
declare v text;
begin
  execute p_sql into v;
  insert into stage7_results values (p_name, v is not distinct from p_expected, 'got=' || coalesce(v, 'null') || ' want=' || p_expected);
exception when others then
  insert into stage7_results values (p_name, false, sqlstate || ': ' || sqlerrm);
end $$;

-- A complete order as the database would store it. Dates are given with their Indian offset.
create or replace function pg_temp.fixture_order(
  p_status       text,
  p_total        integer,
  p_created      timestamptz default now(),
  p_payment      text default 'unpaid',
  p_channel      text default null,
  p_paid         timestamptz default null,
  p_refund       integer default null,
  p_refunded     timestamptz default null,
  p_reason       text default null,
  p_stamp        timestamptz default null,
  p_service_name text default 'Document printing',
  p_service      uuid default 'cccccccc-0000-0000-0000-000000000001',
  p_colour       boolean default false,
  p_pages        integer default 1,
  p_copies       integer default 1,
  p_shop         uuid default 'bbbbbbbb-0000-0000-0000-000000000001'
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.orders (
    shop_id, tracking_code, status, total_paise, created_at,
    payment_status, payment_channel, paid_at, refunded_at, refund_paise, cancel_reason,
    completed_at, cancelled_at, rejected_at
  ) values (
    p_shop, public.new_tracking_code(), p_status, p_total, p_created,
    p_payment, p_channel, p_paid, p_refunded, p_refund, p_reason,
    case when p_status = 'completed' then p_stamp end,
    case when p_status = 'cancelled' then p_stamp end,
    case when p_status = 'rejected'  then p_stamp end
  )
  returning id into v_id;

  insert into public.order_items (
    order_id, shop_id, service_id, service_name, pricing_unit,
    page_count, copies, colour, duplex, billable_units, unit_price_paise, amount_paise
  ) values (
    v_id, p_shop, p_service, p_service_name, 'per_side',
    p_pages, p_copies, p_colour, false, p_pages * p_copies, p_total, p_total
  );
  return v_id;
end $$;

do $$
declare
  owner_a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  owner_b uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  shop_a  uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  svc_pp  uuid := 'cccccccc-0000-0000-0000-000000000002';  -- Passport photo sheet
  a1 uuid; b1 uuid; b2 uuid; c1 uuid;
  f1 uuid; f2 uuid; f3 uuid; f4 uuid; f5 uuid; f6 uuid; f7 uuid;
  res     jsonb;
  days    jsonb;
  n       bigint;
  s       bigint;
begin
  -- ============ Part A: rules ============

  -- Working orders created today (for the actions below).
  a1 := pg_temp.fixture_order(p_status => 'pending', p_total => 500);
  b1 := pg_temp.fixture_order(p_status => 'pending', p_total => 300);
  b2 := pg_temp.fixture_order(p_status => 'pending', p_total => 200);
  c1 := pg_temp.fixture_order(p_status => 'cancelled', p_total => 150, p_stamp => now());

  insert into stage7_results values ('A01 a new order starts unpaid, with a created entry in its history',
    (select o.payment_status = 'unpaid' from public.orders o where o.id = a1)
    and (select count(*) from public.order_events e where e.order_id = a1 and e.kind = 'created') = 1,
    'checked');

  -- The owner approves, which the existing order screen does with a plain status update.
  perform pg_temp.set_user(owner_a);
  perform pg_temp.expect_ok('A02 owner A approves an order (existing flow still works)',
    format('update public.orders set status = %L where id = %L', 'approved', a1));
  perform pg_temp.expect_error('A03 an invalid status move is still refused (approved to rejected)', '22023',
    format('update public.orders set status = %L where id = %L', 'rejected', a1));
  perform pg_temp.expect_ok('A04 owner A records a cash payment on the approved order',
    format('select public.set_order_payment(%L, %L, %L)', a1, 'set_paid', 'cash'));
  perform pg_temp.expect_error('A05 a second payment on the same order is refused', '22023',
    format('select public.set_order_payment(%L, %L, %L)', a1, 'set_paid', 'cash'));
  perform pg_temp.expect_ok('A06 owner A refunds the paid order',
    format('select public.set_order_payment(%L, %L)', a1, 'refund'));
  perform pg_temp.expect_error('A07 a refunded order cannot be refunded again', '22023',
    format('select public.set_order_payment(%L, %L)', a1, 'refund'));

  perform pg_temp.expect_ok('A08 owner A marks a pending online payment on b1',
    format('select public.set_order_payment(%L, %L, %L)', b1, 'set_pending', 'online'));
  perform pg_temp.expect_error('A09 a pending payment must be online', '22023',
    format('select public.set_order_payment(%L, %L, %L)', b2, 'set_pending', 'cash'));
  perform pg_temp.expect_error('A10 marking paid needs a channel', '22023',
    format('select public.set_order_payment(%L, %L, %L)', b1, 'set_paid', null));
  perform pg_temp.expect_ok('A11 a pending payment can be cleared back to unpaid',
    format('select public.set_order_payment(%L, %L)', b1, 'set_unpaid'));
  perform pg_temp.expect_error('A12 payment on a cancelled order is refused', '22023',
    format('select public.set_order_payment(%L, %L, %L)', c1, 'set_paid', 'cash'));
  perform pg_temp.expect_error('A13 an unknown payment action is refused', '22023',
    format('select public.set_order_payment(%L, %L)', b1, 'delete_everything'));
  perform pg_temp.expect_error('A14 a reason cannot be set on an order still in progress', '22023',
    format('select public.set_cancel_reason(%L, %L)', b2, 'other'));
  perform pg_temp.expect_ok('A15 owner A records why a cancelled order was cancelled',
    format('select public.set_cancel_reason(%L, %L)', c1, 'out_of_stock'));
  perform pg_temp.expect_error('A16 an unknown cancel reason is refused', '23514',
    format('select public.set_cancel_reason(%L, %L)', c1, 'bored'));
  perform pg_temp.clear_user();

  perform pg_temp.set_user(owner_b);
  perform pg_temp.expect_error('A17 owner B cannot record a payment on demo-xerox orders', '42501',
    format('select public.set_order_payment(%L, %L, %L)', b2, 'set_paid', 'cash'));
  perform pg_temp.expect_error('A18 owner B cannot set a cancel reason on demo-xerox orders', '42501',
    format('select public.set_cancel_reason(%L, %L)', c1, 'other'));
  perform pg_temp.expect_error('A19 owner B cannot read the statistics of demo-xerox', '42501',
    format('select public.shop_stats_summary(%L, %L, %L)', shop_a, '2001-03-05', '2001-03-11'));
  perform pg_temp.expect_error('A20 owner B cannot read the daily figures of demo-xerox', '42501',
    format('select public.shop_stats_daily(%L, %L, %L)', shop_a, '2001-03-05', '2001-03-11'));
  perform pg_temp.expect_error('A21 owner B cannot read the activity of demo-xerox', '42501',
    format('select public.shop_recent_activity(%L, %L)', shop_a, 10));
  insert into stage7_results values ('A22 owner B sees none of demo-xerox''s order history',
    (select count(*) from public.order_events where shop_id = shop_a) = 0, 'rls');
  perform pg_temp.clear_user();

  perform pg_temp.set_user(null);
  perform pg_temp.expect_error('A23 anonymous visitors cannot record payments', '42501',
    format('select public.set_order_payment(%L, %L, %L)', b2, 'set_paid', 'cash'));
  perform pg_temp.expect_error('A24 anonymous visitors cannot read the statistics', '42501',
    format('select public.shop_stats_summary(%L, %L, %L)', shop_a, '2001-03-05', '2001-03-11'));
  perform pg_temp.expect_error('A25 anonymous visitors cannot read the order history', '42501',
    format('select count(*) from public.order_events where order_id = %L', a1));
  perform pg_temp.clear_user();

  -- The history written by the actions above, read back as the database stored it.
  insert into stage7_results values ('A26 the history records the cash payment and the refund on order a1',
    (select count(*) from public.order_events e
      where e.order_id = a1 and e.kind = 'payment' and e.to_value = 'paid' and e.detail = 'cash') = 1
    and (select count(*) from public.order_events e
      where e.order_id = a1 and e.kind = 'refund' and e.amount_paise = 500) = 1
    and (select count(*) from public.order_events e
      where e.order_id = a1 and e.kind = 'status' and e.from_value = 'pending' and e.to_value = 'approved') = 1,
    'checked');
  insert into stage7_results values ('A27 approval sets the approval time',
    (select approved_at is not null from public.orders where id = a1), 'checked');

  -- ============ Part B: statistics with known answers ============
  -- Indian time (+05:30). Dates are inclusive: 5 March to 11 March 2001.

  -- F1 completed, paid in cash
  f1 := pg_temp.fixture_order(p_status => 'completed', p_total => 1000,
    p_created => '2001-03-05 10:00+05:30', p_stamp => '2001-03-05 12:00+05:30',
    p_payment => 'paid', p_channel => 'cash', p_paid => '2001-03-05 12:05+05:30',
    p_pages => 4, p_copies => 2);
  -- F2 cancelled by the shop, never paid
  f2 := pg_temp.fixture_order(p_status => 'cancelled', p_total => 500,
    p_created => '2001-03-06 09:00+05:30', p_stamp => '2001-03-06 10:00+05:30',
    p_reason => 'customer_asked', p_colour => true);
  -- F3 rejected at 23:45 on 6 March, but paid online after midnight, on 7 March
  f3 := pg_temp.fixture_order(p_status => 'rejected', p_total => 300,
    p_created => '2001-03-06 23:30+05:30', p_stamp => '2001-03-06 23:45+05:30',
    p_reason => 'file_problem', p_payment => 'paid', p_channel => 'online',
    p_paid => '2001-03-07 00:10+05:30');
  -- F4 completed, paid online on 7 March, refunded on 9 March
  f4 := pg_temp.fixture_order(p_status => 'completed', p_total => 800,
    p_created => '2001-03-07 11:00+05:30', p_stamp => '2001-03-07 12:00+05:30',
    p_payment => 'refunded', p_channel => 'online', p_paid => '2001-03-07 11:30+05:30',
    p_refund => 800, p_refunded => '2001-03-09 10:00+05:30', p_pages => 3, p_copies => 1);
  -- F5 printing now, paid in cash on 9 March (passport photos)
  f5 := pg_temp.fixture_order(p_status => 'printing', p_total => 1200,
    p_created => '2001-03-09 15:00+05:30', p_payment => 'paid', p_channel => 'cash',
    p_paid => '2001-03-09 15:10+05:30', p_service_name => 'Passport photo sheet',
    p_service => svc_pp, p_colour => true, p_pages => 1, p_copies => 2);
  -- F6 waiting, online payment pending, colour
  f6 := pg_temp.fixture_order(p_status => 'pending', p_total => 400,
    p_created => '2001-03-10 10:00+05:30', p_payment => 'pending', p_channel => 'online',
    p_colour => true, p_pages => 2, p_copies => 1);
  -- F7 ready, not paid
  f7 := pg_temp.fixture_order(p_status => 'ready', p_total => 200,
    p_created => '2001-03-11 16:00+05:30', p_pages => 1, p_copies => 1);

  perform pg_temp.set_user(owner_a);

  res := public.shop_stats_summary(shop_a, '2001-03-05', '2001-03-11');
  days := public.shop_stats_daily(shop_a, '2001-03-05', '2001-03-11');

  insert into stage7_results values ('B01 the period has seven orders and their order value is 4400 (not earnings)',
    (res->'orders'->>'total') = '7' and (res->'orders'->>'order_value_paise') = '4400', res::text);
  insert into stage7_results values ('B02 orders by status: 2 completed, 1 cancelled, 1 rejected, 1 printing, 1 pending, 1 ready, 0 approved',
    (res->'orders'->>'completed') = '2' and (res->'orders'->>'cancelled') = '1'
    and (res->'orders'->>'rejected') = '1' and (res->'orders'->>'printing') = '1'
    and (res->'orders'->>'pending') = '1' and (res->'orders'->>'ready') = '1'
    and (res->'orders'->>'approved') = '0', res->'orders'::text);
  insert into stage7_results values ('B03 payments: 3 paid, 1 refunded, 1 pending, 2 unpaid',
    (res->'payments'->>'paid') = '3' and (res->'payments'->>'refunded') = '1'
    and (res->'payments'->>'pending') = '1' and (res->'payments'->>'unpaid') = '2', res->'payments'::text);
  insert into stage7_results values ('B04 net earnings are 2200: the cancelled and refunded money is left out',
    (res->'earnings'->>'net_paise') = '2200' and (res->'earnings'->>'net_orders') = '2', res->'earnings'::text);
  insert into stage7_results values ('B05 all of the net earnings came in cash; no online money is counted as net',
    (res->'earnings'->>'net_cash_paise') = '2200' and (res->'earnings'->>'net_online_paise') = '0', res->'earnings'::text);
  insert into stage7_results values ('B06 money received (3300) and money to refund on cancelled orders (300) are shown apart',
    (res->'earnings'->>'collected_paise') = '3300' and (res->'earnings'->>'refund_due_paise') = '300', res->'earnings'::text);
  insert into stage7_results values ('B07 refunds in the period: one refund of 800',
    (res->'refunds'->>'count') = '1' and (res->'refunds'->>'paise') = '800', res->'refunds'::text);
  insert into stage7_results values ('B08 completed orders: 2, revenue 1800, 11 pages printed, 2 items',
    (res->'completed'->>'count') = '2' and (res->'completed'->>'revenue_paise') = '1800'
    and (res->'completed'->>'pages') = '11' and (res->'completed'->>'items') = '2', res->'completed'::text);
  insert into stage7_results values ('B09 cancellations: 1 cancelled, 1 rejected, rate 28.6 percent (2 of 7)',
    (res->'cancellations'->>'cancelled') = '1' and (res->'cancellations'->>'rejected') = '1'
    and (res->'cancellations'->>'rate_percent') = '28.6', res->'cancellations'::text);
  insert into stage7_results values ('B10 cancellation reasons are counted, with the reason given',
    jsonb_array_length(res->'reasons') = 2
    and (res->'reasons'->0->>'reason') = 'customer_asked' and (res->'reasons'->0->>'count') = '1'
    and (res->'reasons'->1->>'reason') = 'file_problem', res->'reasons'::text);
  insert into stage7_results values ('B11 top service is Document printing in B&W: 3 items, 2000 revenue, cancelled and rejected orders left out',
    (res->'services'->0->>'service') = 'Document printing' and (res->'services'->0->>'colour') = 'false'
    and (res->'services'->0->>'items') = '3' and (res->'services'->0->>'revenue_paise') = '2000'
    and (res->'services'->0->>'pages') = '12', res->'services'::text);
  insert into stage7_results values ('B12 services list has 3 lines: B&W documents, colour documents and colour passport photos',
    jsonb_array_length(res->'services') = 3
    and (res->'services'->1->>'service') = 'Passport photo sheet' and (res->'services'->1->>'colour') = 'true'
    and (res->'services'->2->>'colour') = 'true' and (res->'services'->2->>'revenue_paise') = '400', res->'services'::text);

  -- Daily figures: one row per day, Indian calendar days.
  insert into stage7_results values ('B13 the daily report has one row for each of the 7 days',
    jsonb_array_length(days) = 7 and (days->0->>'date') = '2001-03-05' and (days->6->>'date') = '2001-03-11', days::text);
  insert into stage7_results values ('B14 5 March: one order, completed, 1000 earned',
    (days->0->>'orders') = '1' and (days->0->>'completed') = '1' and (days->0->>'earned_paise') = '1000', days->0::text);
  insert into stage7_results values ('B15 6 March: two orders (the 23:30 one counts on this day), 800 value, 2 stopped',
    (days->1->>'orders') = '2' and (days->1->>'order_value_paise') = '800' and (days->1->>'stopped') = '2', days->1::text);
  insert into stage7_results values ('B16 7 March: the order placed that day is counted, and the midnight payment is not earned (rejected)',
    (days->2->>'orders') = '1' and (days->2->>'completed') = '1' and (days->2->>'earned_paise') = '0', days->2::text);
  insert into stage7_results values ('B17 9 March: 1200 earned, and the 800 refund is on this day',
    (days->4->>'earned_paise') = '1200' and (days->4->>'refunds_paise') = '800', days->4::text);
  insert into stage7_results values ('B18 8 March is quiet: no orders, no money',
    (days->3->>'orders') = '0' and (days->3->>'earned_paise') = '0' and (days->3->>'refunds_paise') = '0', days->3::text);

  -- The daily report and the summary must agree (the page shows both).
  select sum((x->>'orders')::bigint), sum((x->>'earned_paise')::bigint)
    into n, s
  from jsonb_array_elements(days) x;
  insert into stage7_results values ('B19 daily orders add up to the summary (7)', n = 7, 'orders=' || n);
  insert into stage7_results values ('B20 daily earnings add up to the net earnings (2200)', s = 2200, 'earned=' || s);

  -- Every rule on the period is also true on a range with no orders.
  res := public.shop_stats_summary(shop_a, '2001-01-01', '2001-01-02');
  insert into stage7_results values ('B21 an empty period gives zero orders and a 0 percent rate with no division error',
    (res->'orders'->>'total') = '0' and (res->'cancellations'->>'rate_percent') = '0'
    and jsonb_array_length(res->'services') = 0 and jsonb_array_length(res->'reasons') = 0, res::text);

  -- Activity: newest first, with the tracking code, and the limit is respected.
  insert into stage7_results values ('B22 recent activity returns at most the limit (5 asked, 5 given)',
    jsonb_array_length(public.shop_recent_activity(shop_a, 5)) = 5, 'checked');
  insert into stage7_results values ('B23 recent activity includes the refund of order a1 with its amount',
    exists (select 1 from jsonb_array_elements(public.shop_recent_activity(shop_a, 100)) x
            where x->>'kind' = 'refund' and (x->>'amount_paise') = '500'), 'checked');

  -- Bad periods are refused.
  perform pg_temp.expect_error('B24 an end date before the start date is refused', '22023',
    format('select public.shop_stats_summary(%L, %L, %L)', shop_a, '2001-03-11', '2001-03-05'));
  perform pg_temp.expect_error('B25 a period longer than 800 days is refused', '22023',
    format('select public.shop_stats_daily(%L, %L, %L)', shop_a, '2001-01-01', '2003-06-01'));
  perform pg_temp.expect_error('B26 a missing date is refused', '22023',
    format('select public.shop_stats_summary(%L, %L, %L)', shop_a, null, '2001-03-11'));
  perform pg_temp.clear_user();

  -- The payment and reason rules also protect the stored data from a direct write.
  perform pg_temp.expect_error('B27 a refund amount must equal the order total (the database refuses a mismatch)', '23514',
    format('update public.orders set payment_status = %L, refunded_at = now(), refund_paise = %s, payment_channel = %L, paid_at = now() where id = %L',
           'refunded', 999999, 'cash', f7));
end $$;

select name, ok, detail from stage7_results order by name;

rollback;
