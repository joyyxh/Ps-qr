-- LOCAL REHEARSAL ONLY. Never run this against a hosted project.
-- A few real-shaped rows, so the row digests prove that existing data survives the catch-up and the
-- rollback. Uses the demo shop and service from supabase/seed/demo_seed.sql.

insert into public.orders (id, shop_id, tracking_code, status, total_paise)
values ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'REHEARSAL01', 'pending', 400);

insert into public.customer_files (id, shop_id, storage_path, mime_type, size_bytes, page_count, original_name, claimed_order_id)
values ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001/eeeeeeee-0000-0000-0000-000000000001.pdf',
        'application/pdf', 1000, 2, 'rehearsal.pdf', 'dddddddd-0000-0000-0000-000000000001');

insert into public.order_items (id, order_id, shop_id, service_id, service_name, pricing_unit, page_count, copies,
                                colour, duplex, billable_units, unit_price_paise, amount_paise, file_id, file_name)
values ('ffffffff-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'Document printing',
        'per_side', 2, 1, false, false, 2, 200, 400,
        'eeeeeeee-0000-0000-0000-000000000001', 'rehearsal.pdf');
