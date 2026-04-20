-- Desativa o produto antigo da ProxyBR para que apenas o novo (entrega via Webshare interno) seja vendido
UPDATE public.products
SET status = 'inactive', available = false, stock = 0, updated_at = now()
WHERE id = '0395c510-6ddc-4100-b897-c25167541d32';