UPDATE public.subscriptions 
SET raw_data = jsonb_set(
  COALESCE(raw_data, '{}'::jsonb),
  '{product}',
  '{"id": 9, "name": "PROXY ALTA ROTAÇÃO WEB SCRAPING", "type": "HTTP"}'::jsonb
)
WHERE name = '2602253053';