CREATE OR REPLACE FUNCTION public.get_user_id_by_email(target_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'auth', 'public'
AS $$
  SELECT id FROM auth.users WHERE email = lower(target_email) LIMIT 1;
$$;