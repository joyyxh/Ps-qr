-- LOCAL REHEARSAL ONLY. Never run this against a hosted project.
-- Production-shaped data for the full-chain rehearsal: three legacy email owners (two never set a password, so
-- they have no password hash), each with a shop, services and orders; one owner also has a staff member.
-- Run on a 0009 database. All ids are fixed so snapshots compare.
insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001','authenticated','authenticated','ravi@example.com', extensions.crypt('OldPassword2025x', extensions.gen_salt('bf', 4)), '{"provider":"email","providers":["email"]}','{}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002','authenticated','authenticated','sita@example.com', null, '{"provider":"email","providers":["email"]}','{}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003','authenticated','authenticated','mohan@example.com', null, '{"provider":"email","providers":["email"]}','{}', now(), now()),
  ('a0000000-0000-0000-0000-000000000009','authenticated','authenticated','staff@example.com', null, '{"provider":"email","providers":["email"]}','{}', now(), now());
insert into auth.identities (id, user_id, provider, provider_id, identity_data)
select gen_random_uuid(), id, 'email', id::text, jsonb_build_object('sub', id::text, 'email', email) from auth.users;

insert into public.shops (id, slug, name, phone) values
  ('b0000000-0000-0000-0000-000000000001','ravi-prints','Ravi Prints','9000000001'),
  ('b0000000-0000-0000-0000-000000000002','sita-xerox','Sita Xerox','9000000002'),
  ('b0000000-0000-0000-0000-000000000003','mohan-copy','Mohan Copy','9000000003');
insert into public.shop_memberships (shop_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','owner'),
  ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002','owner'),
  ('b0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000003','owner'),
  ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000009','staff');
insert into public.services (id, shop_id, name, pricing_unit, bw_price_paise, colour_price_paise, is_active) values
  ('c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','Document printing','per_side',200,800,true),
  ('c0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001','Old service','per_side',300,null,false),
  ('c0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000002','Document printing','per_side',150,600,true),
  ('c0000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-000000000003','Document printing','per_side',100,500,true);
insert into public.orders (id, shop_id, tracking_code, status, total_paise) values
  ('d0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','PRODSHAPE01','pending',400),
  ('d0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001','PRODSHAPE02','pending',200),
  ('d0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000002','PRODSHAPE03','pending',300);
insert into public.customer_files (id, shop_id, storage_path, mime_type, size_bytes, page_count, original_name, claimed_order_id) values
  ('e0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001/e0000000-0000-0000-0000-000000000001.pdf','application/pdf',1000,2,'a.pdf','d0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002/e0000000-0000-0000-0000-000000000002.pdf','application/pdf',1000,2,'b.pdf','d0000000-0000-0000-0000-000000000003');
insert into public.order_items (id, order_id, shop_id, service_id, service_name, pricing_unit, page_count, copies, colour, duplex, billable_units, unit_price_paise, amount_paise, file_id, file_name) values
  ('f0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Document printing','per_side',2,1,false,false,2,200,400,'e0000000-0000-0000-0000-000000000001','a.pdf'),
  ('f0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003','Document printing','per_side',2,1,false,false,2,150,300,'e0000000-0000-0000-0000-000000000002','b.pdf');
