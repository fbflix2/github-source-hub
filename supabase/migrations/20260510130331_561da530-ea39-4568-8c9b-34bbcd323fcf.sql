UPDATE public.subscriptions 
SET 
  status = 'active', 
  end_date = '2026-06-10 12:00:00+00', 
  auto_renew = false,
  updated_at = now() 
WHERE name = 'WS-MMQBBY4G';