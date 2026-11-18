-- =========================================================
-- 0019: database advisor fixes. No change to what any user can see or do.
--
-- Run AFTER 0001 to 0018. Safe to re-run: every statement is idempotent.
--
--   1. shop_memberships read policy: auth.uid() is wrapped in a scalar subquery, so Postgres
--      evaluates it once per query instead of once per row (Supabase lint auth_rls_initplan).
--      The rule itself is the same: a member sees their own membership, and an owner sees
--      every membership of the shop.
--   2. Covering indexes for the seven foreign keys the performance advisor reported without one.
--      They only speed up joins and cascading deletes. They change no data and no permissions.
--
-- Deliberately NOT in this migration:
--   * place_order's 3-argument overload is still callable by anonymous customers. Guest checkout
--     needs an anonymous order entry point, and the base test suites call this overload, so
--     removing it is a separate decision for the owner.
--   * unused-index and multiple-permissive-policy warnings are left for review; they need
--     measurement on real traffic before anything is dropped or merged.
-- =========================================================

-- 1. Membership read policy: same rule, with auth.uid() evaluated once per query.
drop policy if exists memberships_read on public.shop_memberships;
create policy memberships_read on public.shop_memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_shop_owner(shop_id));

-- 2. Indexes that cover foreign keys.
create index if not exists customer_files_shop_id_idx
  on public.customer_files (shop_id);

create index if not exists customer_files_claimed_order_id_idx
  on public.customer_files (claimed_order_id);

create index if not exists order_items_file_same_shop_idx
  on public.order_items (file_id, shop_id);

create index if not exists order_items_order_id_shop_id_idx
  on public.order_items (order_id, shop_id);

create index if not exists order_items_service_id_shop_id_idx
  on public.order_items (service_id, shop_id);

create index if not exists orders_payment_verified_by_idx
  on public.orders (payment_verified_by);

create index if not exists shop_memberships_user_id_idx
  on public.shop_memberships (user_id);
