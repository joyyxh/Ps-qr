-- =========================================================
-- 0023: owner write policies split by command, and indexes for foreign keys.
-- No change to what any user can see or do. NOT YET APPLIED to staging or production.
--
-- Run AFTER 0001 to 0022. Safe to re-run: every statement is idempotent.
--
--   1. shop_memberships and services: the owner write policy was FOR ALL, so it also granted
--      SELECT and overlapped the read policies (the advisor's "multiple permissive policies"
--      warning). It is replaced by INSERT, UPDATE and DELETE policies with the same rule: the
--      caller is an owner of the row's shop. SELECT is still granted by the existing read
--      policies (memberships_read, services_public_read, services_anon_read), so every owner's
--      read rights are unchanged.
--   2. Indexes that cover foreign keys the advisor reported without one. They only speed up
--      joins and cascading deletes. They change no data and no permissions.
--
-- Deliberately NOT in this migration:
--   * Nothing is dropped from the read policies. Merging them is a separate, measured change.
--   * The SECURITY DEFINER warnings are not addressed here. See docs/AUTH_REDESIGN.md.
-- =========================================================

-- 1. shop_memberships: owner writes, one policy per command.
drop policy if exists memberships_owner_write on public.shop_memberships;
drop policy if exists memberships_owner_insert on public.shop_memberships;
drop policy if exists memberships_owner_update on public.shop_memberships;
drop policy if exists memberships_owner_delete on public.shop_memberships;

create policy memberships_owner_insert on public.shop_memberships
  for insert to authenticated
  with check (public.is_shop_owner(shop_id));

create policy memberships_owner_update on public.shop_memberships
  for update to authenticated
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

create policy memberships_owner_delete on public.shop_memberships
  for delete to authenticated
  using (public.is_shop_owner(shop_id));

-- 2. services: owner writes, one policy per command.
drop policy if exists services_owner_write on public.services;
drop policy if exists services_owner_insert on public.services;
drop policy if exists services_owner_update on public.services;
drop policy if exists services_owner_delete on public.services;

create policy services_owner_insert on public.services
  for insert to authenticated
  with check (public.is_shop_owner(shop_id));

create policy services_owner_update on public.services
  for update to authenticated
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

create policy services_owner_delete on public.services
  for delete to authenticated
  using (public.is_shop_owner(shop_id));

-- 3. Indexes that cover foreign keys.
-- owner_policy_acceptances (kind, version) references legal_documents (kind, version).
create index if not exists owner_policy_acceptances_kind_version_idx
  on public.owner_policy_acceptances (kind, version);

-- owner_recovery_codes.user_id references auth.users. The existing index is partial (unused codes
-- only), so a full index is added for the cascading delete when an account is removed.
create index if not exists owner_recovery_codes_user_id_idx
  on public.owner_recovery_codes (user_id);

-- print_agent_pairings.shop_id references shops.
create index if not exists print_agent_pairings_shop_id_idx
  on public.print_agent_pairings (shop_id);

-- print_jobs (agent_id, shop_id) references print_agents (id, shop_id).
create index if not exists print_jobs_agent_shop_idx
  on public.print_jobs (agent_id, shop_id);
