-- =========================================================
-- Stage 9 database tests: UPI orders and the auto-print function's privileges (migration 0020).
-- Run AFTER the migrations (through 0020) and the dev seed.
--
-- Before 0020, every UPI order failed with "customer payment method is immutable": the
-- four-argument place_order inserted the order as cash, then changed it to UPI, and the
-- payment guard from 0008 refuses that change. These checks cover:
--   - UPI and cash orders are written with the right payment fields in one insert
--   - the payment method is still immutable once the order exists
--   - an approved, paid order still auto-queues for printing with auto print on
--   - auto_print_on_approval is no longer callable by anon, authenticated or public
--
-- One transaction, rolled back at the end, so it leaves nothing behind. Every row in
-- the result should show ok = true.
-- =========================================================

begin;

create temp table stage9_results (name text, ok boolean, detail text) on commit drop;
grant select, insert on stage9_results to anon, authenticated;

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

create or replace function pg_temp.report(p_name text, p_ok boolean, p_detail text) returns void language plpgsql as $$
begin
  insert into stage9_results values (p_name, coalesce(p_ok, false), p_detail);
end $$;

-- Same fixture shape as stage5: one uploaded file, owned by the shop, not yet claimed.
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
  owner_a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  svc_a   uuid := 'cccccccc-0000-0000-0000-000000000001';
  svc_b   uuid := 'cccccccc-0000-0000-0000-000000000004';
  shop_a  uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  f_upi   uuid;
  f_cash  uuid;
  f_three uuid;
  f_other uuid;
  res     jsonb;
  upi_id  uuid;
  cash_id uuid;
  row_o   public.orders%rowtype;
  n       integer;
begin
  -- Fixtures and a configured UPI QR for demo-xerox. Set as the test owner, before any role change.
  update public.shops set payment_qr_path = shop_a::text || '/payment-qr-1a2b3c4d.png' where id = shop_a;
  f_upi   := pg_temp.fixture_file('demo-xerox', 2);
  f_cash  := pg_temp.fixture_file('demo-xerox', 1);
  f_three := pg_temp.fixture_file('demo-xerox', 3);
  f_other := pg_temp.fixture_file('other-print', 1);

  -- U1: an anonymous customer places a UPI order.
  begin
    perform pg_temp.set_user(null);
    res := public.place_order('demo-xerox',
      jsonb_build_array(jsonb_build_object('service_id', svc_a, 'file_id', f_upi, 'copies', 1, 'colour', false, 'duplex', false)),
      'stage9-upi', 'upi');
    perform pg_temp.clear_user();
    select id into upi_id from public.orders where tracking_code = res->>'tracking_code';
    perform pg_temp.report('U1 anonymous UPI order is placed',
      coalesce(res->>'payment_method' = 'upi' and res->>'payment_status' = 'pending', false),
      'payment_method=' || coalesce(res->>'payment_method', 'null') || ' payment_status=' || coalesce(res->>'payment_status', 'null'));
  exception when others then
    perform pg_temp.clear_user();
    perform pg_temp.report('U1 anonymous UPI order is placed', false, sqlstate || ': ' || sqlerrm);
  end;

  -- U2: the stored UPI order carries the payment fields from its insert.
  select * into row_o from public.orders where id = upi_id;
  perform pg_temp.report('U2 stored UPI order is upi, pending, online, pending order',
    coalesce(row_o.customer_payment_method = 'upi' and row_o.payment_status = 'pending'
             and row_o.payment_channel = 'online' and row_o.status = 'pending', false),
    'method=' || coalesce(row_o.customer_payment_method, 'null') || ' status=' || coalesce(row_o.payment_status, 'null')
      || ' channel=' || coalesce(row_o.payment_channel, 'null'));

  -- U3: an anonymous customer places a cash order.
  begin
    perform pg_temp.set_user(null);
    res := public.place_order('demo-xerox',
      jsonb_build_array(jsonb_build_object('service_id', svc_a, 'file_id', f_cash, 'copies', 1, 'colour', false, 'duplex', false)),
      'stage9-cash', 'cash');
    perform pg_temp.clear_user();
    select id into cash_id from public.orders where tracking_code = res->>'tracking_code';
    perform pg_temp.report('U3 anonymous cash order is placed',
      coalesce(res->>'payment_method' = 'cash' and res->>'payment_status' = 'unpaid', false),
      'payment_method=' || coalesce(res->>'payment_method', 'null') || ' payment_status=' || coalesce(res->>'payment_status', 'null'));
  exception when others then
    perform pg_temp.clear_user();
    perform pg_temp.report('U3 anonymous cash order is placed', false, sqlstate || ': ' || sqlerrm);
  end;

  -- U4: the stored cash order is cash, unpaid, with no payment channel.
  select * into row_o from public.orders where id = cash_id;
  perform pg_temp.report('U4 stored cash order is cash, unpaid, no channel',
    coalesce(row_o.customer_payment_method = 'cash' and row_o.payment_status = 'unpaid'
             and row_o.payment_channel is null, false),
    'method=' || coalesce(row_o.customer_payment_method, 'null') || ' status=' || coalesce(row_o.payment_status, 'null')
      || ' channel=' || coalesce(row_o.payment_channel, 'null'));

  -- U5: UPI is refused at a shop that has no QR configured, and nothing is written.
  begin
    perform pg_temp.set_user(null);
    perform public.place_order('other-print',
      jsonb_build_array(jsonb_build_object('service_id', svc_b, 'file_id', f_other, 'copies', 1, 'colour', false, 'duplex', false)),
      'stage9-no-qr', 'upi');
    perform pg_temp.clear_user();
    perform pg_temp.report('U5 UPI is refused where the shop has no QR', false, 'no error was raised');
  exception when others then
    perform pg_temp.clear_user();
    perform pg_temp.report('U5 UPI is refused where the shop has no QR', sqlstate = '22023', sqlstate || ': ' || sqlerrm);
  end;

  -- U6: an unknown payment method is refused.
  begin
    perform pg_temp.set_user(null);
    perform public.place_order('demo-xerox',
      jsonb_build_array(jsonb_build_object('service_id', svc_a, 'file_id', f_other, 'copies', 1, 'colour', false, 'duplex', false)),
      'stage9-bad-method', 'card');
    perform pg_temp.clear_user();
    perform pg_temp.report('U6 unknown payment method is refused', false, 'no error was raised');
  exception when others then
    perform pg_temp.clear_user();
    perform pg_temp.report('U6 unknown payment method is refused', sqlstate = '22023', sqlstate || ': ' || sqlerrm);
  end;

  -- U7: the three-argument place_order (kept for existing callers) still places a cash order.
  begin
    perform pg_temp.set_user(null);
    res := public.place_order('demo-xerox',
      jsonb_build_array(jsonb_build_object('service_id', svc_a, 'file_id', f_three, 'copies', 1, 'colour', false, 'duplex', false)),
      'stage9-three-arg');
    perform pg_temp.clear_user();
    select * into row_o from public.orders where tracking_code = res->>'tracking_code';
    perform pg_temp.report('U7 three-argument place_order still places a cash order',
      coalesce((res ? 'tracking_code') and row_o.customer_payment_method = 'cash'
               and row_o.payment_status = 'unpaid' and res->>'status' = 'pending', false),
      'method=' || coalesce(row_o.customer_payment_method, 'null') || ' status=' || coalesce(row_o.payment_status, 'null'));
  exception when others then
    perform pg_temp.clear_user();
    perform pg_temp.report('U7 three-argument place_order still places a cash order', false, sqlstate || ': ' || sqlerrm);
  end;

  -- U8: the payment method stays immutable once the order exists (the 0008 guard still holds).
  begin
    update public.orders set customer_payment_method = 'cash' where id = upi_id;
    perform pg_temp.report('U8 payment method cannot be changed after the order exists', false, 'no error was raised');
  exception when others then
    perform pg_temp.report('U8 payment method cannot be changed after the order exists', sqlstate = '42501', sqlstate || ': ' || sqlerrm);
  end;

  -- U9: the owner turns auto print on, records the UPI payment, and approves the order.
  begin
    perform pg_temp.set_user(owner_a);
    perform public.set_auto_print(shop_a, true);
    perform public.set_order_payment(upi_id, 'set_paid', 'online');
    update public.orders set status = 'approved' where id = upi_id;
    perform pg_temp.clear_user();
    perform pg_temp.report('U9 owner can pay and approve a UPI order with auto print on', true, 'set_paid online, then approved');
  exception when others then
    perform pg_temp.clear_user();
    perform pg_temp.report('U9 owner can pay and approve a UPI order with auto print on', false, sqlstate || ': ' || sqlerrm);
  end;

  -- U10: auto print still fires from the trigger: the order is printing and one job is queued.
  select * into row_o from public.orders where id = upi_id;
  select count(*) into n from public.print_jobs where order_id = upi_id;
  perform pg_temp.report('U10 auto print queues the approved, paid UPI order',
    coalesce(row_o.status = 'printing' and row_o.payment_status = 'paid' and n = 1, false),
    'status=' || coalesce(row_o.status, 'null') || ' payment_status=' || coalesce(row_o.payment_status, 'null') || ' jobs=' || n);

  -- U11: anon, authenticated and public cannot execute the auto-print trigger function.
  begin
    perform pg_temp.report('U11 auto_print_on_approval is not callable by anon, authenticated or public',
      not has_function_privilege('anon', 'public.auto_print_on_approval()', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.auto_print_on_approval()', 'EXECUTE')
      and not exists (
        select 1
        from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where p.oid = 'public.auto_print_on_approval()'::regprocedure
          and a.grantee = 0
          and a.privilege_type = 'EXECUTE'
      ),
      'anon=' || has_function_privilege('anon', 'public.auto_print_on_approval()', 'EXECUTE')
        || ' authenticated=' || has_function_privilege('authenticated', 'public.auto_print_on_approval()', 'EXECUTE'));
  exception when others then
    perform pg_temp.report('U11 auto_print_on_approval is not callable by anon, authenticated or public', false, sqlstate || ': ' || sqlerrm);
  end;

  -- U12: the customer-facing four-argument place_order keeps its grants; the internal helper has none.
  begin
    perform pg_temp.report('U12 place_order stays callable by customers; the internal helper is not',
      has_function_privilege('anon', 'public.place_order(text, jsonb, text, text)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.place_order(text, jsonb, text, text)', 'EXECUTE')
      and not has_function_privilege('anon', 'public._place_order_core(text, jsonb, text, text)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public._place_order_core(text, jsonb, text, text)', 'EXECUTE')
      and not exists (
        select 1
        from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where p.oid = 'public._place_order_core(text, jsonb, text, text)'::regprocedure
          and a.grantee = 0
          and a.privilege_type = 'EXECUTE'
      ),
      'checked grants on place_order and _place_order_core');
  exception when others then
    perform pg_temp.report('U12 place_order stays callable by customers; the internal helper is not', false, sqlstate || ': ' || sqlerrm);
  end;
end $$;

select name, ok, detail from stage9_results order by name;

rollback;
