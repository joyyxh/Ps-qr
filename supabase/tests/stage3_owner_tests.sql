-- =========================================================
-- Stage 3 database tests: what a shop owner may and may not do.
-- Run AFTER the migration and the dev seed (demo_seed.sql).
--
-- Every check runs as the real `authenticated` or `anon` role, with the owner's
-- JWT claims set the same way the owner page sends them, so row level security
-- and column grants are exercised exactly as in the browser.
--
-- The whole run is one transaction that is rolled back at the end, so it
-- leaves no rows behind. Every row in the result should show ok = true.
-- =========================================================

begin;

create temp table stage3_results (name text, ok boolean, detail text) on commit drop;
grant select, insert on stage3_results to anon, authenticated;

-- Switch role and JWT claims. p_uid null means anonymous.
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

-- Expects a single count from a SELECT.
create or replace function pg_temp.expect_count(p_name text, p_expected int, p_sql text) returns void language plpgsql as $$
declare n int;
begin
  execute p_sql into n;
  insert into stage3_results values (p_name, n = p_expected, 'count=' || n);
exception when others then
  insert into stage3_results values (p_name, false, sqlstate || ': ' || sqlerrm);
end $$;

-- Expects a statement to change exactly p_expected rows (0 means "blocked silently by RLS").
create or replace function pg_temp.expect_rows(p_name text, p_expected int, p_sql text) returns void language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  insert into stage3_results values (p_name, n = p_expected, 'rows=' || n);
exception when others then
  insert into stage3_results values (p_name, false, sqlstate || ': ' || sqlerrm);
end $$;

-- Expects the statement to fail with a specific SQLSTATE.
create or replace function pg_temp.expect_error(p_name text, p_state text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into stage3_results values (p_name, false, 'no error was raised');
exception when others then
  insert into stage3_results values (p_name, sqlstate = p_state, sqlstate || ': ' || sqlerrm);
end $$;

do $$
declare
  owner_a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  owner_b uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
begin
  -- ----- owner A, on their own shop (demo-xerox) -----
  perform pg_temp.set_user(owner_a);

  perform pg_temp.expect_count('S01 owner A reads own shop', 1,
    $q$select count(*) from public.shops where id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$);

  perform pg_temp.expect_count('S02 owner A cannot see owner B memberships', 0,
    $q$select count(*) from public.shop_memberships where shop_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$);

  perform pg_temp.expect_count('S03 owner A sees inactive services of own shop', 1,
    $q$select count(*) from public.services where id = 'cccccccc-0000-0000-0000-000000000003'$q$);

  perform pg_temp.expect_rows('S04 owner A updates own shop details', 1,
    $q$update public.shops set phone = phone where id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$);

  perform pg_temp.expect_rows('S05 owner A cannot update shop B (silently 0 rows)', 0,
    $q$update public.shops set is_open = is_open where id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$);

  perform pg_temp.expect_error('S06 owner A cannot change the shop slug', '42501',
    $q$update public.shops set slug = 'hijacked' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$);

  perform pg_temp.expect_rows('S07 owner A opens or closes own shop', 1,
    $q$update public.shops set is_open = false where id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$);

  perform pg_temp.expect_rows('S08 owner A adds a service to own shop', 1,
    $q$insert into public.services (shop_id, name, pricing_unit, bw_price_paise, is_active)
       values ('bbbbbbbb-0000-0000-0000-000000000001', 'Owner A test', 'per_side', 150, true)$q$);

  perform pg_temp.expect_error('S09 owner A cannot add a service to shop B', '42501',
    $q$insert into public.services (shop_id, name, pricing_unit, bw_price_paise, is_active)
       values ('bbbbbbbb-0000-0000-0000-000000000002', 'Intruder', 'per_side', 150, true)$q$);

  perform pg_temp.expect_rows('S10 owner A cannot edit a service of shop B (silently 0 rows)', 0,
    $q$update public.services set name = name where id = 'cccccccc-0000-0000-0000-000000000004'$q$);

  perform pg_temp.expect_rows('S11 owner A changes a price in own shop', 1,
    $q$update public.services set bw_price_paise = 250 where id = 'cccccccc-0000-0000-0000-000000000001'$q$);

  perform pg_temp.expect_error('S12 owner A cannot move a service into shop B', '42501',
    $q$update public.services set shop_id = 'bbbbbbbb-0000-0000-0000-000000000002'
       where id = 'cccccccc-0000-0000-0000-000000000001'$q$);

  perform pg_temp.expect_error('S13 owner A cannot make themselves owner of shop B', '42501',
    $q$insert into public.shop_memberships (shop_id, user_id, role)
       values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner')$q$);

  perform pg_temp.expect_error('S14 a service needs at least one price', '23514',
    $q$insert into public.services (shop_id, name, pricing_unit, bw_price_paise, colour_price_paise, is_active)
       values ('bbbbbbbb-0000-0000-0000-000000000001', 'No price', 'per_side', null, null, true)$q$);

  perform pg_temp.expect_error('S15 a price above Rs 1,000 is refused', '23514',
    $q$insert into public.services (shop_id, name, pricing_unit, bw_price_paise, is_active)
       values ('bbbbbbbb-0000-0000-0000-000000000001', 'Too dear', 'per_side', 100001, true)$q$);

  perform pg_temp.expect_error('S16 a service name over 80 characters is refused', '23514',
    $q$insert into public.services (shop_id, name, pricing_unit, bw_price_paise, is_active)
       values ('bbbbbbbb-0000-0000-0000-000000000001', repeat('x', 81), 'per_side', 100, true)$q$);

  perform pg_temp.expect_error('S17 an unknown charging unit is refused', '23514',
    $q$update public.services set pricing_unit = 'per_page' where id = 'cccccccc-0000-0000-0000-000000000001'$q$);

  perform pg_temp.expect_count('S18 owner A cannot read orders of shop B', 0,
    $q$select count(*) from public.orders where shop_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$);

  -- Owner A creates a shop through the function the owner page uses.
  perform pg_temp.expect_count('S19 create_shop makes a new shop for owner A', 1,
    $q$select count(*) from public.create_shop('stage3-test-shop', 'Stage Three Test', '+91 98765 22222', 'Test road')$q$);

  perform pg_temp.expect_error('S20 a taken web address is refused', '23505',
    $q$select * from public.create_shop('demo-xerox', 'Duplicate', null, null)$q$);

  perform pg_temp.expect_error('S21 a reserved web address is refused', '23514',
    $q$select * from public.create_shop('admin', 'Reserved', null, null)$q$);

  perform pg_temp.expect_error('S22 a badly formed web address is refused', '23514',
    $q$select * from public.create_shop('Bad Slug!', 'Bad', null, null)$q$);

  perform pg_temp.expect_error('S23 a blank shop name is refused', '23514',
    $q$select * from public.create_shop('stage3-blank-name', '   ', null, null)$q$);

  perform pg_temp.clear_user();

  -- ----- owner B looks at owner A's new shop -----
  perform pg_temp.set_user(owner_b);

  perform pg_temp.expect_count('S24 owner B cannot see memberships of owner A new shop', 0,
    $q$select count(*) from public.shop_memberships
       where shop_id = (select id from public.shops where slug = 'stage3-test-shop')$q$);

  perform pg_temp.expect_rows('S25 owner B cannot change owner A new shop (silently 0 rows)', 0,
    $q$update public.shops set phone = '+91 98765 33333' where slug = 'stage3-test-shop'$q$);

  perform pg_temp.expect_count('S26 shop listing stays public by design', 1,
    $q$select count(*) from public.shops where slug = 'stage3-test-shop'$q$);

  perform pg_temp.clear_user();

  -- ----- anonymous visitor -----
  perform pg_temp.set_user(null);

  perform pg_temp.expect_error('S27 anonymous visitors cannot create shops', '42501',
    $q$select * from public.create_shop('stage3-anon', 'Anon shop', null, null)$q$);

  perform pg_temp.expect_count('S28 anonymous visitors cannot see inactive services', 0,
    $q$select count(*) from public.services where id = 'cccccccc-0000-0000-0000-000000000003'$q$);

  perform pg_temp.expect_count('S29 anonymous visitors see active services', 1,
    $q$select count(*) from public.services where id = 'cccccccc-0000-0000-0000-000000000001'$q$);

  perform pg_temp.expect_error('S30 anonymous visitors cannot change shops', '42501',
    $q$update public.shops set name = 'Hacked' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$);

  perform pg_temp.clear_user();
end $$;

select name, ok, detail from stage3_results order by name;

rollback;
