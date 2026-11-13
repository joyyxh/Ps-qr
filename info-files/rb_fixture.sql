insert into public.order_charges (order_id, shop_id, label, basis, quantity, amount_paise, total_paise)
select o.id, o.shop_id, 'Guard test', 'per_order', 1, 100, 100 from public.orders o limit 1;
