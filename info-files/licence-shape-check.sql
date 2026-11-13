-- Database-level shape check for the 7E owner RPC (migration 0012, as in the file).
-- One transaction, ended by ROLLBACK. Only the state helper public.shop_licence_state is
-- replaced by a stub so each licence state can be set. The coverage algorithm is not tested here.
\set ON_ERROR_STOP 1
\pset format unaligned
\pset tuples_only on
BEGIN;
SET LOCAL session_replication_role = replica;

create or replace function public.shop_licence_state(p_shop_id uuid, p_at timestamptz default now())
returns table(state text, basis text, access_until timestamptz, next_start timestamptz)
language sql stable as $$
  select current_setting('qr.test_state', true), 'stub',
         nullif(current_setting('qr.test_until', true), '')::timestamptz,
         nullif(current_setting('qr.test_next', true), '')::timestamptz
$$;

\i /tmp/claude-0/-home-claude/0c86edef-9199-55e4-a183-f9fd34ea0c1b/scratchpad/owner-rpc-0012.sql

insert into shops (id, slug, name) values ('11111111-1111-1111-1111-111111111111', 'check-shop', 'Check Shop');
insert into shop_memberships (shop_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002', 'staff');

-- OWNER
do $$ begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}',true); perform set_config('qr.test_state','ACTIVE',true); perform set_config('qr.test_until','2028-01-01T00:00:00+05:30',true); perform set_config('qr.test_next','',true); end $$;
select 'OWNER ACTIVE dated | ' || public.shop_licence_status('11111111-1111-1111-1111-111111111111')::text;
do $$ begin perform set_config('qr.test_until','',true); end $$;
select 'OWNER ACTIVE life  | ' || public.shop_licence_status('11111111-1111-1111-1111-111111111111')::text;
do $$ begin perform set_config('qr.test_state','SCHEDULED',true); perform set_config('qr.test_next','2026-12-02T00:00:00+05:30',true); end $$;
select 'OWNER SCHEDULED    | ' || public.shop_licence_status('11111111-1111-1111-1111-111111111111')::text;
do $$ begin perform set_config('qr.test_state','EXPIRED',true); perform set_config('qr.test_next','',true); end $$;
select 'OWNER EXPIRED      | ' || public.shop_licence_status('11111111-1111-1111-1111-111111111111')::text;
do $$ begin perform set_config('qr.test_state','REVOKED',true); end $$;
select 'OWNER REVOKED      | ' || public.shop_licence_status('11111111-1111-1111-1111-111111111111')::text;
do $$ begin perform set_config('qr.test_state','NONE',true); end $$;
select 'OWNER NONE         | ' || public.shop_licence_status('11111111-1111-1111-1111-111111111111')::text;

-- DENIED CALLERS (state set to ACTIVE so a leak would show)
do $$ begin perform set_config('qr.test_state','ACTIVE',true); perform set_config('qr.test_until','2028-01-01T00:00:00+05:30',true); end $$;
do $$ begin perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000002"}',true); end $$;
select 'STAFF same shop    | ' || public.shop_licence_status('11111111-1111-1111-1111-111111111111')::text;
do $$ begin perform set_config('request.jwt.claims','{"sub":"cccccccc-0000-0000-0000-000000000003"}',true); end $$;
select 'STRANGER           | ' || public.shop_licence_status('11111111-1111-1111-1111-111111111111')::text;
do $$ begin perform set_config('request.jwt.claims','',true); end $$;
select 'ANON (no claims)   | ' || public.shop_licence_status('11111111-1111-1111-1111-111111111111')::text;
do $$ begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}',true); end $$;
select 'NULL shop id       | ' || public.shop_licence_status(null)::text;

ROLLBACK;
