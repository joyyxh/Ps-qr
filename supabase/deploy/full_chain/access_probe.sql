-- LOCAL REHEARSAL ONLY. What each person can see and do, as the real roles with real JWT claims.
-- Prints name|ok|detail rows. Variable: none. Owners: ravi (…01), sita (…02), mohan (…03), staff (…09).
begin;
create temp table pr (name text, ok boolean, detail text) on commit drop;
grant select, insert on pr to anon, authenticated;
create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, true);
  execute case when p is null then 'set local role anon' else 'set local role authenticated' end;
end $$;
create or replace function pg_temp.n(p_name text, p_expected bigint, p_sql text) returns void language plpgsql as $$
declare v bigint;
begin execute p_sql into v; insert into pr values (p_name, v = p_expected, 'count=' || v);
exception when others then insert into pr values (p_name, false, sqlstate || ' ' || sqlerrm); end $$;
create or replace function pg_temp.e(p_name text, p_state text, p_sql text) returns void language plpgsql as $$
begin execute p_sql; insert into pr values (p_name, false, 'no error');
exception when others then insert into pr values (p_name, sqlstate = p_state, sqlstate || ' ' || sqlerrm); end $$;
grant execute on function pg_temp.n(text,bigint,text), pg_temp.e(text,text,text), pg_temp.as_user(uuid) to anon, authenticated;

do $$
declare ravi uuid := 'a0000000-0000-0000-0000-000000000001'; sita uuid := 'a0000000-0000-0000-0000-000000000002';
        staff uuid := 'a0000000-0000-0000-0000-000000000009';
begin
  perform pg_temp.as_user(ravi);
  perform pg_temp.n('P01 ravi sees his shop only', 1, $q$select count(*) from public.shops where slug = 'ravi-prints'$q$);
  perform pg_temp.n('P02 ravi sees both his orders', 2, $q$select count(*) from public.orders where shop_id = 'b0000000-0000-0000-0000-000000000001'$q$);
  perform pg_temp.n('P03 ravi cannot see sita orders', 0, $q$select count(*) from public.orders where shop_id = 'b0000000-0000-0000-0000-000000000002'$q$);
  perform pg_temp.n('P04 ravi sees his inactive service', 1, $q$select count(*) from public.services where id = 'c0000000-0000-0000-0000-000000000002'$q$);
  perform pg_temp.n('P05 ravi sees memberships of his shop (owner and staff)', 2, $q$select count(*) from public.shop_memberships where shop_id = 'b0000000-0000-0000-0000-000000000001'$q$);
  perform pg_temp.n('P06 ravi cannot see sita memberships', 0, $q$select count(*) from public.shop_memberships where shop_id = 'b0000000-0000-0000-0000-000000000002'$q$);
  perform pg_temp.n('P07 ravi edits his own service price', 1, $q$with u as (update public.services set bw_price_paise = bw_price_paise where id = 'c0000000-0000-0000-0000-000000000001' returning 1) select count(*) from u$q$);
  perform pg_temp.n('P08 ravi cannot edit sita service (0 rows)', 0, $q$with u as (update public.services set bw_price_paise = 1 where id = 'c0000000-0000-0000-0000-000000000003' returning 1) select count(*) from u$q$);
  perform pg_temp.e('P09 ravi cannot add a service to sita shop', '42501', $q$insert into public.services (shop_id, name, pricing_unit, bw_price_paise) values ('b0000000-0000-0000-0000-000000000002','x','per_side',1)$q$);
  perform pg_temp.e('P10 ravi cannot make himself owner of sita shop', '42501', $q$insert into public.shop_memberships (shop_id, user_id, role) values ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','owner')$q$);
  perform pg_temp.n('P11 ravi can add a staff member to his shop', 1, $q$with i as (insert into public.shop_memberships (shop_id, user_id, role) values ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','staff') returning 1) select count(*) from i$q$);
  perform pg_temp.n('P12 ravi can remove that staff member again', 1, $q$with d as (delete from public.shop_memberships where shop_id = 'b0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000002' returning 1) select count(*) from d$q$);
  perform pg_temp.n('P13 ravi stats RPC works for his shop', 1, $q$select count(*) from public.shop_stats_summary('b0000000-0000-0000-0000-000000000001', current_date - 30, current_date)$q$);
  perform pg_temp.e('P14 ravi stats RPC refused for sita shop', '42501', $q$select * from public.shop_stats_summary('b0000000-0000-0000-0000-000000000002', current_date - 30, current_date)$q$);
  reset role;

  perform pg_temp.as_user(staff);
  perform pg_temp.n('P15 staff sees orders of the shop they work in', 2, $q$select count(*) from public.orders where shop_id = 'b0000000-0000-0000-0000-000000000001'$q$);
  perform pg_temp.n('P16 staff cannot add services (0 rows)', 0, $q$with i as (update public.services set name = name where shop_id = 'b0000000-0000-0000-0000-000000000001' returning 1) select count(*) from i$q$);
  reset role;

  perform pg_temp.as_user(null);
  perform pg_temp.n('P17 a visitor sees active services only', 1, $q$select count(*) from public.services where shop_id = 'b0000000-0000-0000-0000-000000000001'$q$);
  perform pg_temp.e('P18 a visitor cannot read orders', '42501', $q$select count(*) from public.orders$q$);
  perform pg_temp.e('P19 a visitor cannot call the shop-owner check', '42501', $q$select public.is_shop_owner('b0000000-0000-0000-0000-000000000001')$q$);
  reset role;
end $$;
select name, ok, detail from pr order by name;
rollback;
