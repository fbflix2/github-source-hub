-- Find an available stock item for BM 3 (Antiga)
DO $$
DECLARE
  v_stock_item_id uuid;
  v_order_item_id uuid := '6c13e2cf-6153-49d4-b3fb-0277c01b47d6';
  v_product_id uuid := '9dfefc59-2465-49e9-902d-2bac191b287d';
  v_link text;
  v_final_data jsonb;
BEGIN
  -- Get the first available stock item
  SELECT id, identification_link INTO v_stock_item_id, v_link
  FROM stock_items
  WHERE product_id = v_product_id AND status = 'revisado' AND order_item_id IS NULL
  ORDER BY created_at ASC LIMIT 1;

  IF v_stock_item_id IS NOT NULL THEN
    -- Link it
    UPDATE stock_items SET order_item_id = v_order_item_id, status = 'vendido' WHERE id = v_stock_item_id;

    -- Build delivery data (cleaned link)
    v_final_data := jsonb_build_object(
      'bmLinks', jsonb_build_array(trim(COALESCE(nullif(split_part(v_link, '	', 2), ''), v_link))),
      'linkPerfil', v_link,
      'fulfilled', true
    );

    -- Update order item
    UPDATE order_items SET delivery_data = v_final_data WHERE id = v_order_item_id;

    -- Update product stock
    UPDATE products SET stock = GREATEST(0, stock - 1) WHERE id = v_product_id;
    
    RAISE NOTICE 'Order item % fulfilled with stock item %', v_order_item_id, v_stock_item_id;
  END IF;
END $$;