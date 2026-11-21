-- Read-only. The migration ledger as the hosted project records it.
-- Expected: 11 rows before the catch-up; 15 rows after (one new row per applied migration: print_agents,
-- auto_print, advisor_fixes, upi_order_and_print_hardening).
-- Rows are never edited or deleted by this package.
select version, name
from supabase_migrations.schema_migrations
order by version;
