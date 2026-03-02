
-- Function to sync products.stock with actual available stock_items count
CREATE OR REPLACE FUNCTION public.sync_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product_id uuid;
  v_real_stock integer;
BEGIN
  -- Determine which product_id to sync
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Sync both old and new product if product_id changed
    IF OLD.product_id IS DISTINCT FROM NEW.product_id THEN
      -- Sync old product
      IF OLD.product_id IS NOT NULL THEN
        SELECT count(*) INTO v_real_stock
        FROM stock_items
        WHERE product_id = OLD.product_id
          AND deleted_at IS NULL
          AND status = 'revisado'
          AND order_item_id IS NULL;

        UPDATE products
        SET stock = v_real_stock,
            available = v_real_stock > 0
        WHERE id = OLD.product_id;
      END IF;
    END IF;
    v_product_id := NEW.product_id;
  ELSE
    v_product_id := NEW.product_id;
  END IF;

  -- Sync the target product
  IF v_product_id IS NOT NULL THEN
    SELECT count(*) INTO v_real_stock
    FROM stock_items
    WHERE product_id = v_product_id
      AND deleted_at IS NULL
      AND status = 'revisado'
      AND order_item_id IS NULL;

    UPDATE products
    SET stock = v_real_stock,
        available = v_real_stock > 0
    WHERE id = v_product_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on INSERT, UPDATE, DELETE
CREATE TRIGGER trg_sync_product_stock
AFTER INSERT OR UPDATE OR DELETE ON public.stock_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_stock();
