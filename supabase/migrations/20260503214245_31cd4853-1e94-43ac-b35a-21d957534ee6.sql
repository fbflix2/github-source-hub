UPDATE public.products 
SET description = REPLACE(description, 'Webshare', 'Proxy Fbflix')
WHERE description LIKE '%Webshare%';

UPDATE public.products 
SET name = REPLACE(name, 'Webshare', 'Proxy Fbflix')
WHERE name LIKE '%Webshare%';