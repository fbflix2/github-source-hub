UPDATE public.subscriptions 
SET raw_data = raw_data || '{"proxy_address": "185.72.242.80", "city_name": "São Paulo", "port": 5763, "webshare_proxy_id": "d-17371142766"}'::jsonb,
    updated_at = now()
WHERE id = 'ab64789b-8ea4-42d5-8d3f-62be95df66b0';