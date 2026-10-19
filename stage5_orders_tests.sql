-- =========================================================
-- Stage 5 database tests: owners working through orders.
-- Run AFTER the migrations and the dev seed.
--
-- Orders are placed the way customers place them (anonymous place_order),
-- then owners move them through the statuses. Every step runs as the real
-- `authenticated` or `anon` role with the owner's JWT claims.
--
-- The run is one transaction, rolled back at the end, so it leaves no orders
-- behind. Every row in the result should show ok = true.
-- =========================================================

begin;

create temp table stage5_results (name text, ok boolean, detail text) on commit drop;
grant select, insert on stage5_results to anon, authenticated;

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

create or replace function pg_temp.expect_count(p_name text, p_expected int, p_sql text) returns void language plpgsql as $$
declare n int;
begin
  execute p_sql into n;
  insert into stage5_results values (p_name, n = p_expected, 'count=' || n);
exception when others then
  insert into stage5_results values (p_name, false, sqlstate || ': ' || sqlerrm);
end $$;

create or replace function pg_temp.expect_rows(p_name text, p_expected int, p_sql text) returns void language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  insert into stage5_results values (p_name, n = p_expected, 'rows=' || n);
exception when others then
  insert into stage5_results values (p_name, false, sqlstate || ': ' || sqlerrm);
end $$;

create or replace function pg_temp.expect_error(p_name text, p_state text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into stage5_results values (p_name, false, 'no error was raised');
exception when others then
  insert into stage5_results values (p_name, sqlstate = p_state, sqlstate || ': ' || sqlerrm);
end $$;

-- Since migration 0003, every order item needs an uploaded file. The page count
-- comes from the file row, so the fixture sets it the way the server would.
create or replace function pg_temp.fixture_file(p_shop_slug text, p_pages integer) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.customer_files (shop_id, storage_path, mime_type, size_bytes, page_count, original_name)
  select s.id, 'fixture/' || gen_random_uuid()::text || '.pdf', 'application/pdf', 1024, p_pages, 'fixture.pdf'
  from public.shops s
  where s.slug = p_shop_slug
  returning id into v_id;
  return v_id;
end $$;

do $$
declare
  f1 uuid;
  f2 uuid;
  fb uuid;
  owner_a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  owner_b uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  svc_a   uuid := 'cccccccc-0000-0000-0000-000000000001';
  svc_b   uuid := 'cccccccc-0000-0000-0000-000000000004';
  shop_a  uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  res     jsonb;
  order_1 uuid;  -- walks the whole happy path
  order_2 uuid;  -- used for refused moves, then rejected
  order_b uuid;  -- belongs to other-print (owner B)
  q1 text;
  q2 text;
  qb text;
begin
  -- Customers upload three files and place three orders: two at demo-xerox, one at other-print.
  -- Fixtures are created before the role changes, as the test owner.
  f1 := pg_temp.fixture_file('demo-xerox', 4);
  f2 := pg_temp.fixture_file('demo-xerox', 2);
  fb := pg_temp.fixture_file('other-print', 1);

  perform pg_temp.set_user(null);
  res := public.place_order('demo-xerox',
    jsonb_build_array(jsonb_build_object('service_id', svc_a, 'file_id', f1, 'copies', 1, 'colour', false, 'duplex', false)),
    'stage5-test-1');
  perform pg_temp.clear_user();
  select id into order_1 from public.orders where tracking_code = res->>'tracking_code';

  perform pg_temp.set_user(null);
  res := public.place_order('demo-xerox',
    jsonb_build_array(jsonb_build_object('service_id', svc_a, 'file_id', f2, 'copies', 3, 'colour', false, 'duplex', true)),
    'stage5-test-2');
  perform pg_temp.clear_user();
  select id into order_2 from public.orders where tracking_code = res->>'tracking_code';

  perform pg_temp.set_user(null);
  res := public.place_order('other-print',
    jsonb_build_array(jsonb_build_object('service_id', svc_b, 'file_id', fb, 'copies', 1, 'colour', false, 'duplex', false)),
    'stage5-test-b');
  perform pg_temp.clear_user();
  select id into order_b from public.orders where tracking_code = res->>'tracking_code';

  q1 := quote_literal(order_1::text);
  q2 := quote_literal(order_2::text);
  qb := quote_literal(order_b::text);

  -- ----- owner A works through demo-xerox orders -----
  perform pg_temp.set_user(owner_a);

  perform pg_temp.expect_count('S01 owner A sees the new order', 1,
    'select count(*) from public.orders where id = ' || q1);

  perform pg_temp.expect_rows('S02 owner A approves a pending order', 1,
    'update public.orders set status = ''approved'' where id = ' || q1);

  perform pg_temp.expect_rows('S03 owner A starts printing', 1,
    'update public.orders set status = ''printing'' where id = ' || q1);

  perform pg_temp.expect_rows('S04 owner A marks it ready', 1,
    'update public.orders set status = ''ready'' where id = ' || q1);

  perform pg_temp.expect_rows('S05 owner A marks it completed', 1,
    'update public.orders set status = ''completed'' where id = ' || q1);

  perform pg_temp.expect_error('S06 a completed order cannot be cancelled', '22023',
    'update public.orders set status = ''cancelled'' where id = ' || q1);

  perform pg_temp.expect_error('S07 a pending order cannot skip straight to completed', '22023',
    'update public.orders set status = ''completed'' where id = ' || q2);

  perform pg_temp.expect_error('S08 owner A cannot change the total', '42501',
    'update public.orders set total_paise = 1 where id = ' || q2);

  perform pg_temp.expect_error('S09 owner A cannot change the customer note', '42501',
    'update public.orders set customer_note = ''changed'' where id = ' || q2);

  perform pg_temp.expect_error('S10 owner A cannot change the tracking code', '42501',
    'update public.orders set tracking_code = ''HACK0000'' where id = ' || q2);

  perform pg_temp.expect_rows('S11 owner A rejects a pending order', 1,
    'update public.orders set status = ''rejected'' where id = ' || q2);

  perform pg_temp.expect_error('S12 a rejected order cannot be approved later', '22023',
    'update public.orders set status = ''approved'' where id = ' || q2);

  perform pg_temp.expect_count('S13 owner A cannot see other-print orders', 0,
    'select count(*) from public.orders where id = ' || qb);

  perform pg_temp.expect_rows('S14 owner A cannot change other-print orders (silently 0 rows)', 0,
    'update public.orders set status = ''approved'' where id = ' || qb);

  perform pg_temp.expect_count('S15 owner A cannot see other-print order items', 0,
    'select count(*) from public.order_items where order_id = ' || qb);

  perform pg_temp.expect_count('S16 owner A sees the items of own order', 1,
    'select count(*) from public.order_items where order_id = ' || q1);

  perform pg_temp.expect_error('S17 order items are an immutable snapshot', '42501',
    'update public.order_items set amount_paise = 1 where order_id = ' || q1);

  perform pg_temp.expect_count('S18 both demo-xerox orders are listed for shop A', 2,
    'select count(*) from public.orders where shop_id = ''' || shop_a::text || ''' and id in (' || q1 || ', ' || q2 || ')');

  perform pg_temp.clear_user();

  -- ----- owner B looks at demo-xerox -----
  perform pg_temp.set_user(owner_b);

  perform pg_temp.expect_count('S19 owner B sees own other-print order', 1,
    'select count(*) from public.orders where id = ' || qb);

  perform pg_temp.expect_count('S20 owner B cannot see demo-xerox orders', 0,
    'select count(*) from public.orders where id in (' || q1 || ', ' || q2 || ')');

  perform pg_temp.expect_rows('S21 owner B cannot change demo-xerox orders (silently 0 rows)', 0,
    'update public.orders set status = ''approved'' where id = ' || q2);

  perform pg_temp.clear_user();

  -- ----- anonymous visitor -----
  perform pg_temp.set_user(null);

  perform pg_temp.expect_error('S22 anonymous visitors cannot list orders', '42501',
    'select count(*) from public.orders');

  perform pg_temp.expect_error('S23 anonymous visitors cannot change orders', '42501',
    'update public.orders set status = ''approved'' where id = ' || q2);

  perform pg_temp.clear_user();
end $$;

select name, ok, detail from stage5_results order by name;

rollback;
