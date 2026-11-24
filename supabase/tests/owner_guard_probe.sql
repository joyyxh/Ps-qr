-- Owner guard probe (migration 0022). Run by run_base_suites.sh against the template database, after the
-- migrations and the seed. The whole probe is one transaction that ends with rollback, so the template is
-- not changed. It raises an error, and the harness fails, if any case is wrong.
--
-- The deferred check normally runs at COMMIT. SET CONSTRAINTS ... IMMEDIATE runs the pending check now, which
-- is the same check GoTrue's commit would run, so each case can be asserted in place.

\set ON_ERROR_STOP on
begin;

do $$
declare
  ok_id     uuid := '5f000000-0000-0000-0000-00000000a001';
  public_id uuid := '5f000000-0000-0000-0000-00000000a002';
  nouser_id uuid := '5f000000-0000-0000-0000-00000000a003';
  provider  constant jsonb := '{"provider":"email","providers":["email"]}';
  refused   boolean;
begin
  -- Case 1: GoTrue's admin order. The row is inserted with provider metadata only, then owner_flow is applied
  -- in the same transaction. It must pass the check.
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values (ok_id, 'authenticated', 'authenticated', 'owner_probe@accounts.qrquick.invalid', provider, '{}');
  update auth.users
     set raw_app_meta_data = provider || '{"owner_flow":"username-v1"}'
   where id = ok_id;
  set constraints auth.owner_guard_auth_users_at_commit immediate;
  set constraints auth.owner_guard_auth_users_at_commit deferred;

  -- Case 2: a public email sign-up (a real address, provider metadata only) must be refused.
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values (public_id, 'authenticated', 'authenticated', 'public.person@example.com', provider, '{}');
  refused := false;
  begin
    set constraints auth.owner_guard_auth_users_at_commit immediate;
  exception when sqlstate '42501' then
    refused := true;
  end;
  if not refused then
    raise exception 'owner guard probe FAILED: a public email row was accepted';
  end if;
  delete from auth.users where id = public_id;
  set constraints auth.owner_guard_auth_users_at_commit deferred;

  -- Case 3: an owner username address without owner_flow must be refused.
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values (nouser_id, 'authenticated', 'authenticated', 'nouser_probe@accounts.qrquick.invalid', provider, '{}');
  refused := false;
  begin
    set constraints auth.owner_guard_auth_users_at_commit immediate;
  exception when sqlstate '42501' then
    refused := true;
  end;
  if not refused then
    raise exception 'owner guard probe FAILED: an owner address without owner_flow was accepted';
  end if;
  delete from auth.users where id = nouser_id;
  set constraints auth.owner_guard_auth_users_at_commit deferred;

  -- Case 4: an update that removes owner_flow from an owner account must be refused.
  update auth.users set raw_app_meta_data = provider where id = ok_id;
  refused := false;
  begin
    set constraints auth.owner_guard_auth_users_at_commit immediate;
  exception when sqlstate '42501' then
    refused := true;
  end;
  if not refused then
    raise exception 'owner guard probe FAILED: owner_flow removed from an owner account was accepted';
  end if;
  delete from auth.users where id = ok_id;

  raise notice 'owner guard probe: 4 of 4 cases passed';
end
$$;

rollback;
