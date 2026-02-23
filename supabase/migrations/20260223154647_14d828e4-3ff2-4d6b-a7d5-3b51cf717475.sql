
CREATE OR REPLACE FUNCTION public.fulfill_order_item(
  p_order_item_id uuid,
  p_product_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stock_item_id uuid;
  v_stock_data jsonb;
  v_current_stock integer;
BEGIN
  -- Lock the product row to prevent concurrent modifications
  SELECT stock INTO v_current_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF v_current_stock IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto não encontrado');
  END IF;

  IF v_current_stock <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto sem estoque');
  END IF;

  -- Find and lock an available stock item
  SELECT id, data INTO v_stock_item_id, v_stock_data
  FROM stock_items
  WHERE product_id = p_product_id
    AND status = 'revisado'
    AND order_item_id IS NULL
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- Link stock item if found
  IF v_stock_item_id IS NOT NULL THEN
    UPDATE stock_items
    SET order_item_id = p_order_item_id, status = 'vendido'
    WHERE id = v_stock_item_id;

    IF v_stock_data IS NOT NULL THEN
      UPDATE order_items
      SET delivery_data = v_stock_data
      WHERE id = p_order_item_id;
    END IF;
  END IF;

  -- Decrement stock atomically
  UPDATE products
  SET stock = GREATEST(0, stock - 1),
      available = (stock - 1) > 0
  WHERE id = p_product_id;

  RETURN jsonb_build_object('success', true, 'stock_item_id', v_stock_item_id);
END;
$$;
