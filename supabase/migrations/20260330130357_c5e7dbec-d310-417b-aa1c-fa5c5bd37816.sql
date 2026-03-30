INSERT INTO subscriptions (user_id, name, type, status, start_date, end_date, auto_renew, product_id, raw_data)
SELECT 
  'b9feb3f9-7a24-4451-9252-dfada51f1e1a',
  '2512296940#2',
  'webshare',
  'active',
  NOW(),
  NOW() + interval '30 days',
  s.auto_renew,
  s.product_id,
  '{"webshare_proxy_id":"d-17331292457","proxy_address":"50.114.84.25","port":7264,"username":"fhvaccdh","password":"19ao11w7oapk","country_code":"BR","city_name":"Fortaleza","provider":"webshare","exchange_quota_free":2,"exchange_quota_pay":0,"migrated_from":"proxybr","original_name":"2512296940","proxy_index":2}'::jsonb
FROM subscriptions s WHERE s.id = 'c28b6da6-0cba-40a1-86e6-376cdf1888ca';