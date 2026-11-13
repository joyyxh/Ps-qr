-- =========================================================
-- Stage 1 database tests: pricing, tenant isolation, guards.
-- Run AFTER migrations 0001-0003 and the dev seed, in the SQL editor or with execute_sql.
-- Results are returned as rows; every row should show ok = true.
--
-- Note: each test uses the real Postgres role (anon / authenticated) via
-- SET ROLE, so RLS is exercised exactly as a browser would hit it.
-- Since migration 0003, place_order needs an uploaded file per item. The
-- fixtures below insert customer_files rows directly (as the test owner), with
-- the page counts the server would have measured.
--
-- The run is one transaction, rolled back at the end, so it leaves no rows behind.
-- =========================================================

begin;

create temp table stage1_results (name text, ok boolean, detail text) on commit drop;
grant select, insert on stage1_results to anon, authenticated;

create or replace function pg_temp.fixture_file(p_shop_slug text, p_pages integer) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.customer_files (id, shop_id, storage_path, mime_type, size_bytes, page_count, original_name)
  select x.u, s.id, s.id::text || '/' || x.u::text || '.pdf', 'application/pdf', 1024, p_pages, 'fixture.pdf'
  from public.shops s, (select gen_random_uuid() as u) x
  where s.slug = p_shop_slug
  returning id into v_id;
  return v_id;
end $$;

do $$
declare
  shop_a    uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  shop_b    uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  owner_a   uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  owner_b   uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  svc_doc   uuid := 'cccccccc-0000-0000-0000-000000000001';
  svc_photo uuid := 'cccccccc-0000-0000-0000-000000000002';
  svc_old   uuid := 'cccccccc-0000-0000-0000-000000000003';
  svc_b     uuid := 'cccccccc-0000-0000-0000-000000000004';
  svc_sheet uuid := 'cccccccc-0000-0000-0000-000000000005';
  f01 uuid; f02a uuid; f02b uuid; f03 uuid; f04 uuid; f05 uuid;
  f06 uuid; f07 uuid; f09 uuid; f10 uuid; f11 uuid;
  res jsonb;
  code_a text;
  order_a uuid;
  order_b_id uuid;
  new_shop uuid;
  n int;
  cnt int;
begin
  -- fixtures: one file per order item, because a file can be used once
  f01  := pg_temp.fixture_file('demo-xerox', 12);
  f02a := pg_temp.fixture_file('demo-xerox', 12);
  f02b := pg_temp.fixture_file('demo-xerox', 12);
  f03  := pg_temp.fixture_file('demo-xerox', 1);
  f04  := pg_temp.fixture_file('demo-xerox', 12);
  f05  := pg_temp.fixture_file('demo-xerox', 1);
  f06  := pg_temp.fixture_file('demo-xerox', 1);
  f07  := pg_temp.fixture_file('demo-xerox', 1);
  f09  := pg_temp.fixture_file('other-print', 1);
  f10  := pg_temp.fixture_file('other-print', 5);
  f11  := pg_temp.fixture_file('other-print', 1);

  -- T01 anon order: per_side = pages x copies x unit price
  begin
    execute 'set role anon';
    res := public.place_order('demo-xerox',
      jsonb_build_array(jsonb_build_object('service_id', svc_doc, 'file_id', f01, 'copies', 2, 'colour', false, 'duplex', true)),
      'test-run');
    execute 'reset role';
    code_a := res->>'tracking_code';
    insert into stage1_results values ('T01 per_side total = 12 pages x 2 copies x 200 paise = 4800',
      (res->>'total_paise')::int = 4800, res::text);
  exception when others then
    execute 'reset role';
    insert into stage1_results values ('T01 per_side total = 4800', false, sqlerrm);
  end;

  select id into order_a from public.orders where tracking_code = code_a;

  -- T02 per_sheet: duplex halves sheets, simplex does not
  begin
    execute 'set role anon';
    res := public.place_order('demo-xerox',
      jsonb_build_array(
        jsonb_build_object('service_id', svc_sheet, 'file_id', f02a, 'copies', 2, 'duplex', true),
        jsonb_build_object('service_id', svc_sheet, 'file_id', f02b, 'copies', 2, 'duplex', false)),
      'test-run');
    execute 'reset role';
    insert into stage1_results values ('T02 per_sheet: duplex = 6x2x150 = 1800; simplex = 12x2x150 = 3600',
      (res->'items'->0->>'amount_paise')::int = 1800 and (res->'items'->1->>'amount_paise')::int = 3600, res::text);
  exception when others then
    execute 'reset role';
    insert into stage1_results values ('T02 per_sheet duplex vs simplex', false, sqlerrm);
  end;

  -- T03 per_copy colour: 3 copies x 3000
  begin
    execute 'set role anon';
    res := public.place_order('demo-xerox',
      jsonb_build_array(jsonb_build_object('service_id', svc_photo, 'file_id', f03, 'copies', 3, 'colour', true)),
      'test-run');
    execute 'reset role';
    insert into stage1_results values ('T03 per_copy colour: 3 x 3000 = 9000', (res->>'total_paise')::int = 9000, res::text);
  exception when others then
    execute 'reset role';
    insert into stage1_results values ('T03 per_copy colour', false, sqlerrm);
  end;

  -- T04 injected prices, totals and page counts are ignored (pages come from the file)
  begin
    execute 'set role anon';
    res := public.place_order('demo-xerox',
      jsonb_build_array(jsonb_build_object('service_id', svc_doc, 'file_id', f04, 'page_count', 1, 'copies', 2, 'colour', false,
        'duplex', true, 'unit_price_paise', 1, 'amount_paise', 1, 'total_paise', 1)),
      'test-run');
    execute 'reset role';
    insert into stage1_results values ('T04 injected prices and page_count ignored; total still 4800 from the 12-page file',
      (res->>'total_paise')::int = 4800 and (res->'items'->0->>'page_count')::int = 12, res::text);
  exception when others then
    execute 'reset role';
    insert into stage1_results values ('T04 injected prices ignored', false, sqlerrm);
  end;

  -- T05 colour not offered
  begin
    execute 'set role anon';
    perform public.place_order('demo-xerox',
      jsonb_build_array(jsonb_build_object('service_id', svc_sheet, 'file_id', f05, 'copies', 1, 'colour', true)), 'test-run');
    execute 'reset role';
    insert into stage1_results values ('T05 colour not offered is rejected', false, 'no error raised');
  exception when others then
    execute 'reset role';
    insert into stage1_results values ('T05 colour not offered is rejected', sqlerrm ilike '%not offered%', sqlerrm);
  end;

  -- T06 inactive service
  begin
    execute 'set role anon';
    perform public.place_order('demo-xerox',
      jsonb_build_array(jsonb_build_object('service_id', svc_old, 'file_id', f06, 'copies', 1)), 'test-run');
    execute 'reset role';
    insert into stage1_results values ('T06 inactive service is rejected', false, 'no error raised');
  exception when others then
    execute 'reset role';
    insert into stage1_results values ('T06 inactive service is rejected', sqlerrm ilike '%not available%', sqlerrm);
  end;

  -- T07 service from another shop
  begin
    execute 'set role anon';
    perform public.place_order('demo-xerox',
      jsonb_build_array(jsonb_build_object('service_id', svc_b, 'file_id', f07, 'copies', 1)), 'test-run');
    execute 'reset role';
    insert into stage1_results values ('T07 other shop service is rejected', false, 'no error raised');
  exception when others then
    execute 'reset role';
    insert into stage1_results values ('T07 other shop service is rejected', sqlerrm ilike '%not available%', sqlerrm);
  end;

  -- T08 a file with 0 pages cannot be stored (the server measures pages; the table enforces 1-500)
  begin
    insert into public.customer_files (id, shop_id, storage_path, mime_type, size_bytes, page_count, original_name)
    select x.u, id, id::text || '/' || x.u::text || '.pdf', 'application/pdf', 1024, 0, 'zero.pdf'
    from public.shops, (select gen_random_uuid() as u) x where slug = 'demo-xerox';
    insert into stage1_results values ('T08 a file with 0 pages cannot be stored', false, 'no error raised');
  exception when others then
    insert into stage1_results values ('T08 a file with 0 pages cannot be stored', sqlstate = '23514', sqlstate || ': ' || sqlerrm);
  end;

  -- T09 closed shop
  begin
    update public.shops set is_open = false where id = shop_b;
    begin
      execute 'set role anon';
      perform public.place_order('other-print',
        jsonb_build_array(jsonb_build_object('service_id', svc_b, 'file_id', f09, 'copies', 1)), 'test-run');
      execute 'reset role';
      insert into stage1_results values ('T09 closed shop rejects orders', false, 'no error raised');
    exception when others then
      execute 'reset role';
      insert into stage1_results values ('T09 closed shop rejects orders', sqlerrm ilike '%closed%', sqlerrm);
    end;
    update public.shops set is_open = true where id = shop_b;
  end;

  -- T09b a file uploaded to another shop cannot be used here
  begin
    execute 'set role anon';
    perform public.place_order('demo-xerox',
      jsonb_build_array(jsonb_build_object('service_id', svc_doc, 'file_id', f11, 'copies', 1)), 'test-run');
    execute 'reset role';
    insert into stage1_results values ('T09b a file from another shop is rejected', false, 'no error raised');
  exception when others then
    execute 'reset role';
    insert into stage1_results values ('T09b a file from another shop is rejected', sqlstate = 'P0002', sqlstate || ': ' || sqlerrm);
  end;

  -- order in shop B for the isolation checks below
  execute 'set role anon';
  res := public.place_order('other-print',
    jsonb_build_array(jsonb_build_object('service_id', svc_b, 'file_id', f10, 'copies', 1, 'colour', false)), 'test-run');
  execute 'reset role';
  select id into order_b_id from public.orders where tracking_code = res->>'tracking_code';

  -- T10 / T11 anon cannot read orders directly
  begin
    execute 'set role anon';
    select count(*) into cnt from public.orders;
    execute 'reset role';
    insert into stage1_results values ('T10 anon cannot read orders table', cnt = 0, 'visible=' || cnt);
  exception when others then
    execute 'reset role';
    insert into stage1_results values ('T10 anon cannot read orders table', sqlerrm ilike '%permission denied%', sqlerrm);
  end;

  begin
    execute 'set role anon';
    select count(*) into cnt from public.order_items;
    execute 'reset role';
    insert into stage1_results values ('T11 anon cannot read order_items', cnt = 0, 'visible=' || cnt);
  exception when others then
    execute 'reset role';
    insert into stage1_results values ('T11 anon cannot read order_items', sqlerrm ilike '%permission denied%', sqlerrm);
  end;

  -- ===== owner A session =====
  execute 'set role authenticated';
  perform set_config('request.jwt.claim.sub', owner_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);

  select count(*) into cnt from public.orders where shop_id = shop_a;
  select count(*) into n from public.orders where shop_id = shop_b;
  insert into stage1_results values ('T12 owner A sees own orders only', cnt >= 1 and n = 0, 'own=' || cnt || ' other=' || n);

  select count(*) into n from public.order_items where shop_id = shop_b;
  insert into stage1_results values ('T13 owner A cannot read shop B items', n = 0, 'visible=' || n);

  update public.orders set status = 'approved' where id = order_b_id;
  get diagnostics n = row_count;
  insert into stage1_results values ('T14 owner A cannot update shop B order', n = 0, 'rows=' || n);

  update public.orders set status = 'approved' where id = order_a;
  get diagnostics n = row_count;
  insert into stage1_results values ('T15 owner A approves own order', n = 1, 'rows=' || n);

  begin
    update public.orders set status = 'pending' where id = order_a;
    insert into stage1_results values ('T16 invalid status transition rejected', false, 'no error raised');
  exception when others then
    insert into stage1_results values ('T16 invalid status transition rejected', sqlerrm ilike '%invalid order status%', sqlerrm);
  end;

  begin
    update public.orders set total_paise = 1 where id = order_a;
    insert into stage1_results values ('T17 owner cannot change order total', false, 'no error raised');
  exception when others then
    insert into stage1_results values ('T17 owner cannot change order total',
      sqlerrm ilike '%permission denied%' or sqlerrm ilike '%immutable%', sqlerrm);
  end;

  begin
    update public.order_items set amount_paise = 1 where order_id = order_a;
    insert into stage1_results values ('T18 price snapshot cannot be edited', false, 'no error raised');
  exception when others then
    insert into stage1_results values ('T18 price snapshot cannot be edited',
      sqlerrm ilike '%permission denied%' or sqlerrm ilike '%immutable%', sqlerrm);
  end;

  update public.services set name = 'hacked' where id = svc_b;
  get diagnostics n = row_count;
  insert into stage1_results values ('T19a owner A cannot edit shop B service', n = 0, 'rows=' || n);

  begin
    insert into public.services (shop_id, name, pricing_unit, bw_price_paise)
    values (shop_b, 'injected', 'per_side', 100);
    insert into stage1_results values ('T19b owner A cannot add service to shop B', false, 'no error raised');
  exception when others then
    insert into stage1_results values ('T19b owner A cannot add service to shop B',
      sqlerrm ilike '%row-level security%', sqlerrm);
  end;

  select count(*) into n from public.shop_memberships where shop_id = shop_b;
  insert into stage1_results values ('T20 owner A cannot see shop B memberships', n = 0, 'visible=' || n);

  update public.shops set name = 'Hacked Shop' where id = shop_b;
  get diagnostics n = row_count;
  insert into stage1_results values ('T21 owner A cannot rename shop B', n = 0, 'rows=' || n);

  -- unique slug so the suite can be re-run without clashing with an earlier run
  select (public.create_shop('test-' || substr(md5(random()::text), 1, 10), 'Test New Shop', null, null)).id into new_shop;
  execute 'reset role';
  select count(*) into n from public.shop_memberships
   where shop_id = new_shop and user_id = owner_a and role = 'owner';
  insert into stage1_results values ('T22 create_shop makes creator the owner', n = 1, 'memberships=' || n);

  -- ===== owner B session =====
  execute 'set role authenticated';
  perform set_config('request.jwt.claim.sub', owner_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner_b, 'role', 'authenticated')::text, true);

  select count(*) into cnt from public.orders where shop_id = shop_b;
  select count(*) into n from public.orders where shop_id = shop_a;
  insert into stage1_results values ('T23 owner B sees own orders only', cnt >= 1 and n = 0, 'own=' || cnt || ' other=' || n);

  update public.shops set name = 'Hacked Shop' where id = shop_a;
  get diagnostics n = row_count;
  insert into stage1_results values ('T24 owner B cannot rename shop A', n = 0, 'rows=' || n);

  execute 'reset role';

  -- ===== customer tracking =====
  execute 'set role anon';
  res := public.track_order(lower(code_a));
  execute 'reset role';
  insert into stage1_results values ('T25 tracking by code (case-insensitive) returns status without customer note',
    res is not null and res->>'status' = 'approved' and res->>'shop_name' = 'Demo Xerox Centre' and not (res ? 'customer_note'),
    coalesce(res::text, 'null'));

  execute 'set role anon';
  res := public.track_order('ZZZZZZZZ');
  execute 'reset role';
  insert into stage1_results values ('T26 unknown tracking code returns nothing', res is null, coalesce(res::text, 'null'));

  insert into stage1_results values ('T27 tracking code format is 8 unambiguous characters',
    code_a ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$', code_a);

  -- T28 reserved slug rejected
  execute 'set role authenticated';
  perform set_config('request.jwt.claim.sub', owner_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  begin
    perform public.create_shop('admin', 'Admin Shop', null, null);
    execute 'reset role';
    insert into stage1_results values ('T28 reserved slug rejected', false, 'no error raised');
  exception when others then
    execute 'reset role';
    insert into stage1_results values ('T28 reserved slug rejected', sqlerrm ilike '%violates check constraint%', sqlerrm);
  end;
end $$;

select name, ok, detail from stage1_results order by name;

rollback;
