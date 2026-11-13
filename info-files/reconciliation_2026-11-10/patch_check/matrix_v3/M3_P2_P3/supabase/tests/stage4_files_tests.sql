-- =========================================================
-- Stage 4 database tests: customer files and server-side page counts.
-- Run AFTER migrations 0001-0003 and the dev seed.
--
-- The upload-file edge function stores files with the service role. These
-- tests stand in for it by inserting customer_files rows as the test owner,
-- with the page counts the server would measure. Everything after that runs
-- as the real anon / authenticated roles, the way the browser would call it.
--
-- The run is one transaction, rolled back at the end, so it leaves no rows.
-- Every row in the result should show ok = true.
-- =========================================================

begin;

create temp table stage4_results (name text, ok boolean, detail text) on commit drop;
grant select, insert on stage4_results to anon, authenticated;

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
  insert into stage4_results values (p_name, n = p_expected, 'count=' || n);
exception when others then
  insert into stage4_results values (p_name, false, sqlstate || ': ' || sqlerrm);
end $$;

create or replace function pg_temp.expect_error(p_name text, p_state text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into stage4_results values (p_name, false, 'no error was raised');
exception when others then
  insert into stage4_results values (p_name, sqlstate = p_state, sqlstate || ': ' || sqlerrm);
end $$;

-- Passes when the caller sees no rows, or is refused outright. Either way the bytes stay hidden.
create or replace function pg_temp.expect_hidden(p_name text, p_sql text) returns void language plpgsql as $$
declare n int;
begin
  execute p_sql into n;
  insert into stage4_results values (p_name, n = 0, 'visible=' || n);
exception when others then
  insert into stage4_results values (p_name, sqlstate = '42501', sqlstate || ': ' || sqlerrm);
end $$;

-- Test fixture: a customer_files row as the upload function would leave it.
create or replace function pg_temp.fixture_file(
  p_shop_slug text,
  p_pages integer,
  p_name text default 'fixture.pdf',
  p_expires timestamptz default null
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.customer_files (id, shop_id, storage_path, mime_type, size_bytes, page_count, original_name, expires_at)
  select x.u, s.id, s.id::text || '/' || x.u::text || '.pdf', 'application/pdf', 2048, p_pages, p_name,
         coalesce(p_expires, now() + interval '1 day')
  from public.shops s, (select gen_random_uuid() as u) x
  where s.slug = p_shop_slug
  returning id into v_id;
  return v_id;
end $$;

do $$
declare
  owner_a    uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  owner_b    uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  svc_a      uuid := 'cccccccc-0000-0000-0000-000000000001';  -- Document printing: per_side, B&W 200
  f_ok       uuid;
  f_ok2      uuid;
  f_expired  uuid;
  f_other    uuid;
  f_dup      uuid;
  f_rollback uuid;
  f_fresh    uuid;
  res        jsonb;
  v_order    uuid;
  n          int;
  ok         boolean;
begin
  -- Fixtures are created as the test owner, before any role change.
  f_ok       := pg_temp.fixture_file('demo-xerox', 3, 'notes.pdf');
  f_ok2      := pg_temp.fixture_file('demo-xerox', 5, 'slides.pdf');
  f_expired  := pg_temp.fixture_file('demo-xerox', 2, 'old.pdf', now() - interval '1 minute');
  f_other    := pg_temp.fixture_file('other-print', 2, 'other.pdf');
  f_dup      := pg_temp.fixture_file('demo-xerox', 2, 'dup.pdf');
  f_rollback := pg_temp.fixture_file('demo-xerox', 4, 'rollback.pdf');
  f_fresh    := pg_temp.fixture_file('demo-xerox', 1, 'fresh.pdf');

  -- F01 the bucket is private, 10 MB, and takes only PDF, JPEG and PNG
  select exists (
    select 1 from storage.buckets
    where id = 'customer-files'
      and public = false
      and file_size_limit = 10485760
      and cardinality(allowed_mime_types) = 3
      and allowed_mime_types @> array['application/pdf', 'image/jpeg', 'image/png']
  ) into ok;
  insert into stage4_results values ('F01 customer-files bucket is private, 10 MB, PDF/JPEG/PNG only', ok, 'checked');

  -- F02 - F05 who can see or write the file table and the stored objects
  perform pg_temp.set_user(null);
  perform pg_temp.expect_error('F02 anon cannot read customer_files', '42501',
    'select count(*) from public.customer_files');
  perform pg_temp.expect_error('F03 anon cannot add a customer file', '42501',
    format('insert into public.customer_files (shop_id, storage_path, mime_type, size_bytes, page_count, original_name) '
           'select id, %L, %L, 1, 1, %L from public.shops where slug = %L',
           'hack/x.pdf', 'application/pdf', 'hack.pdf', 'demo-xerox'));
  perform pg_temp.expect_hidden('F04 anon sees no stored objects in customer-files',
    'select count(*) from storage.objects where bucket_id = ''customer-files''');
  perform pg_temp.clear_user();

  perform pg_temp.set_user(owner_a);
  perform pg_temp.expect_error('F05 an owner cannot read customer_files directly', '42501',
    'select count(*) from public.customer_files');
  perform pg_temp.expect_error('F06 an owner cannot change a customer file', '42501',
    format('update public.customer_files set original_name = %L where id = %L', 'renamed.pdf', f_ok2));
  perform pg_temp.expect_hidden('F07 an owner sees no stored objects in customer-files',
    'select count(*) from storage.objects where bucket_id = ''customer-files''');
  perform pg_temp.clear_user();

  -- F08 place_order prices from the server's page count (3 pages x 2 copies x 200 = 1200)
  begin
    perform pg_temp.set_user(null);
    res := public.place_order('demo-xerox',
      jsonb_build_array(jsonb_build_object('service_id', svc_a, 'file_id', f_ok, 'copies', 2)),
      'stage4-test');
    perform pg_temp.clear_user();
    select id into v_order from public.orders where tracking_code = res->>'tracking_code';
    select exists (
      select 1 from public.order_items oi
      where oi.order_id = v_order and oi.file_id = f_ok and oi.file_name = 'notes.pdf'
        and oi.page_count = 3 and oi.amount_paise = 1200
    ) into ok;
    insert into stage4_results values ('F08 the server page count prices the order (3 x 2 x 200 = 1200) and the file name is kept',
      ok and (res->>'total_paise')::int = 1200, res::text);
  exception when others then
    perform pg_temp.clear_user();
    insert into stage4_results values ('F08 server page count prices the order', false, sqlstate || ': ' || sqlerrm);
  end;

  -- F09 the order claims the file
  select exists (select 1 from public.customer_files where id = f_ok and claimed_order_id = v_order) into ok;
  insert into stage4_results values ('F09 the file is claimed by the order it was used in', ok, 'checked');

  -- F10 quote prices from the file and claims nothing (5 pages x 1 copy x 200 = 1000)
  begin
    perform pg_temp.set_user(null);
    res := public.quote_order('demo-xerox',
      jsonb_build_array(jsonb_build_object('service_id', svc_a, 'file_id', f_ok2, 'copies', 1)));
    perform pg_temp.clear_user();
    select exists (select 1 from public.customer_files where id = f_ok2 and claimed_order_id is null) into ok;
    insert into stage4_results values ('F10 quote prices from the 5-page file (1000) and claims nothing',
      ok and (res->>'total_paise')::int = 1000, res::text);
  exception when others then
    perform pg_temp.clear_user();
    insert into stage4_results values ('F10 quote prices from the file', false, sqlstate || ': ' || sqlerrm);
  end;

  -- F11 a claimed file cannot be ordered again
  perform pg_temp.set_user(null);
  perform pg_temp.expect_error('F11 a claimed file cannot be ordered again', 'P0002',
    format('select public.place_order(%L, jsonb_build_array(jsonb_build_object(''service_id'', %L, ''file_id'', %L, ''copies'', 1)), null)',
           'demo-xerox', svc_a, f_ok));
  perform pg_temp.clear_user();

  -- F12 the same file cannot appear twice in one order
  perform pg_temp.set_user(null);
  perform pg_temp.expect_error('F12 the same file cannot be used twice in one order', '22023',
    format('select public.place_order(%L, jsonb_build_array('
           'jsonb_build_object(''service_id'', %L, ''file_id'', %L, ''copies'', 1), '
           'jsonb_build_object(''service_id'', %L, ''file_id'', %L, ''copies'', 1)), null)',
           'demo-xerox', svc_a, f_dup, svc_a, f_dup));
  perform pg_temp.clear_user();

  -- F13 an item without a file is refused
  perform pg_temp.set_user(null);
  perform pg_temp.expect_error('F13 an item without an uploaded file is refused', '22023',
    format('select public.place_order(%L, jsonb_build_array(jsonb_build_object(''service_id'', %L, ''copies'', 1)), null)',
           'demo-xerox', svc_a));
  perform pg_temp.clear_user();

  -- F14 an expired file cannot be ordered
  perform pg_temp.set_user(null);
  perform pg_temp.expect_error('F14 an expired file cannot be ordered', 'P0002',
    format('select public.place_order(%L, jsonb_build_array(jsonb_build_object(''service_id'', %L, ''file_id'', %L, ''copies'', 1)), null)',
           'demo-xerox', svc_a, f_expired));
  perform pg_temp.clear_user();

  -- F15 a file uploaded to another shop cannot be used here
  perform pg_temp.set_user(null);
  perform pg_temp.expect_error('F15 a file from another shop cannot be used', 'P0002',
    format('select public.place_order(%L, jsonb_build_array(jsonb_build_object(''service_id'', %L, ''file_id'', %L, ''copies'', 1)), null)',
           'demo-xerox', svc_a, f_other));
  perform pg_temp.clear_user();

  -- F16 a refused multi-item order leaves no order behind, and its first file stays free
  perform pg_temp.set_user(null);
  perform pg_temp.expect_error('F16 a refused multi-item order is rejected', 'P0002',
    format('select public.place_order(%L, jsonb_build_array('
           'jsonb_build_object(''service_id'', %L, ''file_id'', %L, ''copies'', 1), '
           'jsonb_build_object(''service_id'', %L, ''file_id'', %L, ''copies'', 1)), %L)',
           'demo-xerox', svc_a, f_rollback, svc_a, f_expired, 'stage4-rollback'));
  perform pg_temp.clear_user();
  select exists (select 1 from public.customer_files where id = f_rollback and claimed_order_id is null) into ok;
  select count(*) into n from public.orders where customer_note = 'stage4-rollback';
  insert into stage4_results values ('F16b no order was written and the first file is still free',
    ok and n = 0, 'orders=' || n || ' first file free=' || ok);

  -- F17 a file can back only one order item, enforced by the database too
  begin
    insert into public.order_items (order_id, shop_id, service_id, service_name, pricing_unit,
      file_id, file_name, page_count, copies, colour, duplex, billable_units, unit_price_paise, amount_paise)
    select o.id, o.shop_id, svc_a, 'Document printing', 'per_side',
           f_ok, 'notes.pdf', 3, 1, false, false, 3, 200, 600
    from public.orders o
    where o.customer_note = 'stage4-test'
    limit 1;
    insert into stage4_results values ('F17 a file cannot back a second order item', false, 'no error raised');
  exception when others then
    insert into stage4_results values ('F17 a file cannot back a second order item', sqlstate = '23505', sqlstate || ': ' || sqlerrm);
  end;

  -- F18 the table refuses a file name over 120 characters
  begin
    insert into public.customer_files (id, shop_id, storage_path, mime_type, size_bytes, page_count, original_name)
    select x.u, id, id::text || '/' || x.u::text || '.pdf', 'application/pdf', 1024, 1, repeat('a', 121)
    from public.shops, (select gen_random_uuid() as u) x where slug = 'demo-xerox';
    insert into stage4_results values ('F18 a file name over 120 characters is refused', false, 'no error raised');
  exception when others then
    insert into stage4_results values ('F18 a file name over 120 characters is refused', sqlstate = '23514', sqlstate || ': ' || sqlerrm);
  end;

  -- F19 the table refuses types other than PDF, JPEG and PNG
  begin
    insert into public.customer_files (shop_id, storage_path, mime_type, size_bytes, page_count, original_name)
    select id, 'fixture/zip-' || gen_random_uuid()::text, 'application/zip', 1024, 1, 'archive.zip'
    from public.shops where slug = 'demo-xerox';
    insert into stage4_results values ('F19 only PDF, JPEG and PNG can be stored', false, 'no error raised');
  exception when others then
    insert into stage4_results values ('F19 only PDF, JPEG and PNG can be stored', sqlstate = '23514', sqlstate || ': ' || sqlerrm);
  end;

  -- F20 owners see the file name on their own shop's order items
  perform pg_temp.set_user(owner_a);
  perform pg_temp.expect_count('F20 owner A sees the file name on own order item', 1,
    format('select count(*) from public.order_items where file_id = %L and file_name = ''notes.pdf''', f_ok));
  perform pg_temp.clear_user();

  -- F21 owners of other shops see nothing
  perform pg_temp.set_user(owner_b);
  perform pg_temp.expect_count('F21 owner B cannot see demo-xerox file names', 0,
    format('select count(*) from public.order_items where file_id = %L', f_ok));
  perform pg_temp.clear_user();

  -- F22 a fresh unclaimed file is still usable (guards the expiry check against being too strict)
  begin
    perform pg_temp.set_user(null);
    res := public.quote_order('demo-xerox',
      jsonb_build_array(jsonb_build_object('service_id', svc_a, 'file_id', f_fresh, 'copies', 1)));
    perform pg_temp.clear_user();
    insert into stage4_results values ('F22 a fresh unclaimed file quotes normally (1 x 200 = 200)',
      (res->>'total_paise')::int = 200, res::text);
  exception when others then
    perform pg_temp.clear_user();
    insert into stage4_results values ('F22 a fresh unclaimed file quotes normally', false, sqlstate || ': ' || sqlerrm);
  end;
end $$;

select name, ok, detail from stage4_results order by name;

rollback;
