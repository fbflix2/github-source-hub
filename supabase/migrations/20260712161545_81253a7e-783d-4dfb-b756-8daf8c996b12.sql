-- Add CNPJ column and allow self-registration of resellers
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS cnpj text;

-- Allow authenticated user to create their own reseller record on signup
DROP POLICY IF EXISTS "Reseller can create own record" ON public.resellers;
CREATE POLICY "Reseller can create own record"
ON public.resellers
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());