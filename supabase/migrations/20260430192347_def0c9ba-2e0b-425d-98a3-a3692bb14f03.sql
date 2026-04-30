UPDATE public.order_items
SET delivery_data = jsonb_set(
  COALESCE(delivery_data, '{}'::jsonb),
  '{_replaced_stock_item_ids}',
  '["d8d68226-4734-4366-ae29-6f6ffedb8ed2", "6be9036c-418b-42fb-9439-98331e2435a3"]'::jsonb,
  true
)
WHERE id = 'a7a720ef-8866-4251-9d52-853a6df19ffa';