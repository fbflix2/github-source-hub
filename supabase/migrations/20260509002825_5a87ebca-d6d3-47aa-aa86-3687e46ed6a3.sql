UPDATE public.subscriptions 
SET raw_data = raw_data || jsonb_build_object(
  'fbflix_proxy_id', 'd-17371142801',
  'proxy_address', '108.165.197.5',
  'port', 6244,
  'username', 'fhvaccdh',
  'password', '19ao11w7oapk',
  'country_code', 'BR',
  'city_name', 'Fortaleza'
)
WHERE id = 'e319eca4-f1e1-437e-a4c3-74af79735a9b';