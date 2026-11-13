-- Re-capture of web/tests/fixtures/licence-status-rpc.json on the local throwaway cluster.
-- The whole run is one transaction that ends in ROLLBACK. The 0011 coverage function is replaced
-- by a stub for this transaction only. Only the 0012 owner RPC body and its JSON output are exercised.
\set ON_ERROR_STOP 1
begin;
create or replace function public.shop_licence_state(p_shop_id uuid, p_at timestamptz default now())
returns table (state text, basis text, access_until timestamptz, next_start timestamptz)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare c text := current_setting('qrq.case', true);
begin
  if c = 'owner_active_dated' then
    return query select 'ACTIVE'::text, 'stub'::text, '2027-12-31 18:30:00+00'::timestamptz, null::timestamptz;
  elsif c = 'owner_active_lifetime' then
    return query select 'ACTIVE'::text, 'stub'::text, null::timestamptz, null::timestamptz;
  elsif c = 'owner_scheduled' then
    return query select 'SCHEDULED'::text, 'stub'::text, null::timestamptz, '2026-12-01 18:30:00+00'::timestamptz;
  elsif c = 'owner_expired' then
    return query select 'EXPIRED'::text, 'stub'::text, null::timestamptz, null::timestamptz;
  elsif c = 'owner_revoked' then
    return query select 'REVOKED'::text, 'stub'::text, null::timestamptz, null::timestamptz;
  else
    return query select 'NONE'::text, 'stub'::text, null::timestamptz, null::timestamptz;
  end if;
end $$;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000a3');
insert into public.shops (id) values ('00000000-0000-4000-8000-0000000000b1');
insert into public.shop_memberships (shop_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'owner'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a2', 'staff');

-- owner cases (claims = owner a1, the case is read by the stub)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1"}', true) \gset
select set_config('qrq.case', 'owner_active_dated', true) \gset
select 'RESULT|owner_active_dated|' || public.shop_licence_status('00000000-0000-4000-8000-0000000000b1')::text;
select set_config('qrq.case', 'owner_active_lifetime', true) \gset
select 'RESULT|owner_active_lifetime|' || public.shop_licence_status('00000000-0000-4000-8000-0000000000b1')::text;
select set_config('qrq.case', 'owner_scheduled', true) \gset
select 'RESULT|owner_scheduled|' || public.shop_licence_status('00000000-0000-4000-8000-0000000000b1')::text;
select set_config('qrq.case', 'owner_expired', true) \gset
select 'RESULT|owner_expired|' || public.shop_licence_status('00000000-0000-4000-8000-0000000000b1')::text;
select set_config('qrq.case', 'owner_revoked', true) \gset
select 'RESULT|owner_revoked|' || public.shop_licence_status('00000000-0000-4000-8000-0000000000b1')::text;
select set_config('qrq.case', 'owner_none', true) \gset
select 'RESULT|owner_none|' || public.shop_licence_status('00000000-0000-4000-8000-0000000000b1')::text;

-- non-owner and unauthenticated cases
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2"}', true) \gset
select 'RESULT|staff_same_shop|' || public.shop_licence_status('00000000-0000-4000-8000-0000000000b1')::text;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3"}', true) \gset
select 'RESULT|stranger|' || public.shop_licence_status('00000000-0000-4000-8000-0000000000b1')::text;
select set_config('request.jwt.claims', '', true) \gset
select 'RESULT|anon_no_claims|' || public.shop_licence_status('00000000-0000-4000-8000-0000000000b1')::text;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1"}', true) \gset
select 'RESULT|null_shop_id|' || public.shop_licence_status(null::uuid)::text;
rollback;
