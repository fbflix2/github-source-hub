UPDATE public.products 
SET external_id = NULL 
WHERE icon_type = 'proxy' AND external_id IS NOT NULL;