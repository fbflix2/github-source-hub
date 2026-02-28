CREATE POLICY "Users can update own page requests status"
ON public.page_requests FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);