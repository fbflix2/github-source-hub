
-- Reactivate the second subscription with its own proxy credentials
UPDATE public.subscriptions 
SET 
  status = 'active',
  cancelled_at = NULL,
  start_date = now(),
  end_date = now() + interval '30 days'
WHERE id = '360b0b6d-1d6a-49f8-bede-1ae061f5c608';

-- Remove proxy2 data from the merged subscription (keep only first proxy)
UPDATE public.subscriptions 
SET raw_data = raw_data 
  - 'proxy2_address' 
  - 'proxy2_port' 
  - 'proxy2_username' 
  - 'proxy2_password' 
  - 'proxy2_city_name' 
  - 'proxy2_country_code' 
  - 'proxy2_webshare_proxy_id'
WHERE id = '9d9d271f-00a8-4bf6-8ea6-61df4087ef1f';
