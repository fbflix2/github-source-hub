CREATE OR REPLACE FUNCTION public.get_public_client_avatars(_limit int DEFAULT 3)
RETURNS TABLE(avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.avatar_url
  FROM public.profiles p
  WHERE p.avatar_url IS NOT NULL AND p.avatar_url <> ''
  ORDER BY p.updated_at DESC NULLS LAST
  LIMIT LEAST(GREATEST(_limit, 1), 10)
$$;

GRANT EXECUTE ON FUNCTION public.get_public_client_avatars(int) TO anon, authenticated;