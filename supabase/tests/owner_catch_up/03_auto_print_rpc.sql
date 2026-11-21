-- LOCAL THROWAWAY DATABASE ONLY. Checks what the catch-up adds, as the browser roles see it.
-- Variables (psql -v): owner_id, stranger_id, shop_id. Run only after the catch-up migrations.
-- Each check raises an error when it fails, so psql exits non-zero.
-- psql does not substitute variables inside DO blocks, so the ids go into session settings first.

select set_config('harness.owner_id', :'owner_id', false),
       set_config('harness.stranger_id', :'stranger_id', false),
       set_config('harness.shop_id', :'shop_id', false);

-- 1. The switch exists and is off for an existing shop (no data changed by the catch-up).
do $$
begin
  if (select auto_print_enabled from public.shops where id = current_setting('harness.shop_id')::uuid) is distinct from false then
    raise exception 'ASSERT FAILED: auto_print_enabled should default to false for an existing shop';
  end if;
end $$;

-- 2. The owner can switch it on and off through the RPC, and reads the change back.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('harness.owner_id'), 'role', 'authenticated')::text, true);
do $$
declare
  v_shop   uuid := current_setting('harness.shop_id')::uuid;
  v_result jsonb;
begin
  v_result := public.set_auto_print(v_shop, true);
  if v_result is distinct from jsonb_build_object('auto_print_enabled', true) then
    raise exception 'ASSERT FAILED: owner switch on returned %', v_result;
  end if;
  if not (select auto_print_enabled from public.shops where id = v_shop) then
    raise exception 'ASSERT FAILED: owner switch on did not save';
  end if;
  v_result := public.set_auto_print(v_shop, false);
  if (select auto_print_enabled from public.shops where id = v_shop) then
    raise exception 'ASSERT FAILED: owner switch off did not save';
  end if;
end $$;
-- The owner's print status RPC (migration 0010) answers for the owner's shop.
select public.owner_print_status(:'shop_id'::uuid) is not null as owner_print_status_ok;
commit;

-- 3. A signed-in user who does not own the shop cannot change the switch.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('harness.stranger_id'), 'role', 'authenticated')::text, true);
do $$
begin
  begin
    perform public.set_auto_print(current_setting('harness.shop_id')::uuid, true);
    raise exception 'ASSERT FAILED: a stranger could change the auto-print switch';
  exception when insufficient_privilege then
    null; -- expected: 42501
  end;
end $$;
commit;

-- 4. A browser role cannot read the print tables (0010: every table is closed to browsers).
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('harness.owner_id'), 'role', 'authenticated')::text, true);
do $$
begin
  begin
    perform 1 from public.print_jobs limit 1;
    raise exception 'ASSERT FAILED: a browser role can read print_jobs';
  exception when insufficient_privilege then
    null; -- expected: 42501
  end;
end $$;
commit;

select 'auto-print catch-up checks passed' as result;
