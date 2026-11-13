-- QRquick security hardening: bind private file objects to their database row.
-- Additive migration; existing upload paths are <shop_uuid>/<file_uuid>.<ext>.

alter table public.customer_files
  add constraint customer_files_storage_path_binding check (
    storage_path = shop_id::text || '/' || id::text ||
      case mime_type
        when 'application/pdf' then '.pdf'
        when 'image/jpeg' then '.jpg'
        when 'image/png' then '.png'
      end
  );

comment on constraint customer_files_storage_path_binding on public.customer_files is
  'Private object path must be owned by the row shop and file id, with an extension matching mime_type.';

-- Keep the cleanup surface private. A future scheduled edge function can use
-- the service role to remove expired rows/objects without exposing this table.
create or replace function public.expired_customer_file_paths(p_limit integer default 100)
returns table (id uuid, storage_path text)
language sql
security definer
set search_path = public
as $$
  select id, storage_path
  from public.customer_files
  where claimed_order_id is null
    and expires_at <= now()
  order by expires_at
  limit least(greatest(coalesce(p_limit, 100), 1), 1000)
$$;

revoke all on function public.expired_customer_file_paths(integer) from public, anon, authenticated;
-- service_role is the only caller; the function only returns paths and does not
-- delete data, so object deletion can be retried safely by the cleanup worker.
grant execute on function public.expired_customer_file_paths(integer) to service_role;
