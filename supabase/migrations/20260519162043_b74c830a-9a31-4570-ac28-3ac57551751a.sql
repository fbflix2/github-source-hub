UPDATE public.bm_tracking
SET order_id = 'f1a2c0f8-d367-4fab-9e98-d29710c620c8',
    order_item_id = CASE
      WHEN stock_item_id = '0cbb4cb4-b899-4a5d-9c71-ab6f1e8a313c'::uuid THEN '8949e693-cf3a-40cc-a9a4-16d40750950e'::uuid
      WHEN stock_item_id = '1d732d42-f0b8-4775-9d8b-d774f964c1e9'::uuid THEN 'cae2438e-15b6-4623-950e-3ddca232106b'::uuid
      ELSE order_item_id
    END,
    client_user_id = '497a007c-3208-4105-8870-dc4e4b6fedb1',
    client_name = 'Aline Soares Santos',
    sale_price = 100,
    status = 'active',
    sold_at = now(),
    expires_at = now() + interval '7 days',
    updated_at = now()
WHERE stock_item_id IN (
  '0cbb4cb4-b899-4a5d-9c71-ab6f1e8a313c',
  '1d732d42-f0b8-4775-9d8b-d774f964c1e9'
);