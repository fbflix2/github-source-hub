CREATE POLICY "Resellers can view their linked profiles"
ON public.profiles FOR SELECT
USING (
  reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
);