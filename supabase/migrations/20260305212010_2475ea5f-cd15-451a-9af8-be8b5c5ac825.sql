
-- Trigger function: auto-insert into bm_tracking when BM stock item is promoted to 'revisado'
CREATE OR REPLACE FUNCTION public.bm_tracking_on_stock_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When a BM stock item is promoted to 'revisado' with a product_id
  IF NEW.type = 'bm' AND NEW.status = 'revisado' AND NEW.product_id IS NOT NULL
     AND (OLD.status IS DISTINCT FROM 'revisado' OR OLD.product_id IS DISTINCT FROM NEW.product_id) THEN
    -- Only insert if not already tracked
    IF NOT EXISTS (SELECT 1 FROM bm_tracking WHERE stock_item_id = NEW.id) THEN
      INSERT INTO public.bm_tracking (
        stock_item_id, client_user_id, product_name, bm_link, sale_price, status, sold_at, expires_at
      ) VALUES (
        NEW.id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        COALESCE((SELECT name FROM products WHERE id = NEW.product_id), 'BM'),
        COALESCE(NEW.identification_link, ''),
        COALESCE((SELECT price FROM products WHERE id = NEW.product_id), 0),
        'em_estoque',
        now(),
        now() + interval '999 years'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bm_tracking_on_stock_promotion
AFTER UPDATE ON public.stock_items
FOR EACH ROW
EXECUTE FUNCTION public.bm_tracking_on_stock_promotion();

-- Also handle INSERT (when items are created directly as 'revisado')
CREATE TRIGGER trg_bm_tracking_on_stock_insert
AFTER INSERT ON public.stock_items
FOR EACH ROW
WHEN (NEW.type = 'bm' AND NEW.status = 'revisado' AND NEW.product_id IS NOT NULL)
EXECUTE FUNCTION public.bm_tracking_on_stock_promotion();

-- Update fulfill_order_item to UPDATE existing bm_tracking rows instead of always INSERT
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
  v_order_id uuid;
  v_order_user_id uuid;
  v_product_name text;
  v_item_price numeric;
  v_client_name text;
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

  -- Fetch client name
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

    -- Auto-track BM: UPDATE existing row or INSERT new one
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
