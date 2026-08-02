CREATE OR REPLACE FUNCTION public.get_public_client_testimonials(_limit int DEFAULT 9)
RETURNS TABLE(full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE p.avatar_url IS NOT NULL AND p.avatar_url <> ''
    AND p.full_name IS NOT NULL AND p.full_name <> ''
  ORDER BY p.updated_at DESC NULLS LAST
  LIMIT LEAST(GREATEST(_limit, 1), 30)
$$;

GRANT EXECUTE ON FUNCTION public.get_public_client_testimonials(int) TO anon, authenticated;