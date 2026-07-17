CREATE POLICY "Users can insert own vaults"
ON public.safe_bm_vaults
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);