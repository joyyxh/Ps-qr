-- requires-migration: 0012
-- =========================================================
-- Print eligibility (migration 0012): a refunded, cancelled or rejected order must not
-- print, and a paid order that is ready or completed keeps its queued files.
--
-- Single-session checks. The concurrent cases (a refund racing a claim or a start report)
-- need two database sessions and live in supabase/tests/scratch/refund_race.sh.
--
-- Run AFTER migrations 0001-0012 and the dev seed. The whole run is one transaction,
-- rolled back at the end. Every row should show ok = true.
-- =========================================================

begin;

create temp table elig_results (name text, ok boolean, detail text) on commit drop;
grant select, insert on elig_results to anon, authenticated, service_role;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'reset role';
end $$;

create or replace function pg_temp.as_owner(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set role anon';
end $$;

create or replace function pg_temp.as_agent() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  execute 'set role service_role';
end $$;

create or replace function pg_temp.pass(p_name text, p_ok boolean, p_detail text default '')
returns void language plpgsql as $$
begin
  insert into elig_results values (p_name, coalesce(p_ok, false), p_detail);
end $$;

-- Passes when the statement fails with the given SQLSTATE or message fragment.
create or replace function pg_temp.expect_fail(p_name text, p_expect text, p_sql text)
returns void language plpgsql as $$
declare
  v_state text;
  v_msg   text;
begin
  execute p_sql;
  insert into elig_results values (p_name, false, 'no error was raised');
exception when others then
  v_state := sqlstate;
  v_msg := sqlerrm;
  insert into elig_results values (
    p_name,
    v_state = p_expect or v_msg ilike '%' || p_expect || '%',
    v_state || ': ' || v_msg
  );
end $$;

create or replace function pg_temp.fixture_file(p_slug text, p_pages integer) returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.customer_files (id, shop_id, storage_path, mime_type, size_bytes, page_count, original_name)
  select x.u, s.id, s.id::text || '/' || x.u::text || '.pdf', 'application/pdf', 1024, p_pages, 'elig.pdf'
    from public.shops s, (select gen_random_uuid() as u) x
   where s.slug = p_slug
  returning id into v_id;
  return v_id;
end $$;

-- A customer places an order the way the public page does.
create or replace function pg_temp.place(p_slug text, p_service uuid, p_file uuid, p_key text)
returns uuid language plpgsql as $$
declare
  v_res   jsonb;
  v_order uuid;
begin
  perform pg_temp.as_anon();
  v_res := public.place_order(
    p_slug,
    jsonb_build_array(jsonb_build_object(
      'service_id', p_service, 'file_id', p_file, 'copies', 2, 'colour', false, 'duplex', false)),
    p_key
  );
  perform pg_temp.as_admin();
  select id into v_order from public.orders where tracking_code = v_res->>'tracking_code';
  return v_order;
end $$;

do $$
declare
  owner_a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  shop_a  uuid := 'bbbbbbbb-0000-0000-0000-000000000001';  -- demo-xerox
  svc_a   uuid := 'cccccccc-0000-0000-0000-000000000001';  -- Document printing, per side
  f1 uuid; f2 uuid; f3 uuid; f4 uuid;
  o1 uuid; o2 uuid; o3 uuid; o4 uuid;
  j1 uuid; j2 uuid; j4 uuid;
  v_token_hash text := encode(sha256(convert_to('elig-agent-token-1', 'UTF8')), 'hex');
  v_res jsonb; v_status text; v_code text; v_n integer; v_job uuid;
begin
  -- ---------- an agent for this shop (inserted directly; the pairing flow is tested in stage8) ----------
  insert into public.print_agents (shop_id, name, platform, token_hash)
  values (shop_a, 'Eligibility PC', 'linux', v_token_hash);
  perform pg_temp.pass('E00 a test agent exists for the shop',
    exists (select 1 from public.print_agents where token_hash = v_token_hash), '');

  -- ---------- orders: four paid, approved orders, one of which is cancelled without printing ----------
  f1 := pg_temp.fixture_file('demo-xerox', 2);
  f2 := pg_temp.fixture_file('demo-xerox', 2);
  f3 := pg_temp.fixture_file('demo-xerox', 1);
  f4 := pg_temp.fixture_file('demo-xerox', 2);
  o1 := pg_temp.place('demo-xerox', svc_a, f1, 'elig-refund-queued');
  o2 := pg_temp.place('demo-xerox', svc_a, f2, 'elig-refund-claimed');
  o3 := pg_temp.place('demo-xerox', svc_a, f3, 'elig-cancel-approved');
  o4 := pg_temp.place('demo-xerox', svc_a, f4, 'elig-ready');

  perform pg_temp.as_owner(owner_a);
  perform public.set_order_payment(o1, 'set_paid', 'cash');
  perform public.set_order_payment(o2, 'set_paid', 'cash');
  perform public.set_order_payment(o3, 'set_paid', 'cash');
  perform public.set_order_payment(o4, 'set_paid', 'cash');
  update public.orders set status = 'approved' where id in (o1, o2, o3, o4);
  v_res := public.approve_order_for_print(o1);
  v_res := public.approve_order_for_print(o2);
  v_res := public.approve_order_for_print(o4);
  perform pg_temp.as_admin();

  select id into j1 from public.print_jobs where order_id = o1;
  select id into j2 from public.print_jobs where order_id = o2;
  select id into j4 from public.print_jobs where order_id = o4;

  -- E01: a paid order sent to print has a queued job, and its order is printable.
  select status into v_status from public.print_jobs where id = j1;
  perform pg_temp.pass('E01 a paid order sent to print has a queued job, and the order is printable',
    v_status = 'queued' and public.order_is_printable(o1), coalesce(v_status, 'no job'));

  -- ---------- refund while the job is queued ----------
  perform pg_temp.as_owner(owner_a);
  perform public.set_order_payment(o1, 'refund');
  perform pg_temp.as_admin();

  -- E02: the refund cancels the queued job in the same transaction.
  select status, error_code into v_status, v_code from public.print_jobs where id = j1;
  perform pg_temp.pass('E02 a refund cancels the queued job with a clear reason',
    v_status = 'cancelled' and v_code = 'order_not_printable', coalesce(v_status, '') || ' ' || coalesce(v_code, ''));

  -- E03: the refunded order is no longer printable.
  perform pg_temp.pass('E03 a refunded order is not printable',
    not public.order_is_printable(o1), '');

  -- E04: the agent claims the oldest queued job, which is the one for order 2, never the refunded one.
  perform pg_temp.as_agent();
  v_res := public.agent_claim_next_job(v_token_hash);
  perform pg_temp.pass('E04 the agent never claims a job for a refunded order',
    (v_res->>'job_id')::uuid = j2, coalesce(v_res::text, 'null'));
  perform pg_temp.expect_fail('E05 a start report for the cancelled job is refused', 'lease_lost',
    format('select public.agent_mark_printing(%L, %L, 1)', v_token_hash, j1));
  perform pg_temp.as_admin();

  -- ---------- refund after the agent has claimed, in one transaction ----------
  perform pg_temp.as_owner(owner_a);
  perform public.set_order_payment(o2, 'refund');
  perform pg_temp.as_admin();
  select status, error_code into v_status, v_code from public.print_jobs where id = j2;
  perform pg_temp.pass('E06 a refund after the claim cancels the claimed job',
    v_status = 'cancelled' and v_code = 'order_not_printable', coalesce(v_status, '') || ' ' || coalesce(v_code, ''));

  perform pg_temp.as_agent();
  perform pg_temp.expect_fail('E07 the agent cannot start the job after the refund', 'lease_lost',
    format('select public.agent_mark_printing(%L, %L, 1)', v_token_hash, j2));
  perform pg_temp.as_admin();

  -- ---------- cancelled order (no job) ----------
  perform pg_temp.as_owner(owner_a);
  update public.orders set status = 'cancelled' where id = o3;
  perform pg_temp.expect_fail('E08 an approved order cancelled by the owner cannot be sent to print', 'only an approved order',
    format('select public.approve_order_for_print(%L)', o3));
  perform pg_temp.as_admin();
  perform pg_temp.pass('E09 a cancelled order is not printable',
    not public.order_is_printable(o3), '');

  -- ---------- ready keeps its queued files (the customer paid for them) ----------
  perform pg_temp.as_owner(owner_a);
  update public.orders set status = 'ready' where id = o4;
  perform pg_temp.as_admin();
  select status into v_status from public.print_jobs where id = j4;
  perform pg_temp.pass('E10 a paid order marked ready keeps its queued file',
    v_status = 'queued' and public.order_is_printable(o4), coalesce(v_status, 'no job'));

  perform pg_temp.as_agent();
  v_res := public.agent_claim_next_job(v_token_hash);
  perform pg_temp.pass('E11 the agent claims that file, and it can start printing',
    (v_res->>'job_id')::uuid = j4, coalesce(v_res::text, 'null'));
  v_res := public.agent_mark_printing(v_token_hash, j4, 1);
  perform pg_temp.as_admin();
  select status into v_status from public.print_jobs where id = j4;
  perform pg_temp.pass('E12 a printable job moves to printing as before',
    v_status = 'printing', coalesce(v_status, 'no job'));

  -- ---------- a job already printing is not cancelled by a refund (cannot be recalled) ----------
  perform pg_temp.as_owner(owner_a);
  perform public.set_order_payment(o4, 'refund');
  perform pg_temp.as_admin();
  select status into v_status from public.print_jobs where id = j4;
  perform pg_temp.pass('E13 a refund does not change a file that is already printing (known limit)',
    v_status = 'printing', coalesce(v_status, 'no job'));

  -- ---------- owner retry and status constraint ----------
  perform pg_temp.as_owner(owner_a);
  perform pg_temp.expect_fail('E14 a cancelled file cannot be printed again', 'only a failed or unclear',
    format('select public.retry_print_job(%L, false)', j1));
  perform pg_temp.as_admin();
  perform pg_temp.expect_fail('E15 an unknown job status is refused by the database', '23514',
    format('update public.print_jobs set status = %L where id = %L', 'bogus', j4));

  -- ---------- order_is_printable is not callable by customers or owners directly ----------
  perform pg_temp.as_anon();
  perform pg_temp.expect_fail('E16 an anonymous visitor cannot call order_is_printable', '42501',
    format('select public.order_is_printable(%L)', o4));
  perform pg_temp.as_admin();
end $$;

select name, ok, detail from elig_results order by name;

rollback;
