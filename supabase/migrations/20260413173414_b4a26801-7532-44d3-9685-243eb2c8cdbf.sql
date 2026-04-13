-- Remove proxybr duplicate
DELETE FROM subscriptions WHERE id = '039820ff-e2a9-4798-83e2-235eb5e898cf';

-- Update webshare subscription to keep only the third proxy (45.179.90.106:34120)
UPDATE subscriptions
SET raw_data = jsonb_set(
  jsonb_set(
    raw_data,
    '{original_raw_data,proxies,data}',
    '[{"code":"45.179.90.106:34120:s0auXtPh:gIAsLXJs","id":508188,"notes":null,"status":"USED"}]'::jsonb
  ),
  '{original_raw_data,proxies,total}',
  '1'::jsonb
)
WHERE id = '8d2973c9-d90f-42b7-ba4d-1305df35c259';