-- =========================================================
-- Stage 10 database tests: the legacy owner claim (migration 0024).
-- Run AFTER migrations 0001 to 0024. One transaction, rolled back at the end.
-- Every row should show ok = true.
-- =========================================================
begin;

create temp table stage10_results (name text, ok boolean, detail text) on commit drop;
grant select, insert on stage10_results to anon, authenticated, service_role;

create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin
  insert into stage10_results values (p_name, coalesce(p_ok, false), p_detail);
end $$;
grant execute on function pg_temp.check(text, boolean, text) to anon, authenticated, service_role;

create or replace function pg_temp.expect_error(p_name text, p_state text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into stage10_results values (p_name, false, 'no error was raised');
exception when others then
  insert into stage10_results values (p_name, sqlstate = p_state, sqlstate || ': ' || sqlerrm);
end $$;
grant execute on function pg_temp.expect_error(text, text, text) to anon, authenticated, service_role;

do $$
declare
  legacy   uuid := '10000000-0000-0000-0000-0000000000a1';
  legacy2  uuid := '10000000-0000-0000-0000-0000000000a2';
  staffer  uuid := '10000000-0000-0000-0000-0000000000a3';
  newname  uuid := '10000000-0000-0000-0000-0000000000a4';
  shop1    uuid := '10000000-0000-0000-0000-0000000000b1';
  shop2    uuid := '10000000-0000-0000-0000-0000000000b2';
  svc      uuid;
  code     text;
  compact  text;
  codes    text[] := array['AAAA-BBBB-CCCC-DDDD','EEEE-FFFF-GGGG-HHHH','JJJJ-KKKK-MMMM-NNNN','PPPP-QQQQ-RRRR-SSSS','TTTT-UUUU-VVVV-WWWW',
                           'XXXX-YYYY-ZZZZ-2222','3333-4444-5555-6666','7777-8888-9999-AAAB','BBBC-CCCD-DDDE-EEEF','FFFG-GGGH-HHHJ-JJJK'];
  v_bool   boolean;
  v_id     uuid;
  v_n      int;
  v_before jsonb;
  v_after  jsonb;
begin
  -- Fixtures: two legacy owners with shops, a staff-only user, and a username account.
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
    (legacy,  'authenticated', 'authenticated', 'Ravi@Example.com',  '{"provider":"email","providers":["email"]}', '{}'),
    (legacy2, 'authenticated', 'authenticated', 'sita@example.com',  '{"provider":"email","providers":["email"]}', '{}'),
    (staffer, 'authenticated', 'authenticated', 'staff@example.com', '{"provider":"email","providers":["email"]}', '{}'),
    (newname, 'authenticated', 'authenticated', 'already@accounts.qrquick.invalid', '{"provider":"email","providers":["email"],"owner_flow":"username-v1"}', '{}');
  insert into auth.identities (id, user_id, provider, provider_id, identity_data)
  values (gen_random_uuid(), legacy, 'email', legacy::text, jsonb_build_object('sub', legacy::text, 'email', 'ravi@example.com'));
  insert into public.shops (id, slug, name) values (shop1, 'legacy-one', 'Legacy One'), (shop2, 'legacy-two', 'Legacy Two');
  insert into public.shop_memberships (shop_id, user_id, role) values
    (shop1, legacy, 'owner'), (shop2, legacy2, 'owner'), (shop1, staffer, 'staff');
  insert into public.services (shop_id, name, pricing_unit, bw_price_paise, is_active)
  values (shop1, 'Legacy copy', 'per_side', 200, true) returning id into svc;
  insert into public.owner_usernames (username, user_id) values ('already', newname);

  -- ----- who counts as a legacy owner -----
  perform pg_temp.check('C01 an email owner with a shop is legacy', public.owner_is_legacy(legacy));
  perform pg_temp.check('C02 a staff-only user is not legacy', not public.owner_is_legacy(staffer));
  perform pg_temp.check('C03 a username account is not legacy', not public.owner_is_legacy(newname));
  perform pg_temp.check('C04 an unknown id is not legacy', not public.owner_is_legacy(gen_random_uuid()));
  perform pg_temp.check('C05 lookup by email ignores case and spaces', public.owner_legacy_user_for('  RAVI@example.COM ') = legacy);
  perform pg_temp.check('C06 lookup of a staff email returns null', public.owner_legacy_user_for('staff@example.com') is null);
  perform pg_temp.check('C07 lookup of a username account returns null', public.owner_legacy_user_for('already@accounts.qrquick.invalid') is null);
  perform pg_temp.check('C08 lookup of an unknown or empty email returns null',
    public.owner_legacy_user_for('nobody@example.com') is null and public.owner_legacy_user_for(null) is null
    and public.owner_legacy_user_for(repeat('a', 260) || '@x.com') is null);

  -- ----- issuing codes -----
  code := public.owner_issue_claim_code(legacy);
  compact := replace(code, '-', '');
  perform pg_temp.check('C09 issued code has the XXXX-XXXX-XXXX-XXXX form in the safe alphabet',
    code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}(-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}){3}$', code);
  perform pg_temp.check('C10 only a hash is stored',
    (select count(*) from public.owner_claim_codes where user_id = legacy and code_hash <> compact and code_hash like '$2%') = 1);
  perform pg_temp.check('C11 the code expires in about 72 hours',
    (select expires_at between now() + interval '71 hours' and now() + interval '73 hours' from public.owner_claim_codes where user_id = legacy));
  perform pg_temp.expect_error('C12 a code cannot be issued for a staff-only user', '22023', format('select public.owner_issue_claim_code(%L)', staffer));
  perform pg_temp.expect_error('C13 a code cannot be issued for a username account', '22023', format('select public.owner_issue_claim_code(%L)', newname));
  perform pg_temp.expect_error('C14 a ttl above 168 hours is refused', '22023', format('select public.owner_issue_claim_code(%L, 500)', legacy));
  code := public.owner_issue_claim_code(legacy);
  compact := replace(code, '-', '');
  perform pg_temp.check('C15 issuing again replaces the unused code', (select count(*) from public.owner_claim_codes where user_id = legacy and used_at is null) = 1);

  -- ----- consuming codes -----
  perform pg_temp.check('C16 a wrong code is refused', not public.owner_consume_claim_code(legacy, 'AAAAAAAAAAAAAAAA'));
  perform pg_temp.check('C17 a code for another account is refused', not public.owner_consume_claim_code(legacy2, compact));
  perform pg_temp.check('C18 a malformed code is refused', not public.owner_consume_claim_code(legacy, 'short') and not public.owner_consume_claim_code(legacy, lower(compact)));
  perform pg_temp.check('C19 the right code works once', public.owner_consume_claim_code(legacy, compact));
  perform pg_temp.check('C20 the same code does not work twice', not public.owner_consume_claim_code(legacy, compact));
  perform pg_temp.check('C21 a used code can be re-opened for the same account', public.owner_unconsume_claim_code(legacy, compact));
  perform pg_temp.check('C22 a code cannot be re-opened for another account', not public.owner_unconsume_claim_code(legacy2, compact));
  perform pg_temp.check('C23 the re-opened code works again', public.owner_consume_claim_code(legacy, compact));
  update public.owner_claim_codes set used_at = null, expires_at = now() - interval '1 minute' where user_id = legacy;
  perform pg_temp.check('C24 an expired code is refused', not public.owner_consume_claim_code(legacy, compact));
  update public.owner_claim_codes set used_at = now() where user_id = legacy;
  perform pg_temp.check('C25 an expired used code cannot be re-opened', not public.owner_unconsume_claim_code(legacy, compact));

  -- ----- the database side of a claim -----
  perform pg_temp.expect_error('C26 apply refuses a staff-only user', '22023',
    format('select public.owner_claim_apply(%L, %L, %L, %L, %L::text[])', staffer, 'staffname', '2026-11-22.1', '2026-11-22.1', codes));
  perform pg_temp.expect_error('C27 apply refuses a username already taken', '23505',
    format('select public.owner_claim_apply(%L, %L, %L, %L, %L::text[])', legacy, 'already', '2026-11-22.1', '2026-11-22.1', codes));
  perform pg_temp.expect_error('C28 apply refuses an unknown policy version', '23503',
    format('select public.owner_claim_apply(%L, %L, %L, %L, %L::text[])', legacy, 'ravi_prints', 'nope', '2026-11-22.1', codes));
  perform pg_temp.check('C29 a refused apply leaves nothing behind',
    (select count(*) from public.owner_usernames where user_id = legacy) = 0
    and (select count(*) from public.owner_policy_acceptances where user_id = legacy) = 0
    and (select count(*) from public.owner_recovery_codes where user_id = legacy) = 0);

  v_before := jsonb_build_object(
    'shop', (select to_jsonb(s) from public.shops s where id = shop1),
    'members', (select jsonb_agg(to_jsonb(m) order by user_id) from public.shop_memberships m where shop_id = shop1),
    'service', (select to_jsonb(x) from public.services x where id = svc));

  perform public.owner_claim_apply(legacy, 'ravi_prints', '2026-11-22.1', '2026-11-22.1', codes);
  perform pg_temp.check('C30 apply reserves the username', (select user_id from public.owner_usernames where username = 'ravi_prints') = legacy);
  perform pg_temp.check('C31 apply records both acceptances', (select count(*) from public.owner_policy_acceptances where user_id = legacy) = 2);
  perform pg_temp.check('C32 apply stores ten hashed recovery codes', (select count(*) from public.owner_recovery_codes where user_id = legacy and code_hash like '$2%') = 10);
  perform pg_temp.check('C33 the account is no longer legacy once it has a username', not public.owner_is_legacy(legacy));

  -- the auth side, as the function does it through the admin API
  update auth.users set email = 'ravi_prints@accounts.qrquick.invalid',
         raw_app_meta_data = raw_app_meta_data || '{"owner_flow":"username-v1"}' where id = legacy;
  perform pg_temp.check('C34 identity sync updates the email identity', public.owner_claim_sync_identity(legacy, 'ravi_prints@accounts.qrquick.invalid') = 1);
  perform pg_temp.check('C35 the identity row now carries the internal address',
    (select identity_data ->> 'email' from auth.identities where user_id = legacy) = 'ravi_prints@accounts.qrquick.invalid');
  perform pg_temp.expect_error('C36 identity sync refuses a normal address', '22023',
    format('select public.owner_claim_sync_identity(%L, %L)', legacy, 'x@example.com'));
  perform pg_temp.expect_error('C37 undo refuses a converted account', '22023', format('select public.owner_claim_undo(%L)', legacy));

  -- ----- nothing was lost -----
  v_after := jsonb_build_object(
    'shop', (select to_jsonb(s) from public.shops s where id = shop1),
    'members', (select jsonb_agg(to_jsonb(m) order by user_id) from public.shop_memberships m where shop_id = shop1),
    'service', (select to_jsonb(x) from public.services x where id = svc));
  perform pg_temp.check('C38 shop, memberships and services are byte-identical after the claim', v_before = v_after);
  perform pg_temp.check('C39 the same user id is still an owner of the same shop',
    exists (select 1 from public.shop_memberships where shop_id = shop1 and user_id = legacy and role = 'owner'));

  -- ----- undo of a claim that did not convert -----
  perform public.owner_claim_apply(legacy2, 'sita_prints', '2026-11-22.1', '2026-11-22.1', codes);
  perform public.owner_claim_undo(legacy2);
  perform pg_temp.check('C40 undo removes the username, acceptances and recovery codes of that account only',
    (select count(*) from public.owner_usernames where user_id = legacy2) = 0
    and (select count(*) from public.owner_policy_acceptances where user_id = legacy2) = 0
    and (select count(*) from public.owner_recovery_codes where user_id = legacy2) = 0
    and (select count(*) from public.owner_usernames where user_id = legacy) = 1
    and (select count(*) from public.owner_recovery_codes where user_id = legacy) = 10);
  perform pg_temp.check('C41 the undone account is legacy again', public.owner_is_legacy(legacy2));
end $$;

-- ----- who may call what -----
do $$
declare fn text; r text; granted boolean;
begin
  foreach fn in array array[
    'owner_is_legacy(uuid)', 'owner_legacy_user_for(text)', 'owner_issue_claim_code(uuid,integer)',
    'owner_consume_claim_code(uuid,text)', 'owner_unconsume_claim_code(uuid,text)',
    'owner_claim_apply(uuid,text,text,text,text[])', 'owner_claim_undo(uuid)', 'owner_claim_sync_identity(uuid,text)']
  loop
    foreach r in array array['anon', 'authenticated'] loop
      perform pg_temp.check(format('C42 %s is not executable by %s', fn, r),
        not has_function_privilege(r, 'public.' || fn, 'execute'));
    end loop;
    perform pg_temp.check(format('C43 %s is executable by service_role', fn), has_function_privilege('service_role', 'public.' || fn, 'execute'));
  end loop;
  perform pg_temp.check('C44 owner_claim_codes has RLS on and no grants for app roles',
    (select relrowsecurity from pg_class where oid = 'public.owner_claim_codes'::regclass)
    and not has_table_privilege('anon', 'public.owner_claim_codes', 'select')
    and not has_table_privilege('authenticated', 'public.owner_claim_codes', 'select'));
  perform pg_temp.check('C45 every claim function has an empty search_path',
    (select bool_and(coalesce(p.proconfig, '{}') @> array['search_path=""'])
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('owner_is_legacy','owner_legacy_user_for','owner_issue_claim_code',
        'owner_consume_claim_code','owner_unconsume_claim_code','owner_claim_apply','owner_claim_undo','owner_claim_sync_identity')));
end $$;

-- as the app roles, the functions and the table are closed
set role authenticated;
do $$ begin
  perform pg_temp.expect_error('C46 a signed-in user cannot call the issue function', '42501',
    $q$select public.owner_issue_claim_code('10000000-0000-0000-0000-0000000000a1')$q$);
  perform pg_temp.expect_error('C47 a signed-in user cannot read claim codes', '42501', $q$select * from public.owner_claim_codes$q$);
end $$;
reset role;
set role anon;
do $$ begin
  perform pg_temp.expect_error('C48 an anonymous caller cannot find a legacy owner', '42501', $q$select public.owner_legacy_user_for('ravi@example.com')$q$);
end $$;
reset role;

select name, ok, detail from stage10_results order by name;

rollback;
