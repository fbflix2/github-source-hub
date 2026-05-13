UPDATE products p
SET stock = (
  SELECT count(*) 
  FROM stock_items s 
  WHERE s.product_id = p.id 
    AND s.status = 'revisado' 
    AND s.order_item_id IS NULL
)
WHERE icon_type != 'proxy'; -- Proxies are handled via external API
