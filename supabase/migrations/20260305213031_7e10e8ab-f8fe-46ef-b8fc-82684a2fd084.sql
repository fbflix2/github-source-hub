INSERT INTO public.bm_tracking (stock_item_id, client_user_id, product_name, bm_link, sale_price, status, sold_at, expires_at)
SELECT 
  si.id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  COALESCE(p.name, 'BM'),
  COALESCE(si.identification_link, ''),
  COALESCE(p.price, 0),
  'em_estoque',
  si.updated_at,
  si.updated_at + interval '999 years'
FROM stock_items si
LEFT JOIN products p ON p.id = si.product_id
WHERE si.type = 'bm'
  AND si.status = 'revisado'
  AND si.product_id IS NOT NULL
  AND si.order_item_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM bm_tracking bt WHERE bt.stock_item_id = si.id)
