-- LOCAL TEST HARNESS ONLY (combined chain). Not a migration. Applied after every migration.
-- The licence RPC tests insert public.shops with only an id. Origin 0001 requires slug and name.
-- These defaults let those inserts pass and keep every origin constraint:
--   slug: 'shop-' plus 20 lowercase hex characters (25 characters; matches the origin format check; not reserved)
--   name: 'Test shop' (2 to 120 characters)
alter table public.shops alter column slug set default ('shop-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));
alter table public.shops alter column name set default 'Test shop';
