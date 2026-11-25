-- =========================================================
-- Stage 11 database tests: security hardening (migration 0025).
-- Run AFTER migrations 0001 to 0025. One transaction, rolled back at the end.
-- =========================================================
begin;

create temp table stage11_results (name text, ok boolean, detail text) on commit drop;
grant select, insert on stage11_results to anon, authenticated;

create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin insert into stage11_results values (p_name, coalesce(p_ok, false), p_detail); end $$;

create or replace function pg_temp.sqlstate_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return 'none';
exception when others then return sqlstate; end $$;
grant execute on function pg_temp.sqlstate_of(text) to anon, authenticated;

-- Which SQLSTATE a call raises, as anonymous callers, from a given client address.
create or replace function pg_temp.as_anon(p_ip text, p_sql text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.headers', json_build_object('x-forwarded-for', p_ip)::text, true);
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  r := pg_temp.sqlstate_of(p_sql);
  execute 'reset role';
  return r;
end $$;

do $$
declare
  limited_ip text := '203.0.113.77';
  fresh_ip   text := '203.0.113.78';
  rec record;
  bad int;
begin
  -- The limited address has used its 60 orders for this hour.
  perform set_config('request.headers', json_build_object('x-forwarded-for', limited_ip)::text, true);
  insert into public.rate_limits (key, window_start, hits) values ('order:' || public.request_client_key(), now(), 60);

  perform pg_temp.check('H01 a connection over the order limit is refused (four-argument place_order)',
    pg_temp.as_anon(limited_ip, $q$select public.place_order('no-such-shop', '[]'::jsonb, null, 'cash')$q$) = '54000');
  perform pg_temp.check('H02 a connection over the order limit is refused (three-argument place_order)',
    pg_temp.as_anon(limited_ip, $q$select public.place_order('no-such-shop', '[]'::jsonb, null)$q$) = '54000');
  perform pg_temp.check('H03 a different connection is not limited (reaches the shop lookup)',
    pg_temp.as_anon(fresh_ip, $q$select public.place_order('no-such-shop', '[]'::jsonb, null, 'cash')$q$) = 'P0002');
  perform pg_temp.check('H04 a refused call does not raise the counter past the limit',
    (select hits from public.rate_limits where key = 'order:ip:' || encode(sha256(convert_to(limited_ip, 'UTF8')), 'hex')) = 60);
  perform pg_temp.check('H05 order tracking is still limited per connection (unchanged)',
    pg_temp.as_anon(fresh_ip, $q$select public.track_order('NOPE')$q$) in ('none'));

  -- Trigger functions are no longer API-callable by app roles.
  perform pg_temp.check('H06 trigger functions are not executable by anon or signed-in users',
    not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('enforce_qrquick_minimum_order','forbid_order_item_changes','guard_order_changes','guard_qrquick_payment_intent')
         and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))));
  perform pg_temp.check('H07 those triggers are still attached', (
    select count(distinct p.proname) from pg_trigger t join pg_proc p on p.oid = t.tgfoid
     where not t.tgisinternal
       and p.proname in ('enforce_qrquick_minimum_order','forbid_order_item_changes','guard_order_changes','guard_qrquick_payment_intent')) = 4);

  -- search_path: no definer function pins "public" without pg_temp last.
  select count(*) into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and p.proconfig @> array['search_path=public'];
  perform pg_temp.check('H08 no SECURITY DEFINER function still pins search_path to bare public', bad = 0, 'remaining=' || bad);
  select count(*) into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  perform pg_temp.check('H09 every SECURITY DEFINER function pins a search_path', bad = 0, 'unpinned=' || bad);

  -- Grants that must stay.
  perform pg_temp.check('H10 place_order, quote_order and track_order stay public',
    has_function_privilege('anon', 'public.place_order(text,jsonb,text,text)', 'execute')
    and has_function_privilege('anon', 'public.place_order(text,jsonb,text)', 'execute')
    and has_function_privilege('anon', 'public.quote_order(text,jsonb)', 'execute')
    and has_function_privilege('anon', 'public.track_order(text)', 'execute'));
  perform pg_temp.check('H11 policy helpers stay callable by signed-in users only',
    has_function_privilege('authenticated', 'public.is_shop_owner(uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.is_shop_member(uuid,text[])', 'execute')
    and has_function_privilege('authenticated', 'public.shop_folder_is_mine(text)', 'execute')
    and not has_function_privilege('anon', 'public.is_shop_owner(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.is_shop_member(uuid,text[])', 'execute')
    and not has_function_privilege('anon', 'public.shop_folder_is_mine(text)', 'execute'));
  perform pg_temp.check('H12 internal order helpers are not callable by app roles',
    not has_function_privilege('anon', 'public._place_order_core(text,jsonb,text,text)', 'execute')
    and not has_function_privilege('authenticated', 'public._place_order_core(text,jsonb,text,text)', 'execute')
    and not has_function_privilege('anon', 'public.consume_rate_limit(text,integer,integer)', 'execute'));
end $$;

select name, ok, detail from stage11_results order by name;

rollback;
