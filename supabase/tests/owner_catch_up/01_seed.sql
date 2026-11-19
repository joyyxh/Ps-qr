-- LOCAL THROWAWAY DATABASE ONLY. Seeds one shop with one owner and one stranger.
-- Variables (psql -v): owner_id, stranger_id, shop_id (uuids). Never run this against a hosted project.

insert into auth.users (id, email) values
  (:'owner_id'::uuid, 'owner@catch-up.test'),
  (:'stranger_id'::uuid, 'stranger@catch-up.test');

insert into public.shops (id, slug, name)
values (:'shop_id'::uuid, 'catch-up-shop', 'Catch-up shop');

insert into public.shop_memberships (shop_id, user_id, role)
values (:'shop_id'::uuid, :'owner_id'::uuid, 'owner');

-- The browser runs as the authenticated role. Supabase grants this by default; a plain
-- PostgreSQL cluster does not, so the harness grants it to match.
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant usage on schema auth to authenticated;
grant execute on function auth.uid(), auth.jwt() to authenticated;
