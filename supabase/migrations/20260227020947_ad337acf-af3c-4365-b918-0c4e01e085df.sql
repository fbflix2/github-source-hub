
CREATE OR REPLACE FUNCTION public.fulfill_order_item(p_order_item_id uuid, p_product_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stock_item record;
  v_current_stock integer;
  v_quantity integer;
  v_linked_count integer := 0;
  v_linked_ids jsonb := '[]'::jsonb;
  v_all_links text[] := '{}';
  v_final_data jsonb;
  v_first_stock_data jsonb;
  v_product_icon_type text;
BEGIN
  -- Get product stock and icon_type
  SELECT stock, icon_type INTO v_current_stock, v_product_icon_type
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF v_current_stock IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto não encontrado');
  END IF;

  -- Get quantity from order_item
  SELECT quantity INTO v_quantity FROM order_items WHERE id = p_order_item_id;
  IF v_quantity IS NULL OR v_quantity < 1 THEN
    v_quantity := 1;
  END IF;

  IF v_current_stock < v_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto sem estoque suficiente');
  END IF;

  -- Link stock_items based on quantity
  FOR v_stock_item IN
    SELECT id, data, identification, identification_link
    FROM stock_items
    WHERE product_id = p_product_id
      AND status = 'revisado'
      AND order_item_id IS NULL
    ORDER BY created_at ASC
    LIMIT v_quantity
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE stock_items
    SET order_item_id = p_order_item_id, status = 'vendido'
    WHERE id = v_stock_item.id;

    v_linked_count := v_linked_count + 1;
    v_linked_ids := v_linked_ids || to_jsonb(v_stock_item.id);

    -- Collect identification_links for BM products
    IF v_stock_item.identification_link IS NOT NULL THEN
      v_all_links := array_append(v_all_links, v_stock_item.identification_link);
    END IF;

    -- Keep first stock item data for delivery_data base
    IF v_first_stock_data IS NULL THEN
      v_first_stock_data := COALESCE(v_stock_item.data, '{}'::jsonb);
      IF v_stock_item.identification IS NOT NULL THEN
        v_first_stock_data := v_first_stock_data || jsonb_build_object('idPerfil', v_stock_item.identification);
      END IF;
      IF v_stock_item.identification_link IS NOT NULL THEN
        v_first_stock_data := v_first_stock_data || jsonb_build_object('linkPerfil', v_stock_item.identification_link);
      END IF;
    END IF;
  END LOOP;

  -- Build delivery_data
  v_final_data := COALESCE(v_first_stock_data, '{}'::jsonb);

  -- For BM products with multiple links, store all links
  IF v_product_icon_type = 'bm' AND array_length(v_all_links, 1) > 0 THEN
    v_final_data := v_final_data || jsonb_build_object('bmLinks', to_jsonb(v_all_links));
  END IF;

  IF v_final_data != '{}'::jsonb THEN
    UPDATE order_items
    SET delivery_data = v_final_data
    WHERE id = p_order_item_id;
  END IF;

  -- Decrement stock by linked count
  UPDATE products
  SET stock = GREATEST(0, stock - v_linked_count),
      available = (stock - v_linked_count) > 0
  WHERE id = p_product_id;

  RETURN jsonb_build_object('success', true, 'linked_count', v_linked_count, 'stock_item_ids', v_linked_ids);
END;
$function$;
