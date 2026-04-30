UPDATE public.products 
SET available = true, stock = 999 
WHERE icon_type = 'proxy' AND status = 'active';