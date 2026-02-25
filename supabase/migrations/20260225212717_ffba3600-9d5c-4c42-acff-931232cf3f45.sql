CREATE OR REPLACE FUNCTION public.get_total_wallet_balance()
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(balance), 0) FROM public.profiles;
$$;