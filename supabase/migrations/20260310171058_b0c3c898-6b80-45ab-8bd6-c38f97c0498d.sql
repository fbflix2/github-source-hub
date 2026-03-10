
-- Force resync stock for all products based on actual stock_items
UPDATE products p
SET stock = sub.real_stock,
    available = sub.real_stock > 0
FROM (
  SELECT product_id, count(*) as real_stock
  FROM stock_items
  WHERE deleted_at IS NULL
    AND status = 'revisado'
    AND order_item_id IS NULL
    AND product_id IS NOT NULL
  GROUP BY product_id
) sub
WHERE p.id = sub.product_id
  AND (p.stock != sub.real_stock OR p.available != (sub.real_stock > 0));
