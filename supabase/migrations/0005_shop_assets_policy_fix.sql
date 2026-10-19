-- =========================================================
-- PrintNest Stage 6 fix: the owner upload policy for the shop-assets bucket.
--
-- 0004 checked the shop folder with a subquery on public.shops. Inside that
-- subquery the bare word `name` means shops.name (the shop's name), not
-- storage.objects.name. Two results:
--   1. No honest upload could ever match (stage6 test S28 failed).
--   2. Worse: an owner could rename their shop to "<own shop id>/x". Then the
--      check passed for ANY path in the bucket, so the owner could write or
--      delete another shop's files. Confirmed on the live project in a
--      rolled-back transaction before this fix.
--
-- The fix:
--   * the two 0004 policies are switched to "false", so they grant nothing.
--     They are not dropped here; the cleanup is a separate step (see README).
--   * the folder check moves into a helper function, where `name` can only mean
--     the storage column.
--
-- Run AFTER 0004. Applied to the live project as stage6_fix_shop_assets_policy.
-- =========================================================

alter policy shop_assets_owner_insert on storage.objects with check (false);
alter policy shop_assets_owner_delete on storage.objects using (false);

-- True when the path starts with a shop id the signed-in user owns.
-- Anything that is not "<uuid>/..." is refused.
create or replace function public.shop_folder_is_mine(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
      then public.is_shop_owner((split_part(p_path, '/', 1))::uuid)
    else false
  end;
$$;

revoke execute on function public.shop_folder_is_mine(text) from public, anon;
grant execute on function public.shop_folder_is_mine(text) to authenticated;

create policy shop_assets_folder_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shop-assets' and public.shop_folder_is_mine(name));

create policy shop_assets_folder_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'shop-assets' and public.shop_folder_is_mine(name));

-- Cleanup for later (not run here, because DROP POLICY needs a separate approval):
--   drop policy shop_assets_owner_insert on storage.objects;
--   drop policy shop_assets_owner_delete on storage.objects;
