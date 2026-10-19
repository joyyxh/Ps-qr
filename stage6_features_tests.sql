-- =========================================================
-- Stage 6 database tests: shop features (yes/no), payment QR and the
-- feature checks in pricing.
-- Run AFTER migrations 0001-0004 and the dev seed.
--
-- The run is one transaction, rolled back at the end, so it leaves no rows.
-- Every row in the result should show ok = true.
-- =========================================================

begin;

create temp table stage6_results (name text, ok boolean, detail text) on commit drop;
grant select, insert on stage6_results to anon, authenticated;

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
  insert into stage6_results values (p_name, n = p_expected, 'count=' || n);
exception when others then
  insert into stage6_results values (p_name, false, sqlstate || ': ' || sqlerrm);
end $$;

create or replace function pg_temp.expect_error(p_name text, p_state text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into stage6_results values (p_name, false, 'no error was raised');
exception when others then
  insert into stage6_results values (p_name, sqlstate = p_state, sqlstate || ': ' || sqlerrm);
end $$;

create or replace function pg_temp.expect_ok(p_name text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into stage6_results values (p_name, true, 'ok');
exception when others then
  insert into stage6_results values (p_name, false, sqlstate || ': ' || sqlerrm);
end $$;

-- Test fixture: a customer_files row as the upload function would leave it.
create or replace function pg_temp.fixture_file(
  p_shop_slug text,
  p_pages integer,
  p_name text default 'fixture.pdf'
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.customer_files (shop_id, storage_path, mime_type, size_bytes, page_count, original_name)
  select s.id, 'fixture/' || gen_random_uuid()::text || '.pdf', 'application/pdf', 2048, p_pages, p_name
  from public.shops s
  where s.slug = p_shop_slug
  returning id into v_id;
  return v_id;
end $$;

do $$
declare
  owner_a   uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  owner_b   uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  shop_a    uuid := 'bbbbbbbb-0000-0000-0000-000000000001';  -- demo-xerox
  shop_b    uuid := 'bbbbbbbb-0000-0000-0000-000000000002';  -- other-print
  svc_a     uuid := 'cccccccc-0000-0000-0000-000000000001';  -- Document printing: per_side, B&W 200, colour 1000
  colour_price int;
  f_two     uuid;
  path_a    text := 'bbbbbbbb-0000-0000-0000-000000000001/payment-qr-1a2b3c4d.png';
  path_b    text := 'bbbbbbbb-0000-0000-0000-000000000002/payment-qr-1a2b3c4d.png';
  items_col text;
  items_dup text;
  items_bw  text;
  res       jsonb;
begin
  -- Fixtures are created before any role change, the way the upload function would leave them.
  f_two := pg_temp.fixture_file('demo-xerox', 2, 'two.pdf');
  select colour_price_paise into colour_price from public.services where id = svc_a;

  items_col := jsonb_build_array(jsonb_build_object('service_id', svc_a, 'file_id', f_two, 'copies', 1, 'colour', true))::text;
  items_dup := jsonb_build_array(jsonb_build_object('service_id', svc_a, 'file_id', f_two, 'copies', 1, 'duplex', true))::text;
  items_bw  := jsonb_build_array(jsonb_build_object('service_id', svc_a, 'file_id', f_two, 'copies', 1))::text;

  -- S01-S02 the catalogue
  perform pg_temp.expect_count('S01 the feature catalogue has eight entries', 8,
    'select count(*) from public.feature_catalog');
  perform pg_temp.expect_count('S02 only colour printing and double-sided are enforced at ordering', 2,
    'select count(*) from public.feature_catalog where affects_orders');

  -- S03-S08 anonymous visitors: read what the customer page needs, change nothing
  perform pg_temp.set_user(null);
  perform pg_temp.expect_count('S03 anon can read the catalogue', 8,
    'select count(*) from public.feature_catalog');
  perform pg_temp.expect_error('S04 anon cannot add a feature to the catalogue', '42501',
    'insert into public.feature_catalog (key, label, affects_orders, sort_order) values (''karaoke'', ''Karaoke'', false, 99)');
  perform pg_temp.expect_count('S05 anon can read a shop''s features (the customer page needs them)', 1,
    'select count(*) from public.shops where slug = ''demo-xerox'' and features->>''colour_printing'' = ''true''');
  perform pg_temp.expect_error('S06 anon cannot change a shop''s features', '42501',
    format('update public.shops set features = %L::jsonb where id = %L', '{"colour_printing": false}', shop_a));
  perform pg_temp.expect_error('S07 anon cannot call set_shop_features', '42501',
    format('select public.set_shop_features(%L, %L::jsonb)', shop_a, '{"lamination": true}'));
  perform pg_temp.clear_user();

  -- S08 a new shop starts with colour and double-sided on, lamination off
  begin
    insert into public.shops (slug, name) values ('s6-default-check', 'Default check');
    insert into stage6_results values ('S08 a new shop starts with colour and double-sided on, lamination off',
      (select features->>'colour_printing' = 'true' and features->>'double_sided' = 'true' and features->>'lamination' = 'false'
         from public.shops where slug = 's6-default-check'), 'checked');
  exception when others then
    insert into stage6_results values ('S08 a new shop starts with the default features', false, sqlstate || ': ' || sqlerrm);
  end;

  -- S09-S16 the owner of demo-xerox
  perform pg_temp.set_user(owner_a);
  perform pg_temp.expect_error('S09 an owner cannot change features with a direct update', '42501',
    format('update public.shops set features = %L::jsonb where id = %L', '{"colour_printing": false}', shop_a));
  perform pg_temp.expect_error('S10 an unknown feature key is refused', '22023',
    format('select public.set_shop_features(%L, %L::jsonb)', shop_a, '{"karaoke": true}'));
  perform pg_temp.expect_error('S11 a feature value that is not yes or no is refused', '22023',
    format('select public.set_shop_features(%L, %L::jsonb)', shop_a, '{"lamination": "yes"}'));
  perform pg_temp.expect_error('S12 features must be an object', '22023',
    format('select public.set_shop_features(%L, %L::jsonb)', shop_a, '[true]'));
  perform pg_temp.expect_ok('S13 owner A turns colour printing off',
    format('select public.set_shop_features(%L, %L::jsonb)', shop_a, '{"colour_printing": false}'));
  perform pg_temp.expect_count('S14 the change keeps the other features as they were', 1,
    format('select count(*) from public.shops where id = %L and features->>''colour_printing'' = ''false'' '
           'and features->>''double_sided'' = ''true'' and features->>''lamination'' = ''false''', shop_a));
  perform pg_temp.expect_ok('S15 owner A turns lamination on',
    format('select public.set_shop_features(%L, %L::jsonb)', shop_a, '{"lamination": true}'));
  perform pg_temp.expect_count('S16 a partial change keeps colour printing off', 1,
    format('select count(*) from public.shops where id = %L and features->>''colour_printing'' = ''false'' '
           'and features->>''lamination'' = ''true''', shop_a));
  perform pg_temp.clear_user();

  -- S17 owner B cannot change demo-xerox
  perform pg_temp.set_user(owner_b);
  perform pg_temp.expect_error('S17 owner B cannot change demo-xerox features', '42501',
    format('select public.set_shop_features(%L, %L::jsonb)', shop_a, '{"stapling": true}'));
  perform pg_temp.clear_user();

  -- S18-S23 pricing follows the features
  perform pg_temp.set_user(null);
  perform pg_temp.expect_error('S18 a colour quote is refused while colour printing is off', '22023',
    format('select public.quote_order(%L, %L::jsonb)', 'demo-xerox', items_col));
  perform pg_temp.expect_error('S19 a colour order is refused while colour printing is off', '22023',
    format('select public.place_order(%L, %L::jsonb, %L)', 'demo-xerox', items_col, 'stage6-test'));
  begin
    res := public.quote_order('demo-xerox', items_bw::jsonb);
    insert into stage6_results values ('S20 a B&W quote still works while colour is off (2 pages x 200)',
      (res->>'total_paise')::int = 2 * 200, res::text);
  exception when others then
    insert into stage6_results values ('S20 a B&W quote still works while colour is off', false, sqlstate || ': ' || sqlerrm);
  end;
  perform pg_temp.clear_user();

  perform pg_temp.set_user(owner_a);
  perform pg_temp.expect_ok('S21 owner A turns double-sided off and colour back on',
    format('select public.set_shop_features(%L, %L::jsonb)', shop_a, '{"double_sided": false, "colour_printing": true}'));
  perform pg_temp.clear_user();

  perform pg_temp.set_user(null);
  perform pg_temp.expect_error('S22 a double-sided quote is refused while double-sided is off', '22023',
    format('select public.quote_order(%L, %L::jsonb)', 'demo-xerox', items_dup));
  perform pg_temp.expect_error('S23 a double-sided order is refused while double-sided is off', '22023',
    format('select public.place_order(%L, %L::jsonb, %L)', 'demo-xerox', items_dup, 'stage6-test'));
  begin
    res := public.quote_order('demo-xerox', items_col::jsonb);
    insert into stage6_results values ('S24 a colour quote works again once colour is on (2 pages x 1000)',
      (res->>'total_paise')::int = 2 * colour_price, res::text);
  exception when others then
    insert into stage6_results values ('S24 a colour quote works again once colour is on', false, sqlstate || ': ' || sqlerrm);
  end;
  perform pg_temp.clear_user();

  perform pg_temp.set_user(owner_a);
  perform pg_temp.expect_ok('S25 owner A switches double-sided back on',
    format('select public.set_shop_features(%L, %L::jsonb)', shop_a, '{"double_sided": true}'));
  perform pg_temp.clear_user();

  -- S26-S38 payment QR: bucket, storage policies and the RPC
  perform pg_temp.expect_count('S26 the shop-assets bucket is public, 2 MB, PNG and JPEG only', 1,
    'select count(*) from storage.buckets where id = ''shop-assets'' and public '
    'and file_size_limit = 2097152 and allowed_mime_types @> array[''image/png'', ''image/jpeg'']');

  perform pg_temp.set_user(null);
  perform pg_temp.expect_error('S27 anon cannot upload a payment QR', '42501',
    format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'shop-assets', path_a));
  perform pg_temp.clear_user();

  perform pg_temp.set_user(owner_a);
  perform pg_temp.expect_ok('S28 owner A uploads a payment QR into their own folder',
    format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'shop-assets', path_a));
  perform pg_temp.expect_error('S29 owner A cannot upload into another shop''s folder', '42501',
    format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'shop-assets', path_b));
  perform pg_temp.expect_ok('S30 owner A attaches the uploaded payment QR',
    format('select public.set_payment_qr(%L, %L)', shop_a, path_a));
  perform pg_temp.expect_count('S31 the shop row now points at that file', 1,
    format('select count(*) from public.shops where id = %L and payment_qr_path = %L', shop_a, path_a));
  perform pg_temp.expect_error('S32 owner A cannot attach a file from another shop''s folder', '22023',
    format('select public.set_payment_qr(%L, %L)', shop_a, path_b));
  perform pg_temp.expect_error('S33 owner A cannot attach a file that was never uploaded', 'P0002',
    format('select public.set_payment_qr(%L, %L)', shop_a, 'bbbbbbbb-0000-0000-0000-000000000001/payment-qr-ffffffff.png'));
  perform pg_temp.expect_ok('S34 owner A removes the payment QR',
    format('select public.set_payment_qr(%L, null)', shop_a));
  perform pg_temp.expect_count('S35 the shop row no longer has a payment QR', 1,
    format('select count(*) from public.shops where id = %L and payment_qr_path is null', shop_a));
  perform pg_temp.clear_user();

  perform pg_temp.set_user(owner_b);
  perform pg_temp.expect_error('S36 owner B cannot attach a payment QR to demo-xerox', '42501',
    format('select public.set_payment_qr(%L, %L)', shop_a, path_a));
  perform pg_temp.clear_user();

  perform pg_temp.expect_error('S37 the table refuses a payment QR path with the wrong shape', '23514',
    format('update public.shops set payment_qr_path = %L where id = %L', 'not-a-valid-path.gif', shop_a));
  perform pg_temp.expect_error('S38 the table refuses features that are not an object', '23514',
    format('update public.shops set features = %L::jsonb where id = %L', '[true]', shop_a));

  -- S39-S41 a shop name that looks like a folder path must not open another shop's folder.
  -- (0004 had this hole; 0005 closes it. Confirmed on the live project before the fix.)
  perform pg_temp.set_user(owner_a);
  perform pg_temp.expect_ok('S39 owner A renames their own shop to look like a folder path',
    format('update public.shops set name = %L where id = %L', shop_a::text || '/x', shop_a));
  perform pg_temp.expect_error('S40 owner A still cannot upload into shop B''s folder', '42501',
    format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'shop-assets', 'bbbbbbbb-0000-0000-0000-000000000002/payment-qr-deadbeef.png'));
  perform pg_temp.clear_user();

  insert into storage.objects (bucket_id, name)
  values ('shop-assets', 'bbbbbbbb-0000-0000-0000-000000000002/payment-qr-cafecafe.png');
  perform pg_temp.set_user(owner_a);
  -- Supabase blocks direct SQL deletes on storage tables (the Storage API is the only way),
  -- so this is refused with 42501. Owners delete through the API, where the folder policy applies.
  perform pg_temp.expect_error('S41 owner A cannot delete shop B''s file with SQL', '42501',
    format('delete from storage.objects where bucket_id = %L and name = %L', 'shop-assets', 'bbbbbbbb-0000-0000-0000-000000000002/payment-qr-cafecafe.png'));
  perform pg_temp.clear_user();
  perform pg_temp.expect_count('S42 shop B''s file is still there afterwards', 1,
    'select count(*) from storage.objects where name = ''bbbbbbbb-0000-0000-0000-000000000002/payment-qr-cafecafe.png''');
end $$;

select name, ok, detail from stage6_results order by name;

rollback;
