
CREATE OR REPLACE FUNCTION public.fulfill_order_item(p_order_item_id uuid, p_product_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stock_item_id uuid;
  v_stock_data jsonb;
  v_identification text;
  v_identification_link text;
  v_current_stock integer;
  v_final_data jsonb;
BEGIN
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

  SELECT id, data, identification, identification_link
  INTO v_stock_item_id, v_stock_data, v_identification, v_identification_link
  FROM stock_items
  WHERE product_id = p_product_id
    AND status = 'revisado'
    AND order_item_id IS NULL
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_stock_item_id IS NOT NULL THEN
    UPDATE stock_items
    SET order_item_id = p_order_item_id, status = 'vendido'
    WHERE id = v_stock_item_id;

    -- Build final delivery_data merging data JSONB + top-level identification fields
    v_final_data := COALESCE(v_stock_data, '{}'::jsonb);
    IF v_identification IS NOT NULL THEN
      v_final_data := v_final_data || jsonb_build_object('idPerfil', v_identification);
    END IF;
    IF v_identification_link IS NOT NULL THEN
      v_final_data := v_final_data || jsonb_build_object('linkPerfil', v_identification_link);
    END IF;

    IF v_final_data != '{}'::jsonb THEN
      UPDATE order_items
      SET delivery_data = v_final_data
      WHERE id = p_order_item_id;
    END IF;
  END IF;

  UPDATE products
  SET stock = GREATEST(0, stock - 1),
      available = (stock - 1) > 0
  WHERE id = p_product_id;

  RETURN jsonb_build_object('success', true, 'stock_item_id', v_stock_item_id);
END;
$function$;
