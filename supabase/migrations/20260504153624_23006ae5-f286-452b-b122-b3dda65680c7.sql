UPDATE public.bm_tracking 
SET status = 'removed',
    removed_at = now()
WHERE status = 'em_estoque' 
AND stock_item_id IS NULL;
