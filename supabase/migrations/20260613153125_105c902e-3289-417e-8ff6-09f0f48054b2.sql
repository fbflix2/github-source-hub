UPDATE public.subscriptions
SET raw_data = raw_data || jsonb_build_object(
  'fbflix_proxy_id', 'd-17371142756',
  'proxy_address', '45.38.101.190',
  'port', 6123,
  'username', 'fhvaccdh',
  'password', '19ao11w7oapk',
  'country_code', 'BR',
  'city_name', 'São Paulo'
)
WHERE id = 'ec27bf8b-0081-4a71-94ed-e30abd69a5a4';