-- Recalculate stock for all products to ensure consistency
UPDATE public.products p
SET stock = (
  SELECT count(*)
  FROM public.stock_items s
  WHERE s.product_id = p.id
    AND s.deleted_at IS NULL
    AND s.status = 'revisado'
    AND s.order_item_id IS NULL
),
available = (
  SELECT count(*) > 0
  FROM public.stock_items s
  WHERE s.product_id = p.id
    AND s.deleted_at IS NULL
    AND s.status = 'revisado'
    AND s.order_item_id IS NULL
);

-- Specific check for BM3 verificada (ae1e9901-9bb6-4282-9c1d-a27edefd0977)
-- This is just to be absolutely sure we updated the right one.
