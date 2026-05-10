UPDATE public.subscriptions 
SET 
  raw_data = (SELECT raw_data FROM public.subscriptions WHERE name = 'WS-MOCX3DYP' LIMIT 1),
  updated_at = now()
WHERE name = 'WS-MMQBBY4G';