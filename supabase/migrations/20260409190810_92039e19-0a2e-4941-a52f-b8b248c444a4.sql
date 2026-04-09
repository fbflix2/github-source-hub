
-- Fulfill the pending order item: assign stock item "Veronica Silva" to the unfulfilled order_item
-- 1. Update stock_items: mark as sold, link to order_item
UPDATE stock_items
SET status = 'vendido',
    order_item_id = 'a3122055-40f4-4e36-977a-fd7ea6a46698',
    updated_at = now()
WHERE id = '7c9c1557-07b2-4730-a98e-0a9fbaf9c566';

-- 2. Update order_items: set delivery_data from the stock item's data + identification
UPDATE order_items
SET delivery_data = (
  SELECT jsonb_build_object(
    'idPerfil', si.identification,
    'linkPerfil', si.identification_link
  ) || COALESCE(si.data::jsonb, '{}'::jsonb)
  FROM stock_items si
  WHERE si.id = '7c9c1557-07b2-4730-a98e-0a9fbaf9c566'
)
WHERE id = 'a3122055-40f4-4e36-977a-fd7ea6a46698';

-- 3. Update order status to completed
UPDATE orders
SET status = 'completed',
    updated_at = now()
WHERE id = '36459aaf-896c-46ea-9514-e7e0116330ce';
