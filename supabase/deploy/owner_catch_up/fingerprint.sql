-- Read-only. Structural fingerprint: tables, columns, functions, policies, triggers, indexes, constraints.
-- Output is compared before and after; only the objects named in RUNBOOK.md may differ.
select k, count(*) as n, md5(string_agg(name || '=' || d, ';' order by name)) as digest
from (
  select 'table' as k, c.relname::text as name, md5(c.relkind::text) as d
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind in ('r','p','v','m','f')
  union all
  select 'column', table_name::text || '.' || column_name::text,
         md5(data_type::text || '|' || is_nullable::text || '|' || coalesce(column_default::text,'') || '|' || coalesce(character_maximum_length::text,''))
    from information_schema.columns where table_schema = 'public'
  union all
  select 'function', p.proname::text || '(' || pg_get_function_identity_arguments(p.oid) || ')', md5(pg_get_functiondef(p.oid))
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'public'
  union all
  select 'policy', tablename::text || '.' || policyname::text,
         md5(coalesce(qual,'') || '|' || coalesce(with_check,'') || '|' || cmd || '|' || array_to_string(roles, ','))
    from pg_policies where schemaname = 'public'
  union all
  select 'trigger', c.relname::text || '.' || t.tgname::text, md5(pg_get_triggerdef(t.oid))
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and not t.tgisinternal
  union all
  select 'index', indexname::text, md5(indexdef) from pg_indexes where schemaname = 'public'
  union all
  select 'constraint', conrelid::regclass::text || '.' || conname::text, md5(pg_get_constraintdef(oid))
    from pg_constraint where connamespace = 'public'::regnamespace
) x
group by k order by k;
