UPDATE subscriptions 
SET raw_data = jsonb_set(
  raw_data,
  '{proxies,data}',
  '[{"id": 520446, "code": "146.103.34.23:5808:AUy9tVHs:F63xJzBs", "notes": null, "parsed": {"ip": "146.103.34.23", "password": "F63xJzBs", "port": "5808", "username": "AUy9tVHs"}, "status": "USED"}]'::jsonb
),
updated_at = now()
WHERE name = '2602263003' AND type = 'proxybr'