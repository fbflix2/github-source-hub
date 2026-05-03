-- Update subscription types
UPDATE public.subscriptions 
SET type = 'proxyfbflix' 
WHERE type = 'webshare';

-- Update raw_data keys in subscriptions
UPDATE public.subscriptions
SET raw_data = (
  raw_data - 'webshare_proxy_id' || 
  jsonb_build_object('fbflix_proxy_id', raw_data->'webshare_proxy_id') ||
  jsonb_build_object('provider', 'proxyfbflix')
)
WHERE type = 'proxyfbflix' AND raw_data ? 'webshare_proxy_id';

-- Also update any order_items delivery_data if needed
UPDATE public.order_items
SET delivery_data = jsonb_set(delivery_data, '{type}', '"proxyfbflix_proxy"')
WHERE delivery_data->>'type' = 'webshare_proxy';