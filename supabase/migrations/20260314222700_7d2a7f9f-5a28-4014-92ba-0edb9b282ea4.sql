
UPDATE stock_items 
SET order_item_id = '563f195f-78a5-46c2-8292-45094bf3a0d2', 
    status = 'vendido',
    updated_at = now()
WHERE parent_id = '5333a632-8ce8-4e47-ae38-65132f979ed2'
  AND deleted_at IS NULL;
