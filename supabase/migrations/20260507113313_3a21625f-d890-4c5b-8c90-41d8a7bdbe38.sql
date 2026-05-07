
-- Remove bm_tracking rows that point to stock_items that are not actually BMs
-- (e.g. emails accidentally registered as BM type) or to deleted/missing stock_items
DELETE FROM public.bm_tracking bt
WHERE bt.stock_item_id IS NOT NULL
  AND (
    NOT EXISTS (SELECT 1 FROM public.stock_items si WHERE si.id = bt.stock_item_id)
    OR EXISTS (
      SELECT 1 FROM public.stock_items si
      WHERE si.id = bt.stock_item_id
        AND (si.type <> 'bm' OR si.deleted_at IS NOT NULL)
    )
  );

-- Prevent future incorrect inserts: only allow bm_tracking rows whose linked stock_item is type 'bm'
CREATE OR REPLACE FUNCTION public.validate_bm_tracking_stock_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stock_item_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.stock_items
      WHERE id = NEW.stock_item_id
        AND type = 'bm'
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'bm_tracking só aceita stock_items do tipo BM (id=%, ignorado)', NEW.stock_item_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_bm_tracking_stock_type ON public.bm_tracking;
CREATE TRIGGER trg_validate_bm_tracking_stock_type
BEFORE INSERT ON public.bm_tracking
FOR EACH ROW
EXECUTE FUNCTION public.validate_bm_tracking_stock_type();
