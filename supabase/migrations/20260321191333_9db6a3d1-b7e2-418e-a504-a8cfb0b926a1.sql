-- Add BR tag to Brazilian proxy products missing it
UPDATE products SET tags = array_append(tags, 'BR')
WHERE id IN (
  'f1e3ffa5-38e7-4fd1-a48a-69957a753457',
  '41fa5607-70e9-42db-bcf8-5926cec67f69',
  '6c396fa8-f6a0-43b2-8061-9148213df549',
  '0f469662-a5ce-4761-ba70-07aab27fdf0b',
  '0395c510-6ddc-4100-b897-c25167541d32'
) AND NOT ('BR' = ANY(tags));