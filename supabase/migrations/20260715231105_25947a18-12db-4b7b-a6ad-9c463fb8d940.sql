CREATE OR REPLACE FUNCTION public.get_reseller_slug_by_domain(_domain text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT slug
  FROM public.resellers
  WHERE lower(custom_domain) = lower(_domain)
    AND status IN ('active','warning')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_reseller_slug_by_domain(text) TO anon, authenticated;