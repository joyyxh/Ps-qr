-- requires-migration: 0011
-- =========================================================
-- Paper sizes, surcharges and extra charges (real Postgres).
-- Covers: availability (before and after a shop saves settings), the owner functions
-- and their refusals, pricing with surcharges, extra charges and the online limit,
-- order snapshots (later price changes never rewrite an order), the print job's paper
-- size, row-level security, shop isolation, and back-compatibility for older app versions.
--
-- Run AFTER migrations 0001-0011 and the dev seed. Sections run in order because each one
-- depends on the settings the previous one saved. The run is one transaction, rolled back
-- at the end. Every row should show ok = true.
-- =========================================================

begin;

create temp table svc_results (name text, ok boolean, detail text) on commit drop;
grant select, insert on svc_results to anon, authenticated;

create or replace function pg_temp.as_customer() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set role anon';
end $$;

create or replace function pg_temp.as_owner(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'reset role';
end $$;

create or replace function pg_temp.pass(p_name text, p_ok boolean, p_detail text default 'ok') returns void language plpgsql as $$
begin
  insert into svc_results values (p_name, coalesce(p_ok, false), p_detail);
end $$;

create or replace function pg_temp.expect_ok(p_name text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into svc_results values (p_name, true, 'ok');
exception when others then
  insert into svc_results values (p_name, false, sqlstate || ': ' || sqlerrm);
end $$;

create or replace function pg_temp.expect_refused(p_name text, p_state text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into svc_results values (p_name, false, 'no error was raised');
exception when others then
  insert into svc_results values (p_name, sqlstate = p_state, sqlstate || ': ' || sqlerrm);
end $$;

create or replace function pg_temp.expect_total(p_name text, p_expected bigint, p_sql text) returns void language plpgsql as $$
declare v_res jsonb;
begin
  execute p_sql into v_res;
  insert into svc_results values (
    p_name,
    (v_res->>'total_paise')::bigint = p_expected,
    'total=' || coalesce(v_res->>'total_paise', 'null') || ', expected=' || p_expected
  );
exception when others then
  insert into svc_results values (p_name, false, sqlstate || ': ' || sqlerrm);
end $$;

create or replace function pg_temp.quote(p_slug text, p_items jsonb) returns text
language sql immutable as $$
  select format('select public.quote_order(%L, %L::jsonb)', p_slug, p_items::text)
$$;

create or replace function pg_temp.item(
  p_service uuid,
  p_file    uuid,
  p_copies  jsonb   default '1',
  p_colour  boolean default false,
  p_duplex  boolean default false,
  p_paper   text    default null
) returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'service_id', p_service, 'file_id', p_file,
    'copies', p_copies, 'colour', p_colour, 'duplex', p_duplex, 'paper_size', p_paper))
$$;

create or replace function pg_temp.fixture_file(
  p_shop_slug text,
  p_pages     integer,
  p_name      text default 'fixture.pdf'
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.customer_files (id, shop_id, storage_path, mime_type, size_bytes, page_count, original_name)
  select x.u, s.id, s.id::text || '/' || x.u::text || '.pdf', 'application/pdf', 2048, p_pages, p_name
  from public.shops s, (select gen_random_uuid() as u) x
  where s.slug = p_shop_slug
  returning id into v_id;
  return v_id;
end $$;

do $$
declare
  shop_a   uuid := 'bbbbbbbb-0000-0000-0000-000000000001';  -- demo-xerox
  shop_b   uuid := 'bbbbbbbb-0000-0000-0000-000000000002';  -- other-print
  owner_a  uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  owner_b  uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  svc_doc  uuid := 'cccccccc-0000-0000-0000-000000000001';  -- per_side, B&W 200, colour 1000
  svc_pht  uuid := 'cccccccc-0000-0000-0000-000000000002';  -- per_copy, colour only, 3000
  svc_sht  uuid := 'cccccccc-0000-0000-0000-000000000005';  -- per_sheet, B&W only, 150
  svc_oth  uuid := 'cccccccc-0000-0000-0000-000000000004';  -- other-print, per_side, B&W 250
  f_one    uuid := pg_temp.fixture_file('demo-xerox', 1, 'one.pdf');
  f_two    uuid := pg_temp.fixture_file('demo-xerox', 2, 'two.pdf');
  f_five   uuid := pg_temp.fixture_file('demo-xerox', 5, 'five.pdf');
  f_seven  uuid := pg_temp.fixture_file('demo-xerox', 7, 'seven.pdf');
  f_snap   uuid := pg_temp.fixture_file('demo-xerox', 2, 'snapshot.pdf');
  f_snap2  uuid := pg_temp.fixture_file('demo-xerox', 1, 'snapshot2.pdf');
  f_big1   uuid := pg_temp.fixture_file('demo-xerox', 1, 'big1.pdf');
  f_big2   uuid := pg_temp.fixture_file('demo-xerox', 1, 'big2.pdf');
  f_big3   uuid := pg_temp.fixture_file('demo-xerox', 1, 'big3.pdf');
  f_oth    uuid := pg_temp.fixture_file('other-print', 1, 'other.pdf');
  v_res    jsonb;
  v_order  uuid;
  v_n      bigint;
  v_paper  text;
  v_charge text;
  v_settings_paper text;
  v_snap_paper     text;
  v_snap_surcharge integer;
  v_charges_json text := '[{"label":"Binding fee","amount_paise":500,"basis":"per_order","is_active":true},'
                      || '{"label":"Handling","amount_paise":200,"basis":"per_item","is_active":true},'
                      || '{"label":"Old fee","amount_paise":900,"basis":"per_order","is_active":false}]';
  v_paper_json text := '[{"paper_size":"A4","offered":true,"surcharge_paise":0},'
                    || '{"paper_size":"A3","offered":true,"surcharge_paise":100},'
                    || '{"paper_size":"Letter","offered":false,"surcharge_paise":0}]';
begin
  -- ==========================================================
  -- A. Before the shop saves anything: the behaviour older app versions rely on.
  -- ==========================================================
  perform pg_temp.as_customer();
  perform pg_temp.expect_total('A01 no settings: an item without a paper size prints on A4 at no surcharge: 2 x 200 = 400', 400,
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_two))));
  perform pg_temp.expect_total('A02 no settings: an explicit A4 is accepted: 400', 400,
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_two, '1', false, false, 'A4'))));
  perform pg_temp.expect_refused('A03 no settings: A3 is refused because the shop has not offered it', '22023',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_two, '1', false, false, 'A3'))));
  perform pg_temp.expect_refused('A04 an unknown paper size is refused', '22023',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_two, '1', false, false, 'A5'))));
  perform pg_temp.expect_refused('A05 paper sizes are case-sensitive: a3 is refused', '22023',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_two, '1', false, false, 'a3'))));

  -- ==========================================================
  -- B. The owner saves paper settings.
  -- ==========================================================
  perform pg_temp.as_owner(owner_b);
  perform pg_temp.expect_refused('B01 another shop owner cannot change demo-xerox paper sizes', '42501',
    format('select public.set_paper_sizes(%L, %L::jsonb)', shop_a, v_paper_json));

  perform pg_temp.as_owner(owner_a);
  perform pg_temp.expect_ok('B02 the owner saves A4 (free), A3 (Rs 1 surcharge), Letter (off)',
    format('select public.set_paper_sizes(%L, %L::jsonb)', shop_a, v_paper_json));
  v_res := null;
  execute format('select public.set_paper_sizes(%L, %L::jsonb)', shop_a, v_paper_json) into v_res;
  perform pg_temp.pass('B03 the save returns the three sizes it stored',
    jsonb_array_length(v_res) = 3 and (v_res->1->>'surcharge_paise')::integer = 100,
    v_res::text);

  perform pg_temp.expect_refused('B04 the owner cannot write the paper table directly', '42501',
    format('insert into public.shop_paper_sizes (shop_id, paper_size, is_offered) values (%L, %L, true)', shop_a, 'Letter'));
  perform pg_temp.expect_refused('B05 no offered size is refused', '22023',
    format('select public.set_paper_sizes(%L, %L::jsonb)', shop_a, '[{"paper_size":"A4","offered":false}]'));
  perform pg_temp.expect_refused('B06 a surcharge over Rs 1000 is refused', '22023',
    format('select public.set_paper_sizes(%L, %L::jsonb)', shop_a, '[{"paper_size":"A3","offered":true,"surcharge_paise":100001}]'));
  perform pg_temp.expect_refused('B07 a fractional surcharge is refused', '22P02',
    format('select public.set_paper_sizes(%L, %L::jsonb)', shop_a, '[{"paper_size":"A3","offered":true,"surcharge_paise":12.5}]'));
  perform pg_temp.expect_refused('B08 the same size listed twice is refused', '22023',
    format('select public.set_paper_sizes(%L, %L::jsonb)', shop_a, '[{"paper_size":"A4","offered":true},{"paper_size":"A4","offered":true}]'));
  perform pg_temp.expect_refused('B09 an unknown size is refused', '22023',
    format('select public.set_paper_sizes(%L, %L::jsonb)', shop_a, '[{"paper_size":"A5","offered":true}]'));
  perform pg_temp.expect_refused('B10 offered must be yes or no', '22023',
    format('select public.set_paper_sizes(%L, %L::jsonb)', shop_a, '[{"paper_size":"A4","offered":"yes"}]'));
  perform pg_temp.expect_refused('B11 an empty list is refused', '22023',
    format('select public.set_paper_sizes(%L, %L::jsonb)', shop_a, '[]'));

  -- The failed saves above must not have changed what was saved.
  perform pg_temp.as_customer();
  execute format('select count(*) from public.shop_paper_sizes where shop_id = %L', shop_a) into v_n;
  perform pg_temp.pass('B12 after refused saves, the shop still has its three saved sizes (read as a customer)',
    v_n = 3, 'rows=' || v_n);
  perform pg_temp.expect_refused('B13 an anonymous customer cannot call set_paper_sizes', '42501',
    format('select public.set_paper_sizes(%L, %L::jsonb)', shop_a, v_paper_json));

  -- ==========================================================
  -- C. Pricing with the saved paper settings (no extra charges yet).
  -- ==========================================================
  perform pg_temp.expect_total('C01 A4 with a zero surcharge: 2 x 2 x 200 = 800', 800,
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_two, '2', false, false, 'A4'))));
  perform pg_temp.expect_total('C02 A3 surcharge is added to every unit: 4 x (200 + 100) = 1200', 1200,
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_two, '2', false, false, 'A3'))));
  perform pg_temp.expect_total('C03 A3 on a per-sheet duplex job: 3 sheets x (150 + 100) = 750', 750,
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_sht, f_five, '1', false, true, 'A3'))));
  perform pg_temp.expect_total('C04 A3 on a per-copy colour service: 4 x (3000 + 100) = 12400', 12400,
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_pht, f_seven, '4', true, false, 'A3'))));
  perform pg_temp.expect_refused('C05 Letter is refused because the shop turned it off', '22023',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_two, '1', false, false, 'Letter'))));
  perform pg_temp.expect_total('C06 other-print has no paper settings, so it prints A4 at no surcharge: 250', 250,
    pg_temp.quote('other-print', jsonb_build_array(pg_temp.item(svc_oth, f_oth, '1', false, false, 'A4'))));
  perform pg_temp.expect_refused('C07 other-print does not offer A3, even though demo-xerox does', '22023',
    pg_temp.quote('other-print', jsonb_build_array(pg_temp.item(svc_oth, f_oth, '1', false, false, 'A3'))));

  -- ==========================================================
  -- D. Extra charges.
  -- ==========================================================
  perform pg_temp.as_owner(owner_b);
  perform pg_temp.expect_refused('D01 another shop owner cannot change demo-xerox charges', '42501',
    format('select public.set_extra_charges(%L, %L::jsonb)', shop_a, v_charges_json));

  perform pg_temp.as_owner(owner_a);
  perform pg_temp.expect_ok('D02 the owner saves two active charges and one inactive charge',
    format('select public.set_extra_charges(%L, %L::jsonb)', shop_a, v_charges_json));
  perform pg_temp.expect_refused('D03 more than 10 charges is refused', '22023',
    format('select public.set_extra_charges(%L, %L::jsonb)', shop_a,
      (select jsonb_agg(jsonb_build_object('label', 'Fee ' || g, 'amount_paise', 100, 'basis', 'per_order'))::text
         from generate_series(1, 11) g)));
  perform pg_temp.expect_refused('D04 a charge over Rs 1000 is refused', '22023',
    format('select public.set_extra_charges(%L, %L::jsonb)', shop_a, '[{"label":"Big","amount_paise":100001,"basis":"per_order"}]'));
  perform pg_temp.expect_refused('D05 a charge must be per order or per item', '22023',
    format('select public.set_extra_charges(%L, %L::jsonb)', shop_a, '[{"label":"Weekly","amount_paise":100,"basis":"weekly"}]'));
  perform pg_temp.expect_refused('D06 a charge needs a name', '22023',
    format('select public.set_extra_charges(%L, %L::jsonb)', shop_a, '[{"label":"  ","amount_paise":100,"basis":"per_order"}]'));

  -- The owner sees the inactive charge; customers do not.
  execute format('select count(*) from public.shop_extra_charges where shop_id = %L and not is_active', shop_a) into v_n;
  perform pg_temp.pass('D07 the owner sees the inactive charge', v_n = 1, 'rows=' || v_n);
  perform pg_temp.as_customer();
  execute format('select count(*) from public.shop_extra_charges where shop_id = %L', shop_a) into v_n;
  perform pg_temp.pass('D08 a customer sees only the active charges', v_n = 2, 'rows=' || v_n);

  -- Quote: items 1150 (400 + 750), per-order 500, per-item 2 x 200 = 400. The inactive 900 is left out.
  execute pg_temp.quote('demo-xerox', jsonb_build_array(
    pg_temp.item(svc_doc, f_two, '1', false, false, 'A4'),
    pg_temp.item(svc_sht, f_five, '1', false, false, 'A4'))) into v_res;
  perform pg_temp.pass('D09 the quote adds the active charges: 1150 + 500 + 2 x 200 = 2050',
    (v_res->>'total_paise')::bigint = 2050, 'total=' || (v_res->>'total_paise'));
  perform pg_temp.pass('D10 the quote lists the two active charges and not the inactive one',
    jsonb_array_length(v_res->'charges') = 2
    and not exists (select 1 from jsonb_array_elements(v_res->'charges') c where c->>'label' = 'Old fee'),
    coalesce((v_res->'charges')::text, 'null'));

  -- Charges count toward the Rs 10,000 online limit.
  perform pg_temp.as_owner(owner_a);
  perform pg_temp.expect_ok('D11 setup: two Rs 1000 per-order charges',
    format('select public.set_extra_charges(%L, %L::jsonb)', shop_a,
      '[{"label":"Big fee","amount_paise":100000,"basis":"per_order"},{"label":"Bigger fee","amount_paise":100000,"basis":"per_order"}]'));
  perform pg_temp.as_customer();
  perform pg_temp.expect_refused('D12 charges push a Rs 9,000 order over the Rs 10,000 limit', '22023',
    pg_temp.quote('demo-xerox', jsonb_build_array(
      pg_temp.item(svc_pht, f_big1, '100', true, false, 'A4'),
      pg_temp.item(svc_pht, f_big2, '100', true, false, 'A4'),
      pg_temp.item(svc_pht, f_big3, '100', true, false, 'A4'))));
  perform pg_temp.as_owner(owner_a);
  perform pg_temp.expect_ok('D13 setup: one Rs 1000 per-order charge',
    format('select public.set_extra_charges(%L, %L::jsonb)', shop_a,
      '[{"label":"Big fee","amount_paise":100000,"basis":"per_order"}]'));
  perform pg_temp.as_customer();
  perform pg_temp.expect_total('D14 an order at exactly Rs 10,000 is allowed: 900000 + 100000', 1000000,
    pg_temp.quote('demo-xerox', jsonb_build_array(
      pg_temp.item(svc_pht, f_big1, '100', true, false, 'A4'),
      pg_temp.item(svc_pht, f_big2, '100', true, false, 'A4'),
      pg_temp.item(svc_pht, f_big3, '100', true, false, 'A4'))));

  -- Back to the normal charges for the order checks below.
  perform pg_temp.as_owner(owner_a);
  perform pg_temp.expect_ok('D15 setup: the normal charges again',
    format('select public.set_extra_charges(%L, %L::jsonb)', shop_a, v_charges_json));

  -- ==========================================================
  -- E. Orders keep what the customer was charged, even after prices change.
  -- ==========================================================
  perform pg_temp.as_customer();
  execute format(
    'select public.place_order(%L, %L::jsonb, %L)', 'demo-xerox',
    jsonb_build_array(pg_temp.item(svc_doc, f_snap, '2', false, false, 'A3'))::text, 'paper-test')
    into v_res;
  perform pg_temp.pass('E01 an A3 order is placed: 4 x 300 + 500 + 200 = 1900',
    (v_res->>'total_paise')::bigint = 1900, 'total=' || (v_res->>'total_paise'));

  -- Customers cannot read orders directly, so look the new order up as the database owner.
  perform pg_temp.as_postgres();
  v_order := (select id from public.orders where tracking_code = v_res->>'tracking_code');
  select paper_size, paper_surcharge_paise into v_snap_paper, v_snap_surcharge
    from public.order_items where order_id = v_order;
  perform pg_temp.pass('E02 the order item stores its paper size and surcharge',
    v_snap_paper = 'A3' and v_snap_surcharge = 100,
    coalesce(v_snap_paper, 'null') || ' ' || coalesce(v_snap_surcharge::text, 'null'));
  execute format('select count(*) from public.order_charges where order_id = %L', v_order) into v_n;
  perform pg_temp.pass('E03 the order stores the two active charges, not the inactive one', v_n = 2, 'rows=' || v_n);

  -- The owner changes the prices after the order was placed.
  perform pg_temp.as_owner(owner_a);
  perform pg_temp.expect_ok('E04 the owner raises the A3 surcharge and changes the charges',
    format('select public.set_paper_sizes(%L, %L::jsonb)', shop_a,
      '[{"paper_size":"A4","offered":true,"surcharge_paise":0},{"paper_size":"A3","offered":true,"surcharge_paise":500},{"paper_size":"Letter","offered":false,"surcharge_paise":0}]'));
  perform pg_temp.expect_ok('E05 the owner replaces the charges with one Rs 9 per-order fee',
    format('select public.set_extra_charges(%L, %L::jsonb)', shop_a,
      '[{"label":"Binding fee","amount_paise":900,"basis":"per_order","is_active":true}]'));

  perform pg_temp.as_postgres();
  select paper_surcharge_paise into v_snap_surcharge from public.order_items where order_id = v_order;
  perform pg_temp.pass('E06 the placed order keeps its A3 surcharge of 100',
    v_snap_surcharge = 100, 'surcharge=' || v_snap_surcharge);
  perform pg_temp.pass('E07 the placed order keeps its charges, with their old amounts',
    exists (select 1 from public.order_charges where order_id = v_order and label = 'Binding fee' and amount_paise = 500)
    and exists (select 1 from public.order_charges where order_id = v_order and label = 'Handling' and amount_paise = 200),
    'snapshot intact');
  perform pg_temp.pass('E08 the placed order keeps its total of 1900',
    (select total_paise from public.orders where id = v_order) = 1900, 'total unchanged');

  perform pg_temp.as_customer();
  execute pg_temp.quote('demo-xerox', jsonb_build_array(
    pg_temp.item(svc_doc, f_snap2, '2', false, false, 'A3'))) into v_res;
  perform pg_temp.pass('E09 a new order uses the new prices: 2 x 700 + 900 = 2300',
    (v_res->>'total_paise')::bigint = 2300, 'total=' || (v_res->>'total_paise'));

  -- E10: a tampered client price, surcharge and total are ignored. The server prices it.
  perform pg_temp.expect_total('E10 client-supplied surcharge and total are ignored: 2 x 700 + 900 = 2300', 2300,
    pg_temp.quote('demo-xerox', jsonb_build_array(
      pg_temp.item(svc_doc, f_snap2, '2', false, false, 'A3') ||
      '{"paper_surcharge_paise": 0, "amount_paise": 1, "total_paise": 1}'::jsonb)));

  -- E11: the printed job carries the order's paper size, so the print agent gets it.
  -- The owner marks the cash payment received (the same path the app uses), then the order is approved.
  perform pg_temp.as_owner(owner_a);
  perform public.set_order_payment(v_order, 'set_paid', 'cash');
  perform pg_temp.as_postgres();
  update public.orders set status = 'approved' where id = v_order;
  perform pg_temp.as_owner(owner_a);
  execute format('select public.approve_order_for_print(%L)', v_order) into v_res;
  perform pg_temp.as_postgres();
  select settings->>'paper' into v_settings_paper from public.print_jobs where order_id = v_order limit 1;
  perform pg_temp.pass('E11 the print job says A3, which is what the customer chose',
    v_settings_paper = 'A3', 'paper=' || coalesce(v_settings_paper, 'null'));

  -- ==========================================================
  -- F. Back-compatibility, RLS and shop isolation.
  -- ==========================================================
  -- F01: an order from an older app version (no paper size) and a row from before 0011
  -- (paper columns empty) still prints on A4.
  perform pg_temp.as_customer();
  execute format('select public.place_order(%L, %L::jsonb, %L)', 'demo-xerox',
    jsonb_build_array(pg_temp.item(svc_doc, f_snap2))::text, 'legacy-client') into v_res;
  perform pg_temp.as_postgres();
  v_order := (select id from public.orders where tracking_code = v_res->>'tracking_code');
  -- Make the item look like a row written before 0011. Order items are an immutable price
  -- snapshot (forbid_order_item_changes), so the trigger is bypassed for this transaction only.
  -- The whole run is rolled back at the end.
  perform pg_temp.as_postgres();
  perform set_config('session_replication_role', 'replica', true);
  update public.order_items set paper_size = null, paper_surcharge_paise = null where order_id = v_order;
  perform set_config('session_replication_role', 'origin', true);
  perform pg_temp.as_owner(owner_a);
  perform public.set_order_payment(v_order, 'set_paid', 'cash');
  perform pg_temp.as_postgres();
  update public.orders set status = 'approved' where id = v_order;
  perform pg_temp.as_owner(owner_a);
  execute format('select public.approve_order_for_print(%L)', v_order) into v_res;
  perform pg_temp.as_postgres();
  select settings->>'paper' into v_settings_paper from public.print_jobs where order_id = v_order limit 1;
  perform pg_temp.pass('F01 an older order with no paper size prints on A4',
    v_settings_paper = 'A4', 'paper=' || coalesce(v_settings_paper, 'null'));

  perform pg_temp.as_owner(owner_b);
  execute format('select count(*) from public.order_charges where shop_id = %L', shop_a) into v_n;
  perform pg_temp.pass('F02 another shop owner cannot read demo-xerox order charges', v_n = 0, 'rows=' || v_n);
  perform pg_temp.as_owner(owner_a);
  execute format('select count(*) from public.order_charges where shop_id = %L', shop_a) into v_n;
  perform pg_temp.pass('F03 the shop owner can read their own order charges', v_n >= 2, 'rows=' || v_n);
  perform pg_temp.expect_refused('F04 the owner cannot write order charges directly, even their own', '42501',
    format('insert into public.order_charges (order_id, shop_id, label, basis, quantity, amount_paise, total_paise) values (%L, %L, %L, %L, 1, 1, 1)',
      v_order, shop_a, 'Forged', 'per_order'));
  perform pg_temp.as_customer();
  perform pg_temp.expect_refused('F05 a customer cannot read order charges', '42501',
    format('select count(*) from public.order_charges where shop_id = %L', shop_a));

  -- F06: another shop's charges do not touch this shop's totals, and the reverse.
  perform pg_temp.as_owner(owner_b);
  perform pg_temp.expect_ok('F06 setup: other-print adds a Rs 7 per-order fee',
    format('select public.set_extra_charges(%L, %L::jsonb)', shop_b,
      '[{"label":"Shop B fee","amount_paise":700,"basis":"per_order"}]'));
  perform pg_temp.as_customer();
  perform pg_temp.expect_total('F07 demo-xerox is unaffected by other-print charges: 200 + 900 = 1100', 1100,
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_one, '1', false, false, 'A4'))));
  perform pg_temp.expect_total('F08 other-print adds only its own charge: 250 + 700 = 950', 950,
    pg_temp.quote('other-print', jsonb_build_array(pg_temp.item(svc_oth, f_oth, '1', false, false, 'A4'))));

  -- ==========================================================
  -- G. The server prices the paper size; the client's numbers are ignored.
  -- ==========================================================
  perform pg_temp.expect_total('G01 a client that sends surcharge 0 still pays A3: 2 x 700 + 900 = 2300', 2300,
    pg_temp.quote('demo-xerox', jsonb_build_array(
      pg_temp.item(svc_doc, f_one, '2', false, false, 'A3') || '{"paper_surcharge_paise": 0}'::jsonb)));

  perform pg_temp.as_postgres();

  -- ==========================================================
  -- H. Order charges are a price snapshot. The statistics split reconciles, and only owners see it.
  -- ==========================================================
  perform pg_temp.expect_refused('H01 an order charge cannot be changed after the order is placed', '42501',
    format('update public.order_charges set amount_paise = amount_paise + 1 where shop_id = %L', shop_a));

  perform pg_temp.as_owner(owner_a);
  perform pg_temp.expect_ok('H02 the owner reads the statistics split for their shop',
    format('select public.shop_stats_revenue_split(%L, %L::date, %L::date)', shop_a,
      (now() at time zone 'Asia/Kolkata')::date - 1, (now() at time zone 'Asia/Kolkata')::date + 1));
  execute format($q$select (x->>'order_value_paise')::bigint - (x->>'items_paise')::bigint
      - (x->>'extra_charges_paise')::bigint
    from (select public.shop_stats_revenue_split(%L, %L::date, %L::date) as x) s$q$,
    shop_a, (now() at time zone 'Asia/Kolkata')::date - 1, (now() at time zone 'Asia/Kolkata')::date + 1) into v_n;
  perform pg_temp.pass('H03 items plus extra charges equal the order value (difference is zero)', v_n = 0,
    'difference=' || coalesce(v_n::text, 'null'));
  execute format($q$select (x->>'extra_charges_paise')::bigint
    from (select public.shop_stats_revenue_split(%L, %L::date, %L::date) as x) s$q$,
    shop_a, (now() at time zone 'Asia/Kolkata')::date - 1, (now() at time zone 'Asia/Kolkata')::date + 1) into v_n;
  perform pg_temp.pass('H04 the split shows demo-xerox extra charges (the order charges from section F)', v_n > 0,
    'extra=' || coalesce(v_n::text, 'null'));

  perform pg_temp.as_owner(owner_b);
  perform pg_temp.expect_refused('H05 another shop owner cannot read demo-xerox''s statistics split', '42501',
    format('select public.shop_stats_revenue_split(%L, %L::date, %L::date)', shop_a,
      (now() at time zone 'Asia/Kolkata')::date - 1, (now() at time zone 'Asia/Kolkata')::date + 1));

  perform pg_temp.as_customer();
  perform pg_temp.expect_refused('H06 a customer cannot read the statistics split', '42501',
    format('select public.shop_stats_revenue_split(%L, %L::date, %L::date)', shop_a,
      (now() at time zone 'Asia/Kolkata')::date - 1, (now() at time zone 'Asia/Kolkata')::date + 1));
  perform pg_temp.as_postgres();
end $$;

-- ==========================================================
-- I. JPG and PNG pictures can only be ordered on A4 (0011, _price_order_items).
-- A picture is printed as one A4 page, so any other size would be charged and then fail.
-- ==========================================================
create or replace function pg_temp.fixture_picture(p_shop_slug text, p_mime text) returns uuid
language plpgsql as $$
declare
  v_id  uuid;
  v_ext text := case when p_mime = 'image/png' then 'png' else 'jpg' end;
begin
  insert into public.customer_files (id, shop_id, storage_path, mime_type, size_bytes, page_count, original_name)
  select x.u, s.id, s.id::text || '/' || x.u::text || '.' || v_ext, p_mime, 2048, 1, 'picture.' || v_ext
    from public.shops s, (select gen_random_uuid() as u) x
   where s.slug = p_shop_slug
  returning id into v_id;
  return v_id;
end $$;

create or replace function pg_temp.expect_refused_with(p_name text, p_state text, p_fragment text, p_sql text)
returns void language plpgsql as $$
begin
  execute p_sql;
  insert into svc_results values (p_name, false, 'no error was raised');
exception when others then
  insert into svc_results values (
    p_name,
    sqlstate = p_state and sqlerrm ilike '%' || p_fragment || '%',
    sqlstate || ': ' || sqlerrm
  );
end $$;

do $$
declare
  shop_a  uuid := 'bbbbbbbb-0000-0000-0000-000000000001';  -- demo-xerox: A4 and A3 offered, Letter not offered
  svc_doc uuid := 'cccccccc-0000-0000-0000-000000000001';  -- Document printing, per side
  f_jpg   uuid;
  f_png   uuid;
  f_pdf   uuid;
  v_before bigint;
  v_after  bigint;
begin
  f_jpg := pg_temp.fixture_picture('demo-xerox', 'image/jpeg');
  f_png := pg_temp.fixture_picture('demo-xerox', 'image/png');
  f_pdf := pg_temp.fixture_file('demo-xerox', 1, 'pic-check.pdf');

  perform pg_temp.expect_refused_with('I01 a JPG picture cannot be quoted on A3', '22023', 'A4 paper only',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_jpg, '1', false, false, 'A3'))));
  perform pg_temp.expect_refused_with('I02 a PNG picture cannot be quoted on Letter', '22023', 'A4 paper only',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_png, '1', false, false, 'Letter'))));
  perform pg_temp.expect_ok('I03 a JPG picture can still be quoted on A4',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_jpg, '1', false, false, 'A4'))));
  perform pg_temp.expect_ok('I04 a PDF can still be quoted on A3 (the rule is for pictures only)',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_pdf, '1', false, false, 'A3'))));

  -- A refused picture order is not placed, so the customer is not charged for it.
  select count(*) into v_before from public.orders where shop_id = shop_a;
  perform pg_temp.as_customer();
  perform pg_temp.expect_refused_with('I05 a JPG picture cannot be ordered on A3', '22023', 'A4 paper only',
    format('select public.place_order(%L, %L::jsonb, %L)', 'demo-xerox',
      jsonb_build_array(pg_temp.item(svc_doc, f_jpg, '1', false, false, 'A3'))::text, 'check-pic-a3'));
  perform pg_temp.as_postgres();
  select count(*) into v_after from public.orders where shop_id = shop_a;
  perform pg_temp.pass('I06 a refused picture order creates no order row',
    v_after = v_before, 'before=' || v_before || ' after=' || v_after);

  -- A picture on A4 is still accepted: the existing supported path.
  select count(*) into v_before from public.orders where shop_id = shop_a;
  perform pg_temp.as_customer();
  perform pg_temp.expect_ok('I07 a JPG picture on A4 is accepted',
    format('select public.place_order(%L, %L::jsonb, %L)', 'demo-xerox',
      jsonb_build_array(pg_temp.item(svc_doc, f_jpg, '1', false, false, 'A4'))::text, 'check-pic-a4'));
  perform pg_temp.as_postgres();
  select count(*) into v_after from public.orders where shop_id = shop_a;
  perform pg_temp.pass('I08 the accepted A4 picture order creates exactly one order',
    v_after = v_before + 1, 'before=' || v_before || ' after=' || v_after);
end $$;

select name, ok, detail from svc_results order by name;

rollback;
