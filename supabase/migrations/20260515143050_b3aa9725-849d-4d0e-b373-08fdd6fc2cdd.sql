UPDATE public.safe_bm_vaults 
SET bm_name = 'BM 3 (Nova)',
    status = 'pending'
WHERE id = '7ea32c4f-de37-4f64-930e-31f89fd3dafc';

UPDATE public.bm_tracking
SET product_name = 'BM 3 (Nova)',
    status = 'pending'
WHERE id = '2655d53c-41ac-4347-a942-d6a9dc321e05';