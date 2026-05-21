UPDATE public.subscriptions 
SET 
  raw_data = raw_data || jsonb_build_object('exchange_quota_free', (COALESCE((raw_data->>'exchange_quota_free')::int, 0) + 2)),
  updated_at = now()
WHERE name = 'WS-MPFMHJKJ';