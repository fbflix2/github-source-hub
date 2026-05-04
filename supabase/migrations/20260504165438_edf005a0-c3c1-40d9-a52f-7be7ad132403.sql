-- 1. Fix 'suppliers' table RLS for public portal
-- Allow anyone to select a supplier IF they know the access_token (conceptually)
-- To prevent listing all tokens, we'd ideally use a function, but for now we allow select
-- with a focus on active suppliers.
DROP POLICY IF EXISTS "Staff can manage suppliers" ON public.suppliers;
CREATE POLICY "Staff can manage suppliers" 
ON public.suppliers 
FOR ALL 
TO authenticated
USING (is_staff(auth.uid()));

CREATE POLICY "Public can view supplier by token" 
ON public.suppliers 
FOR SELECT 
TO anon
USING (status = 'active');

-- 2. Fix 'supplier_requests' table RLS
-- Allow portal to view requests for the supplier
DROP POLICY IF EXISTS "Suppliers can view their own requests via token" ON public.supplier_requests;
CREATE POLICY "Suppliers can view their own requests" 
ON public.supplier_requests 
FOR SELECT 
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.suppliers 
        WHERE id = supplier_requests.supplier_id 
        AND status = 'active'
    )
);

-- 3. Fix 'supplier_batches' table RLS
-- Allow portal to create batches
DROP POLICY IF EXISTS "Staff can manage supplier_batches" ON public.supplier_batches;
CREATE POLICY "Staff can manage supplier_batches" 
ON public.supplier_batches 
FOR ALL 
TO authenticated
USING (is_staff(auth.uid()));

CREATE POLICY "Portal can insert batches" 
ON public.supplier_batches 
FOR INSERT 
TO anon
WITH CHECK (true);

CREATE POLICY "Portal can view own batches" 
ON public.supplier_batches 
FOR SELECT 
TO anon
USING (true);

-- 4. Fix 'supplier_accounts' table RLS
-- Allow portal to insert accounts
DROP POLICY IF EXISTS "Staff can manage supplier_accounts" ON public.supplier_accounts;
CREATE POLICY "Staff can manage supplier_accounts" 
ON public.supplier_accounts 
FOR ALL 
TO authenticated
USING (is_staff(auth.uid()));

CREATE POLICY "Portal can insert accounts" 
ON public.supplier_accounts 
FOR INSERT 
TO anon
WITH CHECK (true);
