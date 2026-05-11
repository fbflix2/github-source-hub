-- 1) Manually fulfill ORD-MOX6HY11 (order_item c4e8f0e8-9a0c-4963-991b-45e9899c1a5e)
-- Find the first available stock item for the Instagram product (c363f81b-d51f-4f24-8ec0-20fa5082a619)
DO $$
DECLARE
  v_stock_item_id uuid;
  v_delivery_data jsonb;
BEGIN
  -- Get the first available stock item
  SELECT id, data INTO v_stock_item_id, v_delivery_data
  FROM public.stock_items
  WHERE product_id = 'c363f81b-d51f-4f24-8ec0-20fa5082a619'
    AND status = 'revisado'
    AND order_item_id IS NULL
  LIMIT 1;

  IF v_stock_item_id IS NOT NULL THEN
    -- Update stock item
    UPDATE public.stock_items
    SET status = 'vendido', order_item_id = 'c4e8f0e8-9a0c-4963-991b-45e9899c1a5e', updated_at = now()
    WHERE id = v_stock_item_id;

    -- Update order item delivery data (order_items table does not have updated_at)
    UPDATE public.order_items
    SET delivery_data = v_delivery_data
    WHERE id = 'c4e8f0e8-9a0c-4963-991b-45e9899c1a5e';
    
    -- Update product stock
    UPDATE public.products
    SET stock = stock - 1
    WHERE id = 'c363f81b-d51f-4f24-8ec0-20fa5082a619';
  END IF;
END $$;