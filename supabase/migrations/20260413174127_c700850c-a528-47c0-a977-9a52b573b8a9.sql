UPDATE subscriptions
SET raw_data = jsonb_set(
  jsonb_set(
    raw_data,
    '{original_raw_data,proxies,data}',
    '[{"code":"45.179.90.106:34120:s0auXtPh:gIAsLXJs","id":508188,"notes":null,"status":"USED"},{"code":"185.14.238.7:7760:s0auXtPh:gIAsLXJs","id":506680,"notes":null,"status":"USED"}]'::jsonb
  ),
  '{original_raw_data,proxies,total}',
  '2'::jsonb
)
WHERE id = '8d2973c9-d90f-42b7-ba4d-1305df35c259';