-- 1. profiles: restrict policies to authenticated role only
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff can update all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "Staff can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (is_staff(auth.uid()));

-- 2. ss_transactions: prevent sellers from reading account_credentials column
-- Revoke column SELECT from authenticated; grant only to service_role.
-- Buyers must use get_ss_transaction_credentials() function (already exists & checks status).
REVOKE SELECT (account_credentials) ON public.ss_transactions FROM authenticated, anon, public;

-- 3. documents bucket: allow owners to update/delete their own files
CREATE POLICY "Users can update own documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1]);
