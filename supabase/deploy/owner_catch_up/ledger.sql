-- Read-only. The migration ledger as the hosted project records it.
-- Expected: 11 rows before the catch-up; 14 rows after (one new row per applied migration).
-- Rows are never edited or deleted by this package.
select version, name
from supabase_migrations.schema_migrations
order by version;
