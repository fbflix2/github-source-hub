UPDATE order_items
SET delivery_data = jsonb_set(
  jsonb_set(
    delivery_data::jsonb,
    '{_replaced}',
    'true'
  ),
  '{_replaced_at}',
  to_jsonb(now()::text)
)
WHERE id = '835bcdb6-b8c8-4134-b127-933997785137';

UPDATE replacements
SET order_id = 'c65349f0-62a3-42c0-bb2c-616dbfb5b34c',
    order_item_id = '835bcdb6-b8c8-4134-b127-933997785137'
WHERE id = '02e8acb8-1d1a-4d8a-b1cd-93e811c6ba09';