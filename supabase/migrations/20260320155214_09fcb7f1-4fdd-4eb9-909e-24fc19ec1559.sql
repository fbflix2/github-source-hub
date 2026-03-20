
CREATE OR REPLACE FUNCTION public.fulfill_order_item(p_order_item_id uuid, p_product_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stock_item record;
  v_child record;
  v_current_stock integer;
  v_quantity integer;
  v_linked_count integer := 0;
  v_linked_ids jsonb := '[]'::jsonb;
  v_all_links text[] := '{}';
  v_final_data jsonb;
  v_first_stock_data jsonb;
  v_product_icon_type text;
  v_order_id uuid;
  v_order_user_id uuid;
  v_product_name text;
  v_item_price numeric;
  v_client_name text;
  v_children_data jsonb := '[]'::jsonb;
BEGIN
  SELECT stock, icon_type, name INTO v_current_stock, v_product_icon_type, v_product_name
  FROM products WHERE id = p_product_id FOR UPDATE;

  IF v_current_stock IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto não encontrado');
  END IF;

  SELECT quantity, order_id, price INTO v_quantity, v_order_id, v_item_price
  FROM order_items WHERE id = p_order_item_id;
  IF v_quantity IS NULL OR v_quantity < 1 THEN v_quantity := 1; END IF;

  SELECT user_id INTO v_order_user_id FROM orders WHERE id = v_order_id;
  SELECT full_name INTO v_client_name FROM profiles WHERE user_id = v_order_user_id LIMIT 1;

  IF v_current_stock < v_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto sem estoque suficiente');
  END IF;

  FOR v_stock_item IN
    SELECT id, data, identification, identification_link
    FROM stock_items
    WHERE product_id = p_product_id AND status = 'revisado' AND order_item_id IS NULL
    ORDER BY created_at ASC LIMIT v_quantity
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE stock_items SET order_item_id = p_order_item_id, status = 'vendido' WHERE id = v_stock_item.id;

    -- Also mark all children as sold
    UPDATE stock_items SET order_item_id = p_order_item_id, status = 'vendido' WHERE parent_id = v_stock_item.id;

    v_linked_count := v_linked_count + 1;
    v_linked_ids := v_linked_ids || to_jsonb(v_stock_item.id);

    IF v_stock_item.identification_link IS NOT NULL THEN
      v_all_links := array_append(v_all_links, v_stock_item.identification_link);
    END IF;

    IF v_first_stock_data IS NULL THEN
      v_first_stock_data := COALESCE(v_stock_item.data, '{}'::jsonb);
      IF v_stock_item.identification IS NOT NULL THEN
        v_first_stock_data := v_first_stock_data || jsonb_build_object('idPerfil', v_stock_item.identification);
      END IF;
      IF v_stock_item.identification_link IS NOT NULL THEN
        v_first_stock_data := v_first_stock_data || jsonb_build_object('linkPerfil', v_stock_item.identification_link);
      END IF;
    END IF;

    -- Collect children data for combos
    v_children_data := '[]'::jsonb;
    FOR v_child IN
      SELECT id, name, data, identification, identification_link
      FROM stock_items
      WHERE parent_id = v_stock_item.id
      ORDER BY created_at ASC
    LOOP
      v_children_data := v_children_data || jsonb_build_array(
        jsonb_build_object(
          'stock_item_id', v_child.id,
          'name', v_child.name,
          'identification', v_child.identification,
          'identification_link', v_child.identification_link,
          'data', COALESCE(v_child.data, '{}'::jsonb)
        )
      );
      IF v_child.identification_link IS NOT NULL THEN
        v_all_links := array_append(v_all_links, v_child.identification_link);
      END IF;
    END LOOP;

    -- If this stock item has children, add them to the delivery data
    IF jsonb_array_length(v_children_data) > 0 THEN
      v_first_stock_data := COALESCE(v_first_stock_data, '{}'::jsonb) || jsonb_build_object('comboItems', v_children_data);
    END IF;

    -- Auto-track BM
    IF v_product_icon_type = 'bm' AND v_stock_item.identification_link IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM bm_tracking WHERE stock_item_id = v_stock_item.id) THEN
        UPDATE bm_tracking SET
          order_id = v_order_id,
          order_item_id = p_order_item_id,
          client_user_id = v_order_user_id,
          client_name = v_client_name,
          sale_price = COALESCE(v_item_price, 0),
          status = 'active',
          sold_at = now(),
          expires_at = now() + interval '7 days',
          updated_at = now()
        WHERE stock_item_id = v_stock_item.id;
      ELSE
        INSERT INTO public.bm_tracking (
          order_id, order_item_id, stock_item_id, client_user_id,
          client_name, product_name, bm_link, sale_price
        ) VALUES (
          v_order_id, p_order_item_id, v_stock_item.id, v_order_user_id,
          v_client_name, COALESCE(v_product_name, 'BM'), v_stock_item.identification_link,
          COALESCE(v_item_price, 0)
        );
      END IF;
    END IF;
  END LOOP;

  v_final_data := COALESCE(v_first_stock_data, '{}'::jsonb);
  IF v_product_icon_type = 'bm' AND array_length(v_all_links, 1) > 0 THEN
    v_final_data := v_final_data || jsonb_build_object('bmLinks', to_jsonb(v_all_links));
  END IF;
  IF v_final_data != '{}'::jsonb THEN
    UPDATE order_items SET delivery_data = v_final_data WHERE id = p_order_item_id;
  END IF;

  UPDATE products
  SET stock = GREATEST(0, stock - v_linked_count), available = (stock - v_linked_count) > 0
  WHERE id = p_product_id;

  RETURN jsonb_build_object('success', true, 'linked_count', v_linked_count, 'stock_item_ids', v_linked_ids);
END;
$function$;
