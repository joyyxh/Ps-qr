-- Read-only. Every function in schema public: name, arguments, privileges, and a digest of its definition.
-- Save the output before and after the catch-up. Only track_order, expired_customer_file_paths and the two
-- place_order overloads may change; every other function listed afterwards is new.
select p.proname::text as name,
       pg_get_function_identity_arguments(p.oid) as args,
       coalesce(p.proacl::text, '(default)') as acl,
       md5(pg_get_functiondef(p.oid)) as def_digest
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by 1, 2;
