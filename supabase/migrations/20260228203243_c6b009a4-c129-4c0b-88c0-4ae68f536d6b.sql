CREATE OR REPLACE FUNCTION public.get_client_count()
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*) FROM public.profiles WHERE status = 'active';
$$;