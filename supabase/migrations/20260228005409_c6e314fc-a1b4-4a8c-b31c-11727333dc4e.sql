-- Fix existing stale page_requests that should be completed
-- This is a one-time data fix
UPDATE page_requests SET status = 'completed' WHERE status IN ('pending', 'confirmed') AND order_item_id IN (
  SELECT id FROM order_items WHERE delivery_data->>'pageReceivedByClient' = 'true'
);