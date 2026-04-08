
-- Fix bmLinks for replacement order_item a448157d (Jessica - BM 1392)
UPDATE order_items
SET delivery_data = jsonb_set(
  delivery_data::jsonb,
  '{bmLinks}',
  to_jsonb(ARRAY[(SELECT identification_link FROM stock_items WHERE id = '266cab2a-5344-4825-8f97-5c80efe80b9d')])
)
WHERE id = 'a448157d-08bd-45fd-8a97-838718486947';

-- Fix bmLinks for replacement order_item 9ebaa180 (Ecom - BM 1605)
UPDATE order_items
SET delivery_data = jsonb_set(
  delivery_data::jsonb,
  '{bmLinks}',
  to_jsonb(ARRAY[(SELECT identification_link FROM stock_items WHERE id = '732386cd-0403-42f4-9b67-67d8fcad1e5e')])
)
WHERE id = '9ebaa180-4ed7-4dcc-a83b-c4283cdc5866';
