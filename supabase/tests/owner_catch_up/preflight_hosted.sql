-- READ-ONLY PREFLIGHT. Safe to run on a hosted project: it only reads the catalogue.
-- Run it before the catch-up and again after it. Before: the rows marked 'before' show false.
-- After the catch-up (0010, 0018, 0019) every row must be true.

select 'shops.auto_print_enabled (0018)' as check_name,
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'shops' and column_name = 'auto_print_enabled') as present
union all select 'public.print_jobs table (0010)', to_regclass('public.print_jobs') is not null
union all select 'public.print_agents table (0010)', to_regclass('public.print_agents') is not null
union all select 'public.rate_limits table (0010)', to_regclass('public.rate_limits') is not null
union all select 'customer_files.storage_deleted_at (0010)',
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'customer_files' and column_name = 'storage_deleted_at')
union all select 'owner_print_status(uuid) function (0010)', to_regprocedure('public.owner_print_status(uuid)') is not null
union all select 'approve_order_for_print(uuid) function (0018 replaces 0010 version)', to_regprocedure('public.approve_order_for_print(uuid)') is not null
union all select 'set_auto_print(uuid,boolean) function (0018)', to_regprocedure('public.set_auto_print(uuid,boolean)') is not null
union all select 'orders_auto_print trigger (0018)',
       exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
                where c.relname = 'orders' and t.tgname = 'orders_auto_print' and not t.tgisinternal)
union all select 'shop_memberships_user_id_idx (0019, optional)',
       exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'shop_memberships_user_id_idx');
