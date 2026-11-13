-- =========================================================
-- Service pricing and server-side refusals (real Postgres).
-- Covers the pricing matrix (unit, duplex, colour, copies, totals), every refusal
-- the ordering path makes, and shop isolation. All quotes go through quote_order as
-- the anon role, which is what a customer's browser calls.
--
-- Runs at every migration level (the runner executes it after 0001-0011, or after a rollback).
-- It uses only objects that exist from 0001-0009, so it does not depend on 0011. No schema changes here.
-- The run is one transaction, rolled back at the end, so it leaves no rows behind.
-- Every row should show ok = true.
-- =========================================================

begin;

create temp table svc_results (name text, ok boolean, detail text) on commit drop;
grant select, insert on svc_results to anon, authenticated;

-- Customers are anonymous. quote_order and place_order are granted to anon.
create or replace function pg_temp.as_customer() returns void language plpgsql as $$
begin
  execute 'set role anon';
end $$;

create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  execute 'reset role';
end $$;

-- Expect the statement to succeed.
create or replace function pg_temp.expect_ok(p_name text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into svc_results values (p_name, true, 'ok');
exception when others then
  insert into svc_results values (p_name, false, sqlstate || ': ' || sqlerrm);
end $$;

-- Expect a quote total.
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

-- Expect a refusal with a specific SQLSTATE.
create or replace function pg_temp.expect_refused(p_name text, p_state text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into svc_results values (p_name, false, 'no error was raised');
exception when others then
  insert into svc_results values (p_name, sqlstate = p_state, sqlstate || ': ' || sqlerrm);
end $$;

-- A quote_order call, as SQL text.
create or replace function pg_temp.quote(p_slug text, p_items jsonb) returns text
language sql immutable as $$
  select format('select public.quote_order(%L, %L::jsonb)', p_slug, p_items::text)
$$;

-- One order item. Copies are passed as JSON so that bad values reach the server as sent.
create or replace function pg_temp.item(
  p_service uuid,
  p_file    uuid,
  p_copies  jsonb   default '1',
  p_colour  boolean default false,
  p_duplex  boolean default false
) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'service_id', p_service, 'file_id', p_file,
    'copies', p_copies, 'colour', p_colour, 'duplex', p_duplex)
$$;

-- Fixture: a customer_files row as the upload function would leave it.
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
  shop_a  uuid := 'bbbbbbbb-0000-0000-0000-000000000001';  -- demo-xerox
  shop_b  uuid := 'bbbbbbbb-0000-0000-0000-000000000002';  -- other-print
  svc_doc uuid := 'cccccccc-0000-0000-0000-000000000001';  -- demo-xerox, per_side, B&W 200, colour 1000
  svc_pht uuid := 'cccccccc-0000-0000-0000-000000000002';  -- demo-xerox, per_copy, colour only, 3000
  svc_off uuid := 'cccccccc-0000-0000-0000-000000000003';  -- demo-xerox, inactive
  svc_sht uuid := 'cccccccc-0000-0000-0000-000000000005';  -- demo-xerox, per_sheet, B&W only, 150
  svc_oth uuid := 'cccccccc-0000-0000-0000-000000000004';  -- other-print, per_side, B&W 250, colour 1200
  f_one   uuid := pg_temp.fixture_file('demo-xerox', 1, 'one.pdf');
  f_two   uuid := pg_temp.fixture_file('demo-xerox', 2, 'two.pdf');
  f_three uuid := pg_temp.fixture_file('demo-xerox', 3, 'three.pdf');
  f_five  uuid := pg_temp.fixture_file('demo-xerox', 5, 'five.pdf');
  f_seven uuid := pg_temp.fixture_file('demo-xerox', 7, 'seven.pdf');
  f_claim uuid := pg_temp.fixture_file('demo-xerox', 1, 'claimed.pdf');
  f_gone  uuid := pg_temp.fixture_file('demo-xerox', 1, 'expired.pdf');
  f_oth   uuid := pg_temp.fixture_file('other-print', 1, 'other.pdf');
  f_big1  uuid := pg_temp.fixture_file('demo-xerox', 1, 'big1.pdf');
  f_big2  uuid := pg_temp.fixture_file('demo-xerox', 1, 'big2.pdf');
  f_big3  uuid := pg_temp.fixture_file('demo-xerox', 1, 'big3.pdf');
  f_big4  uuid := pg_temp.fixture_file('demo-xerox', 1, 'big4.pdf');
  v_bulk  uuid[] := array[]::uuid[];
  v_items jsonb;
  i       integer;
begin
  for i in 1..21 loop
    v_bulk := v_bulk || pg_temp.fixture_file('demo-xerox', 1, 'bulk.pdf');
  end loop;

  perform pg_temp.as_customer();

  -- ---------- Pricing matrix ----------
  -- per_side: every printed side is billed; duplex does not change the side count.
  perform pg_temp.expect_total('P01 per_side colour: 2 pages x 2 copies x 1000 = 4000', 4000,
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_two, '2', true, false))));
  perform pg_temp.expect_total('P02 per_side duplex does not halve sides: 3 x 1 x 200 = 600', 600,
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_three, '1', false, true))));
  -- per_sheet: duplex bills ceil(pages / 2) sheets, simplex bills every page.
  perform pg_temp.expect_total('P03 per_sheet duplex rounds up: ceil(5/2) = 3 x 1 x 150 = 450', 450,
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_sht, f_five, '1', false, true))));
  perform pg_temp.expect_total('P04 per_sheet simplex bills every page: 5 x 2 x 150 = 1500', 1500,
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_sht, f_five, '2', false, false))));
  -- per_copy: one charge per copy, whatever the page count or sides.
  perform pg_temp.expect_total('P05 per_copy ignores pages and sides: 4 x 3000 = 12000', 12000,
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_pht, f_seven, '4', true, true))));
  -- Boundary: 100 copies is allowed.
  perform pg_temp.expect_total('P06 100 copies is allowed: 1 x 100 x 200 = 20000', 20000,
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_one, '100', false, false))));
  -- Totals are the sum of the items.
  perform pg_temp.expect_total('P07 total is the sum of items: 2000 + 750 = 2750', 2750,
    pg_temp.quote('demo-xerox', jsonb_build_array(
      pg_temp.item(svc_doc, f_two, '1', true, false),
      pg_temp.item(svc_sht, f_five, '1', false, false))));
  -- Client-supplied prices, amounts and totals are ignored.
  perform pg_temp.expect_total('P08 client prices and totals are ignored: server says 200', 200,
    pg_temp.quote('demo-xerox', jsonb_build_array(
      pg_temp.item(svc_doc, f_one, '1', false, false) ||
      '{"unit_price_paise": 1, "amount_paise": 1, "billable_units": 1, "total_paise": 1}'::jsonb)));
  -- Another shop prices with its own services.
  perform pg_temp.expect_total('P09 other-print prices its own colour: 1 x 1200 = 1200', 1200,
    pg_temp.quote('other-print', jsonb_build_array(pg_temp.item(svc_oth, f_oth, '1', true, false))));
  -- Up to the online limit (Rs 10,000) is allowed.
  perform pg_temp.expect_total('P10 three colour copy items at the limit: 3 x 300000 = 900000', 900000,
    pg_temp.quote('demo-xerox', jsonb_build_array(
      pg_temp.item(svc_pht, f_big1, '100', true, false),
      pg_temp.item(svc_pht, f_big2, '100', true, false),
      pg_temp.item(svc_pht, f_big3, '100', true, false))));

  -- ---------- Refusals: quantities and shape ----------
  perform pg_temp.expect_refused('V01 copies 0 is refused', '22023',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_one, '0'))));
  perform pg_temp.expect_refused('V02 copies 101 is refused', '22023',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_one, '101'))));
  perform pg_temp.expect_refused('V03 copies as text is refused', '22P02',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_one, '"abc"'))));
  perform pg_temp.expect_refused('V04 fractional copies are refused', '22P02',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_one, '1.5'))));
  perform pg_temp.expect_refused('V05 items must be an array', '22023',
    pg_temp.quote('demo-xerox', jsonb_build_object('service_id', svc_doc)));
  perform pg_temp.expect_refused('V06 an empty order is refused', '22023',
    pg_temp.quote('demo-xerox', '[]'::jsonb));
  select jsonb_agg(pg_temp.item(svc_doc, f)) into v_items from unnest(v_bulk) as f;
  perform pg_temp.expect_refused('V07 more than 20 items is refused', '22023',
    pg_temp.quote('demo-xerox', v_items));
  perform pg_temp.expect_refused('V08 an item without a file is refused', '22023',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, null))));
  perform pg_temp.expect_refused('V09 the same file twice in one order is refused', '22023',
    pg_temp.quote('demo-xerox', jsonb_build_array(
      pg_temp.item(svc_doc, f_one), pg_temp.item(svc_doc, f_one))));

  -- ---------- Refusals: services ----------
  perform pg_temp.expect_refused('V10 a service from another shop is refused', 'P0002',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_oth, f_one))));
  perform pg_temp.expect_refused('V11 an inactive service is refused', 'P0002',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_off, f_one))));
  perform pg_temp.expect_refused('V12 an unknown service is refused', 'P0002',
    pg_temp.quote('demo-xerox', jsonb_build_array(
      pg_temp.item('dddddddd-0000-0000-0000-000000000000', f_one))));
  perform pg_temp.expect_refused('V13 a colour-only service in B&W is refused', '22023',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_pht, f_one, '1', false, false))));
  perform pg_temp.expect_refused('V14 a B&W-only service in colour is refused', '22023',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_sht, f_one, '1', true, false))));

  -- ---------- Refusals: files ----------
  perform pg_temp.expect_refused('V15 a file from another shop is refused', 'P0002',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_oth))));
  perform pg_temp.expect_refused('V16 an unknown shop is refused', 'P0002',
    pg_temp.quote('no-such-shop', jsonb_build_array(pg_temp.item(svc_doc, f_one))));

  -- A file claimed by an order cannot be priced again. place_order claims it.
  perform pg_temp.expect_ok('V17 setup: an order claims a file',
    format('select public.place_order(%L, %L::jsonb, %L)', 'demo-xerox',
      jsonb_build_array(pg_temp.item(svc_doc, f_claim))::text, 'pricing-test'));
  perform pg_temp.expect_refused('V18 a claimed file is refused', 'P0002',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_claim))));

  -- ---------- Refusals: totals ----------
  perform pg_temp.expect_refused('V19 a total over Rs 10,000 is refused', '22023',
    pg_temp.quote('demo-xerox', jsonb_build_array(
      pg_temp.item(svc_pht, f_big1, '100', true, false),
      pg_temp.item(svc_pht, f_big2, '100', true, false),
      pg_temp.item(svc_pht, f_big3, '100', true, false),
      pg_temp.item(svc_pht, f_big4, '100', true, false))));

  -- ---------- Shop settings: a change affects only its own shop ----------
  perform pg_temp.as_postgres();
  update public.shops set features = features || '{"colour_printing": false}'::jsonb where id = shop_a;
  perform pg_temp.as_customer();
  perform pg_temp.expect_refused('V20 colour is refused when demo-xerox has colour off', '22023',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_one, '1', true, false))));
  perform pg_temp.expect_total('V21 other-print colour is unaffected by demo-xerox colour off: 1200', 1200,
    pg_temp.quote('other-print', jsonb_build_array(pg_temp.item(svc_oth, f_oth, '1', true, false))));

  perform pg_temp.as_postgres();
  update public.shops set features = features || '{"colour_printing": true, "double_sided": false}'::jsonb where id = shop_a;
  perform pg_temp.as_customer();
  perform pg_temp.expect_refused('V22 duplex is refused when demo-xerox has double-sided off', '22023',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_one, '1', false, true))));
  perform pg_temp.expect_total('V23 colour works again once switched back on: 1 x 1000 = 1000', 1000,
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_one, '1', true, false))));

  -- A closed shop gives no quote.
  perform pg_temp.as_postgres();
  update public.shops set is_open = false where id = shop_a;
  perform pg_temp.as_customer();
  perform pg_temp.expect_refused('V24 a closed shop gives no quote', 'P0001',
    pg_temp.quote('demo-xerox', jsonb_build_array(pg_temp.item(svc_doc, f_one))));

  perform pg_temp.as_postgres();
end $$;

select name, ok, detail from svc_results order by name;

rollback;
