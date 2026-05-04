-- 1. Correct stock_items type for incorrectly categorized items
UPDATE public.stock_items 
SET type = 'perfil' 
WHERE type = 'bm' 
AND (
    name ILIKE 'Usuario:%' 
    OR name ILIKE 'Email:%' 
    OR name ILIKE '%@%' 
    OR (data->>'nomeProduto') ILIKE '%Perfil%'
);

-- 2. Update status for bm_tracking entries that are no longer valid 'em_estoque'
-- Mark as 'removed' if the stock item is no longer a BM or was deleted
UPDATE public.bm_tracking bt
SET status = 'removed',
    removed_at = now()
FROM public.stock_items si
WHERE bt.stock_item_id = si.id
AND bt.status = 'em_estoque'
AND si.type != 'bm';

-- Mark as 'removed' if the stock item is missing
UPDATE public.bm_tracking bt
SET status = 'removed',
    removed_at = now()
WHERE bt.status = 'em_estoque'
AND bt.stock_item_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM public.stock_items si WHERE si.id = bt.stock_item_id);

-- Mark as 'active' (sold) if the stock item is marked as 'vendido'
UPDATE public.bm_tracking bt
SET status = 'active',
    sold_at = COALESCE(bt.sold_at, si.updated_at, now())
FROM public.stock_items si
WHERE bt.stock_item_id = si.id
AND bt.status = 'em_estoque'
AND si.status = 'vendido';

-- 3. Add missing real BMs from stock_items to bm_tracking
INSERT INTO public.bm_tracking (
    stock_item_id,
    product_name,
    bm_link,
    sale_price,
    status,
    client_user_id,
    created_at,
    updated_at,
    expires_at
)
SELECT 
    si.id,
    si.name,
    COALESCE(si.identification_link, si.name),
    COALESCE((si.data->>'preco')::numeric, 0),
    'em_estoque',
    '00000000-0000-0000-0000-000000000000',
    si.created_at,
    si.updated_at,
    '3025-01-01'::timestamp -- placeholder for far future
FROM public.stock_items si
LEFT JOIN public.bm_tracking bt ON si.id = bt.stock_item_id
WHERE si.type = 'bm' 
AND si.status IN ('ok', 'revisado') 
AND bt.id IS NULL;
