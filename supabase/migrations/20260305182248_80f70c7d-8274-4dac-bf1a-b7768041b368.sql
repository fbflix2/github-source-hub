-- Fix existing replacement for order ORD-MMCAQUN3: add _replaced flag to delivery_data
UPDATE order_items
SET delivery_data = delivery_data || '{"_replaced": true, "_replaced_at": "2026-03-05T18:18:00Z"}'::jsonb
WHERE id = '659788bf-99cf-4c39-aa96-c1dd6105f30e'
  AND delivery_data IS NOT NULL;