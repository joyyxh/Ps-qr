-- =========================================================
-- Stage 8 database tests: automatic printing (migration 0010).
-- Run AFTER the migrations and the dev seed (demo_seed.sql).
--
-- Every step runs as the real role it would use in production:
--   owner (authenticated, with the owner's JWT claims), anonymous customer (anon),
--   and the print agent's edge function (service_role).
--
-- The whole run is one transaction and is rolled back, so it leaves no rows behind.
-- Every row in the result should show ok = true.
-- =========================================================

begin;

create temp table stage8_results (name text, ok boolean, detail text) on commit drop;
grant select, insert on stage8_results to anon, authenticated, service_role;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
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
  insert into stage8_results values (p_name, p_ok, p_detail);
end $$;

-- Passes when the statement fails with the given SQLSTATE or message fragment.
create or replace function pg_temp.expect_fail(p_name text, p_expect text, p_sql text)
returns void language plpgsql as $$
declare
  v_state text;
  v_msg   text;
begin
  execute p_sql;
  insert into stage8_results values (p_name, false, 'no error was raised');
exception when others then
  v_state := sqlstate;
  v_msg := sqlerrm;
  insert into stage8_results values (
    p_name,
    v_state = p_expect or v_msg ilike '%' || p_expect || '%',
    v_state || ': ' || v_msg
  );
end $$;

-- Test files are stored under the path the 0007 binding rule requires.
create or replace function pg_temp.fixture_file(p_slug text, p_pages integer) returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.customer_files (id, shop_id, storage_path, mime_type, size_bytes, page_count, original_name)
  select x.u, s.id, s.id::text || '/' || x.u::text || '.pdf', 'application/pdf', 1024, p_pages, 'stage8.pdf'
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
      'service_id', p_service, 'file_id', p_file, 'copies', 2, 'colour', false, 'duplex', true)),
    p_key
  );
  perform pg_temp.as_admin();
  select id into v_order from public.orders where tracking_code = v_res->>'tracking_code';
  return v_order;
end $$;

do $$
declare
  owner_a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  owner_b uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  shop_a  uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  svc_a   uuid := 'cccccccc-0000-0000-0000-000000000001';

  f_paid uuid; f_retry uuid; f_run uuid; f_unpaid uuid; f_pending uuid; f_expired uuid; f_revoke uuid;
  o_paid uuid; o_retry uuid; o_run uuid; o_unpaid uuid; o_pending uuid; o_revoke uuid;
  i_paid uuid; i_retry uuid; i_revoke uuid;

  v_res jsonb; v_code text; v_hash text; v_code_b text; v_hash_b text;
  v_token_a text; v_hash_token_a text; v_token_b text; v_hash_token_b text;
  v_agent_a uuid; v_agent_b uuid;
  v_job_paid uuid; v_job_retry1 uuid; v_job_retry2 uuid; v_job_revoke uuid;
  v_attempt integer; v_status text; v_count integer; v_ok boolean;
  v_expired_code text; v_wrong_hash text; v_expired_hash text;
begin
  -- ---------- set up: files and orders (customers, then owner A marks them paid) ----------
  f_paid := pg_temp.fixture_file('demo-xerox', 3);
  f_retry := pg_temp.fixture_file('demo-xerox', 2);
  f_run := pg_temp.fixture_file('demo-xerox', 4);
  f_unpaid := pg_temp.fixture_file('demo-xerox', 1);
  f_pending := pg_temp.fixture_file('demo-xerox', 1);
  f_expired := pg_temp.fixture_file('demo-xerox', 1);
  f_revoke := pg_temp.fixture_file('demo-xerox', 1);

  o_paid := pg_temp.place('demo-xerox', svc_a, f_paid, 'stage8-paid');
  o_retry := pg_temp.place('demo-xerox', svc_a, f_retry, 'stage8-retry');
  o_run := pg_temp.place('demo-xerox', svc_a, f_run, 'stage8-run');
  o_unpaid := pg_temp.place('demo-xerox', svc_a, f_unpaid, 'stage8-unpaid');
  o_pending := pg_temp.place('demo-xerox', svc_a, f_pending, 'stage8-pending');
  o_revoke := pg_temp.place('demo-xerox', svc_a, f_revoke, 'stage8-revoke');

  perform pg_temp.as_owner(owner_a);
  perform public.set_order_payment(o_paid, 'set_paid', 'cash');
  perform public.set_order_payment(o_retry, 'set_paid', 'cash');
  perform public.set_order_payment(o_run, 'set_paid', 'cash');
  perform public.set_order_payment(o_revoke, 'set_paid', 'cash');
  update public.orders set status = 'approved'
   where id in (o_paid, o_retry, o_run, o_unpaid, o_revoke);
  perform pg_temp.as_admin();

  select id into i_paid from public.order_items where order_id = o_paid;
  select id into i_retry from public.order_items where order_id = o_retry;
  select id into i_revoke from public.order_items where order_id = o_revoke;

  -- ---------- owner approval ----------
  perform pg_temp.as_owner(owner_a);
  v_res := public.approve_order_for_print(o_paid);
  perform pg_temp.as_admin();
  perform pg_temp.pass('P01 owner approves a paid order and one job is queued',
    v_res->>'queued' = '1', v_res::text);

  select count(*), max(status), max(attempt), max(settings->>'copies'), max(settings->>'duplex')
    into v_count, v_status, v_attempt, v_code, v_hash
    from public.print_jobs where order_item_id = i_paid;
  perform pg_temp.pass('P02 the job copies the item settings and starts at attempt 1',
    v_count = 1 and v_status = 'queued' and v_attempt = 1 and v_code = '2' and v_hash = 'true',
    v_count || ' ' || v_status || ' ' || v_attempt);

  select status into v_status from public.orders where id = o_paid;
  perform pg_temp.pass('P03 the order moves to printing', v_status = 'printing', v_status);

  perform pg_temp.as_owner(owner_a);
  v_res := public.approve_order_for_print(o_paid);
  perform pg_temp.as_admin();
  perform pg_temp.pass('P04 approving again queues nothing (no duplicate job)',
    v_res->>'queued' = '0' and (select count(*) from public.print_jobs where order_item_id = i_paid) = 1,
    v_res::text);

  perform pg_temp.as_owner(owner_b);
  perform pg_temp.expect_fail('P05 another shop owner cannot send this order to print', '42501',
    format('select public.approve_order_for_print(%L)', o_run));
  perform pg_temp.as_anon();
  perform pg_temp.expect_fail('P06 an anonymous customer cannot send an order to print', '42501',
    format('select public.approve_order_for_print(%L)', o_run));
  perform pg_temp.as_owner(owner_a);
  perform pg_temp.expect_fail('P07 an unpaid order cannot be sent to print', 'verify the payment',
    format('select public.approve_order_for_print(%L)', o_unpaid));
  perform pg_temp.expect_fail('P08 an order that is not approved cannot be sent to print', 'only an approved order',
    format('select public.approve_order_for_print(%L)', o_pending));
  perform pg_temp.as_admin();
  perform pg_temp.expect_fail('P09 a second active job for the same item is refused', '23505',
    format($q$insert into public.print_jobs (shop_id, order_id, order_item_id, file_id, settings)
              select shop_id, order_id, id, file_id, '{}'::jsonb from public.order_items where id = %L$q$, i_paid));

  -- ---------- pairing codes ----------
  perform pg_temp.as_anon();
  perform pg_temp.expect_fail('P10 an anonymous visitor cannot make a pairing code', '42501',
    format('select public.create_print_agent_pairing(%L)', shop_a));
  perform pg_temp.as_owner(owner_a);
  v_res := public.create_print_agent_pairing(shop_a);
  v_code := v_res->>'code';
  perform pg_temp.as_admin();
  perform pg_temp.pass('P11 the pairing code has the expected shape',
    v_code ~ '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$', v_code);
  v_hash := public.print_code_hash(v_code);
  v_token_a := 'stage8-agent-token-a-' || gen_random_uuid()::text || gen_random_uuid()::text;
  v_hash_token_a := encode(sha256(convert_to(v_token_a, 'UTF8')), 'hex');

  v_wrong_hash := public.print_code_hash('ZZZZ-ZZZZ');
  perform pg_temp.as_agent();
  perform pg_temp.expect_fail('P12 a wrong pairing code is refused', 'pairing_code_invalid',
    format('select public.consume_print_pairing(%L, %L, %L, %L, %L)',
      v_wrong_hash, v_hash_token_a, 'Counter PC', 'windows', '1.0.0'));

  v_res := public.consume_print_pairing(v_hash, v_hash_token_a, 'Counter PC', 'windows', '1.0.0');
  v_agent_a := (v_res->>'agent_id')::uuid;
  perform pg_temp.pass('P13 the right code pairs one computer to the shop',
    v_agent_a is not null and v_res->>'shop_name' = 'Demo Xerox Centre', v_res::text);

  perform pg_temp.expect_fail('P14 a pairing code works only once', 'pairing_code_invalid',
    format('select public.consume_print_pairing(%L, %L, %L, %L, %L)',
      v_hash, encode(sha256(convert_to('another-token-' || gen_random_uuid()::text, 'UTF8')), 'hex'),
      'Second PC', 'linux', '1.0.0'));

  -- An expired code is refused even though nobody used it.
  perform pg_temp.as_owner(owner_a);
  v_res := public.create_print_agent_pairing(shop_a);
  perform pg_temp.as_admin();
  v_expired_code := v_res->>'code';
  update public.print_agent_pairings
     set created_at = now() - interval '20 minutes', expires_at = now() - interval '10 minutes'
   where code_hash = public.print_code_hash(v_expired_code);
  v_expired_hash := public.print_code_hash(v_expired_code);
  perform pg_temp.as_agent();
  perform pg_temp.expect_fail('P15 an expired pairing code is refused', 'pairing_code_invalid',
    format('select public.consume_print_pairing(%L, %L, %L, %L, %L)',
      v_expired_hash,
      encode(sha256(convert_to('expired-token-' || gen_random_uuid()::text, 'UTF8')), 'hex'),
      'Late PC', 'windows', '1.0.0'));

  -- Owner B pairs a computer to their own shop, to prove cross-shop isolation later.
  perform pg_temp.as_owner(owner_b);
  v_res := public.create_print_agent_pairing('bbbbbbbb-0000-0000-0000-000000000002');
  perform pg_temp.as_admin();
  v_code_b := v_res->>'code';
  v_hash_b := public.print_code_hash(v_code_b);
  v_token_b := 'stage8-agent-token-b-' || gen_random_uuid()::text || gen_random_uuid()::text;
  v_hash_token_b := encode(sha256(convert_to(v_token_b, 'UTF8')), 'hex');
  perform pg_temp.as_agent();
  v_res := public.consume_print_pairing(v_hash_b, v_hash_token_b, 'Other shop PC', 'linux', '1.0.0');
  v_agent_b := (v_res->>'agent_id')::uuid;

  -- ---------- heartbeat and the owner's status view ----------
  perform pg_temp.expect_fail('P16 an unknown agent token is refused', 'agent_unauthorized',
    format('select public.agent_heartbeat(%L, %L, %L::jsonb)',
      encode(sha256(convert_to('not-a-token', 'UTF8')), 'hex'), '1.0.0', '[]'));
  perform pg_temp.expect_fail('P17 a heartbeat with a printer that has no name is refused', 'printers_invalid',
    format('select public.agent_heartbeat(%L, %L, %L::jsonb)', v_hash_token_a, '1.0.0', '[{"colour":true}]'));

  v_res := public.agent_heartbeat(v_hash_token_a, '1.0.0',
    '[{"name":"HP_LaserJet","isDefault":true,"colour":false,"duplex":true,"papers":["A4"]}]'::jsonb);
  perform pg_temp.pass('P18 a valid heartbeat is accepted', v_res->>'ok' = 'true', v_res::text);

  perform pg_temp.as_owner(owner_a);
  v_res := public.owner_print_status(shop_a);
  perform pg_temp.pass('P19 the owner sees the connected computer as online with its printer',
    jsonb_array_length(v_res->'agents') = 1
    and (v_res->'agents'->0->>'online')::boolean
    and jsonb_array_length(v_res->'agents'->0->'printers') = 1,
    (v_res->'agents')::text);
  perform pg_temp.as_owner(owner_b);
  perform pg_temp.expect_fail('P20 another shop owner cannot see this shop''s printing status', '42501',
    format('select public.owner_print_status(%L)', shop_a));
  perform pg_temp.as_anon();
  perform pg_temp.expect_fail('P21 an anonymous visitor cannot read print jobs', '42501',
    'select count(*) from public.print_jobs');

  -- ---------- claims and shop isolation ----------
  perform pg_temp.as_agent();
  v_res := public.agent_claim_next_job(v_hash_token_b);
  perform pg_temp.pass('P22 an agent of another shop cannot claim this shop''s job',
    v_res is null, coalesce(v_res::text, 'null'));

  v_res := public.agent_claim_next_job(v_hash_token_a);
  v_job_paid := (v_res->>'job_id')::uuid;
  perform pg_temp.pass('P23 the shop agent claims the queued job with its file details',
    v_job_paid is not null and (v_res ? 'storage_path') and v_res->>'attempt' = '1'
    and v_res->'settings'->>'copies' = '2',
    coalesce(v_res::text, 'null'));

  perform pg_temp.expect_fail('P24 a start report with the wrong attempt is refused', 'lease_lost',
    format('select public.agent_mark_printing(%L, %L, 2)', v_hash_token_a, v_job_paid));
  perform pg_temp.expect_fail('P25 another agent cannot start a job it did not claim', 'lease_lost',
    format('select public.agent_mark_printing(%L, %L, 1)', v_hash_token_b, v_job_paid));

  v_res := public.agent_mark_printing(v_hash_token_a, v_job_paid, 1);
  select status into v_status from public.print_jobs where id = v_job_paid;
  perform pg_temp.pass('P26 the agent records that printing has started', v_status = 'printing', v_status);

  -- Lease ends while printing: the job becomes needs_check, never silently printed again.
  update public.print_jobs set lease_until = now() - interval '1 second' where id = v_job_paid;
  v_res := public.agent_heartbeat(v_hash_token_a, '1.0.0', '[]'::jsonb);
  select status into v_status from public.print_jobs where id = v_job_paid;
  perform pg_temp.pass('P27 a job that lost its lease while printing needs a check',
    v_status = 'needs_check', v_status);

  perform pg_temp.as_owner(owner_a);
  perform pg_temp.expect_fail('P28 a job that may have printed needs owner confirmation', 'may already have printed',
    format('select public.retry_print_job(%L, false)', v_job_paid));

  perform pg_temp.as_agent();
  v_res := public.agent_finish_job(v_hash_token_a, v_job_paid, 1, 'sent', null, null);
  select status into v_status from public.print_jobs where id = v_job_paid;
  perform pg_temp.pass('P29 a late "sent" report from the same agent resolves the check',
    v_status = 'sent', v_status);

  perform pg_temp.as_owner(owner_a);
  perform pg_temp.expect_fail('P30 a sent job cannot be printed again', 'only a failed or unclear',
    format('select public.retry_print_job(%L, true)', v_job_paid));

  -- ---------- failure and owner retry ----------
  v_res := public.approve_order_for_print(o_retry);
  perform pg_temp.as_admin();
  select id into v_job_retry1 from public.print_jobs where order_item_id = i_retry;

  perform pg_temp.as_agent();
  v_res := public.agent_claim_next_job(v_hash_token_a);
  perform pg_temp.pass('P31 the agent claims the next queued file',
    (v_res->>'job_id')::uuid = v_job_retry1, coalesce(v_res::text, 'null'));
  perform public.agent_mark_printing(v_hash_token_a, v_job_retry1, 1);
  v_res := public.agent_finish_job(v_hash_token_a, v_job_retry1, 1, 'failed', 'spooler_error', 'The printer was offline.');
  select status, error_code into v_status, v_code from public.print_jobs where id = v_job_retry1;
  perform pg_temp.pass('P32 a failed print is recorded with its reason',
    v_status = 'failed' and v_code = 'spooler_error', v_status || ' ' || coalesce(v_code, ''));

  perform pg_temp.as_owner(owner_a);
  v_res := public.retry_print_job(v_job_retry1, false);
  v_job_retry2 := (v_res->>'job_id')::uuid;
  perform pg_temp.pass('P33 the owner prints a failed file again as attempt 2',
    v_res->>'attempt' = '2', v_res::text);
  perform pg_temp.expect_fail('P34 a second retry is refused while the new attempt waits', 'already waiting',
    format('select public.retry_print_job(%L, false)', v_job_retry1));

  -- ---------- lease expiry before printing requeues; too many claims fails ----------
  perform pg_temp.as_agent();
  v_res := public.agent_claim_next_job(v_hash_token_a);
  perform pg_temp.pass('P35 the agent claims attempt 2',
    (v_res->>'attempt')::int = 2, coalesce(v_res::text, 'null'));
  update public.print_jobs set lease_until = now() - interval '1 second' where id = v_job_retry2;
  v_res := public.agent_heartbeat(v_hash_token_a, '1.0.0', '[]'::jsonb);
  select status into v_status from public.print_jobs where id = v_job_retry2;
  perform pg_temp.pass('P36 a claim that expires before printing goes back to the queue',
    v_status = 'queued', v_status);

  v_res := public.agent_claim_next_job(v_hash_token_a);
  update public.print_jobs set claim_count = 5, lease_until = now() - interval '1 second' where id = v_job_retry2;
  v_res := public.agent_heartbeat(v_hash_token_a, '1.0.0', '[]'::jsonb);
  select status, error_code into v_status, v_code from public.print_jobs where id = v_job_retry2;
  perform pg_temp.pass('P37 a file claimed too many times stops with a clear reason',
    v_status = 'failed' and v_code = 'too_many_claims', v_status || ' ' || coalesce(v_code, ''));

  -- ---------- revocation ----------
  perform pg_temp.as_owner(owner_a);
  v_res := public.approve_order_for_print(o_revoke);
  perform pg_temp.as_admin();
  select id into v_job_revoke from public.print_jobs where order_item_id = i_revoke;

  perform pg_temp.as_agent();
  v_res := public.agent_claim_next_job(v_hash_token_a);
  perform pg_temp.pass('P38 the agent holds the revoke test job before it is removed',
    (v_res->>'job_id')::uuid = v_job_revoke, coalesce(v_res::text, 'null'));

  perform pg_temp.as_owner(owner_b);
  perform pg_temp.expect_fail('P39 another shop owner cannot remove this computer', '42501',
    format('select public.revoke_print_agent(%L)', v_agent_a));
  perform pg_temp.as_owner(owner_a);
  v_res := public.revoke_print_agent(v_agent_a);
  perform pg_temp.as_admin();
  select status into v_status from public.print_jobs where id = v_job_revoke;
  perform pg_temp.pass('P40 removing the computer returns its unstarted job to the queue',
    v_status = 'queued', v_status);

  perform pg_temp.as_agent();
  perform pg_temp.expect_fail('P41 a removed computer can no longer call the agent API', 'agent_unauthorized',
    format('select public.agent_claim_next_job(%L)', v_hash_token_a));

  -- ---------- printer choice ----------
  perform pg_temp.as_owner(owner_b);
  perform pg_temp.expect_fail('P42 the owner cannot choose a printer the computer does not have',
    'not connected', format('select public.set_print_agent_printer(%L, %L)', v_agent_b, 'Ghost'));
  perform pg_temp.as_admin();

  -- ---------- retention ----------
  update public.customer_files set expires_at = now() - interval '1 hour'
   where id in (f_expired, f_revoke);
  perform pg_temp.as_agent();
  perform pg_temp.pass('P43 an expired file not linked to any order is eligible for removal',
    exists (select 1 from public.expired_customer_file_paths(1000) e where e.id = f_expired), '');
  perform pg_temp.pass('P44 an expired file with a job still waiting is kept',
    not exists (select 1 from public.expired_customer_file_paths(1000) e where e.id = f_revoke), '');

  perform pg_temp.pass('P45 marking a file removed works once',
    public.mark_customer_file_deleted(f_expired) and not public.mark_customer_file_deleted(f_expired), '');
  perform pg_temp.pass('P46 a removed file is no longer listed for removal',
    not exists (select 1 from public.expired_customer_file_paths(1000) e where e.id = f_expired), '');
  perform pg_temp.as_admin();

  -- ---------- rate limits ----------
  perform pg_temp.pass('P47 a rate limit allows the set number of hits and then refuses',
    public.consume_rate_limit('stage8:test', 3, 60)
    and public.consume_rate_limit('stage8:test', 3, 60)
    and public.consume_rate_limit('stage8:test', 3, 60)
    and not public.consume_rate_limit('stage8:test', 3, 60), '');

  delete from public.rate_limits where key like 'track:%';
  perform pg_temp.as_anon();
  for v_count in 1..30 loop
    perform public.track_order('ZZZZZZZZ');
  end loop;
  perform pg_temp.expect_fail('P48 tracking lookups are limited per connection', '54000',
    'select public.track_order(''ZZZZZZZZ'')');
  perform pg_temp.as_admin();
end $$;

select name, ok, detail from stage8_results order by name;

rollback;
