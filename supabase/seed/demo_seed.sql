-- DEVELOPMENT ONLY. Creates two test owners, two shops and sample services.
-- Real owners sign up through Supabase Auth and create shops with create_shop().
-- Do not run this against a production project.

insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner.demo@printnest.test',  now(), now(), '{"provider":"email"}', '{}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'owner.other@printnest.test', now(), now(), '{"provider":"email"}', '{}')
on conflict (id) do nothing;

insert into public.shops (id, slug, name, phone, address) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'demo-xerox',   'Demo Xerox Centre', '+91 98765 00001', 'Main Road, Ranchi'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'other-print',  'Other Print Hub',   '+91 98765 00002', 'Station Road, Patna')
on conflict (id) do nothing;

insert into public.shop_memberships (shop_id, user_id, role) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'owner')
on conflict do nothing;

insert into public.services (id, shop_id, name, pricing_unit, bw_price_paise, colour_price_paise, is_active) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Document printing',          'per_side',  200,  1000, true),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Passport photo sheet',       'per_copy',  null, 3000, true),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'Old inkjet print',           'per_side',  300,  null, false),
  ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', 'Document printing',          'per_side',  250,  1200, true),
  ('cccccccc-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000001', 'Assignment print (per sheet)', 'per_sheet', 150,  null, true)
on conflict (id) do nothing;
