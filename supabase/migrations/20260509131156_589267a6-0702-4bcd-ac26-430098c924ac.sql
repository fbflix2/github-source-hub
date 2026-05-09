-- Correct typos
UPDATE public.products 
SET tags = array_replace(tags, 'Markeplace', 'Marketplace') 
WHERE 'Markeplace' = ANY(tags);

-- Add sample purpose tags to make filters useful immediately
UPDATE public.products 
SET tags = array_append(tags, 'Black')
WHERE name ILIKE '%Restabelecido%' AND NOT ('Black' = ANY(tags));

UPDATE public.products 
SET tags = array_append(tags, 'Contingência')
WHERE name ILIKE '%Restabelecido%' AND NOT ('Contingência' = ANY(tags));

UPDATE public.products 
SET tags = array_append(tags, 'Marketplace')
WHERE name ILIKE '%SPAM%' AND NOT ('Marketplace' = ANY(tags));

UPDATE public.products 
SET tags = array_append(tags, 'White')
WHERE (name ILIKE '%CA 1%' OR name ILIKE '%CA 2%') AND NOT ('White' = ANY(tags));

UPDATE public.products 
SET tags = array_append(tags, 'Facebook')
WHERE (name ILIKE '%Perfil%' OR name ILIKE '%BM%') AND NOT ('Facebook' = ANY(tags));
