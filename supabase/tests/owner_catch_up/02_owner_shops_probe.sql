-- LOCAL THROWAWAY DATABASE ONLY. The same select the owner app makes at sign-in:
--   web/src/owner-api.js, listMyShops:
--   shop_memberships?user_id=eq.<id>&select=role,shop:shops(...,auto_print_enabled)
-- PostgREST runs it as the signed-in owner, so this runs as the authenticated role with the
-- owner's JWT claims. Variables (psql -v): owner_id.
-- Before the catch-up this fails with: column s.auto_print_enabled does not exist.
-- After the catch-up it returns the owner's one shop.

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);

select m.role, s.id, s.slug, s.name, s.phone, s.address, s.is_open, s.features,
       s.payment_qr_path, s.cash_payment_timing, s.minimum_order_paise, s.auto_print_enabled
  from public.shop_memberships m
  join public.shops s on s.id = m.shop_id
 where m.user_id = :'owner_id'::uuid;

commit;
