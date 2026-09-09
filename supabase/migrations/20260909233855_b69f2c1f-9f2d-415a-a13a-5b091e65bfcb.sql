CREATE OR REPLACE FUNCTION public.get_my_reseller_binding()
RETURNS TABLE(reseller_id uuid, slug text, custom_domain text, is_owner boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.slug, r.custom_domain,
         (r.user_id = auth.uid()) AS is_owner
  FROM public.profiles p
  JOIN public.resellers r ON r.id = p.reseller_id
  WHERE p.user_id = auth.uid()
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_my_reseller_binding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_reseller_binding() TO authenticated;