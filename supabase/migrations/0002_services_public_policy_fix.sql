-- Fix: anonymous visitors could not read any service.
--
-- The Stage 1 policy services_public_read was written for both anon and
-- authenticated as: using (is_active or public.is_shop_member(shop_id)).
-- anon has no EXECUTE permission on is_shop_member, so Postgres raised
-- "permission denied for function is_shop_member" instead of returning
-- the active rows. The customer shop page could not load its services.
--
-- Fix: anon gets its own policy that needs no function call. The existing
-- policy is limited to signed-in users, who keep the member check so owners
-- can still see their inactive services.

create policy services_anon_read on public.services
  for select to anon
  using (is_active);

alter policy services_public_read on public.services
  to authenticated
  using (is_active or public.is_shop_member(shop_id));
