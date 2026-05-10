-- Restrict purchase_requests SELECT to staff only
DROP POLICY IF EXISTS "Suppliers can view open purchase requests" ON public.purchase_requests;
CREATE POLICY "Staff can view purchase requests"
ON public.purchase_requests
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

-- Restrict supplier_accounts to admins only (contains plaintext credentials)
DROP POLICY IF EXISTS "Staff can manage supplier_accounts" ON public.supplier_accounts;
CREATE POLICY "Admins can manage supplier_accounts"
ON public.supplier_accounts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow warming_profiles owners to SELECT their own rows
CREATE POLICY "Users can view own warming_profiles"
ON public.warming_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

-- Allow warming_tasks reads scoped to the parent profile owner
CREATE POLICY "Users can view own warming_tasks"
ON public.warming_tasks
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.warming_profiles wp
  WHERE wp.id = warming_tasks.profile_id
    AND wp.created_by = auth.uid()
));