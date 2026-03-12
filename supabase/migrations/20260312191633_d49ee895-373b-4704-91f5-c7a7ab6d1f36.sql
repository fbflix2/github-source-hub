UPDATE products 
SET tags = array_append(tags, 'webshare')
WHERE icon_type = 'proxy' 
  AND external_id IS NULL 
  AND tags IS NOT NULL 
  AND NOT ('webshare' = ANY(tags));