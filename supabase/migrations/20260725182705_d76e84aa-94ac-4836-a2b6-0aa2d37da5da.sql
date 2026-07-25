CREATE OR REPLACE FUNCTION public.enforce_reseller_order_item_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reseller_id uuid;
  v_price numeric;
  v_is_proxy boolean := false;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT o.reseller_id
    INTO v_reseller_id
  FROM public.orders o
  WHERE o.id = NEW.order_id
  LIMIT 1;

  IF v_reseller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT (
      p.icon_type = 'proxy'
      OR pc.slug = 'proxy'
      OR lower(COALESCE(p.name, '')) LIKE '%proxy%'
      OR EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.tags, ARRAY[]::text[])) tag
        WHERE lower(tag) LIKE '%proxy%'
      )
    ),
    CASE
      WHEN rpo.product_id IS NOT NULL THEN COALESCE(rpo.custom_price, 0)
      WHEN r.proxy_price_mode = 'fixed' AND r.proxy_fixed_price IS NOT NULL THEN COALESCE(r.proxy_fixed_price, 0)
      ELSE COALESCE(p.price, 0) * COALESCE(NULLIF(r.proxy_price_multiplier, 0), 1)
    END
    INTO v_is_proxy, v_price
  FROM public.products p
  JOIN public.resellers r ON r.id = v_reseller_id
  LEFT JOIN public.product_categories pc ON pc.id = p.category_id
  LEFT JOIN public.reseller_price_overrides rpo
    ON rpo.reseller_id = r.id
   AND rpo.product_id = p.id
  WHERE p.id = NEW.product_id
    AND r.status IN ('active', 'warning')
    AND COALESCE(rpo.enabled, true) = true
  LIMIT 1;

  IF v_is_proxy AND v_price IS NOT NULL THEN
    NEW.price := v_price;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_reseller_order_item_price ON public.order_items;
CREATE TRIGGER trg_enforce_reseller_order_item_price
BEFORE INSERT OR UPDATE OF product_id, price, order_id
ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_reseller_order_item_price();

CREATE OR REPLACE FUNCTION public.sync_reseller_order_totals_from_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_subtotal numeric;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  IF v_order_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = v_order_id
      AND o.reseller_id IS NOT NULL
      AND o.status IN ('processing', 'payment_failed', 'abandoned')
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(COALESCE(oi.price, 0) * GREATEST(COALESCE(oi.quantity, 1), 1)), 0)
    INTO v_subtotal
  FROM public.order_items oi
  WHERE oi.order_id = v_order_id;

  UPDATE public.orders o
     SET subtotal = v_subtotal,
         total = GREATEST(0, v_subtotal - COALESCE(o.discount, 0))
   WHERE o.id = v_order_id
     AND o.reseller_id IS NOT NULL;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_reseller_order_totals_insert ON public.order_items;
DROP TRIGGER IF EXISTS trg_sync_reseller_order_totals_update ON public.order_items;
DROP TRIGGER IF EXISTS trg_sync_reseller_order_totals_delete ON public.order_items;

CREATE TRIGGER trg_sync_reseller_order_totals_insert
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_reseller_order_totals_from_items();

CREATE TRIGGER trg_sync_reseller_order_totals_update
AFTER UPDATE OF price, quantity, order_id ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_reseller_order_totals_from_items();

CREATE TRIGGER trg_sync_reseller_order_totals_delete
AFTER DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_reseller_order_totals_from_items();