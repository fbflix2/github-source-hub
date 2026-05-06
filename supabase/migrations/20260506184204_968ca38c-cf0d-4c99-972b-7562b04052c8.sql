
-- ===== suppliers =====
DROP POLICY IF EXISTS "Public can view supplier by token" ON public.suppliers;

-- ===== supplier_requests =====
DROP POLICY IF EXISTS "Public can view requests via token" ON public.supplier_requests;
DROP POLICY IF EXISTS "Suppliers can view their own requests" ON public.supplier_requests;
DROP POLICY IF EXISTS "Users can manage supplier requests" ON public.supplier_requests;

CREATE POLICY "Staff can manage supplier_requests"
  ON public.supplier_requests
  FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

-- ===== supplier_request_items =====
DROP POLICY IF EXISTS "Public can view request items via token" ON public.supplier_request_items;
DROP POLICY IF EXISTS "authenticated_manage_request_items" ON public.supplier_request_items;

CREATE POLICY "Staff can manage supplier_request_items"
  ON public.supplier_request_items
  FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

-- ===== supplier_batches =====
DROP POLICY IF EXISTS "Portal can insert batches" ON public.supplier_batches;
DROP POLICY IF EXISTS "Portal can view own batches" ON public.supplier_batches;
-- Keep: "Staff can manage supplier_batches" (already exists)

-- ===== supplier_accounts =====
DROP POLICY IF EXISTS "Portal can insert accounts" ON public.supplier_accounts;
-- Keep: "Staff can manage supplier_accounts" (already exists)

-- ===== supplier_payment_methods =====
DROP POLICY IF EXISTS "Suppliers can view their own payment methods" ON public.supplier_payment_methods;
DROP POLICY IF EXISTS "Suppliers can insert their own payment methods" ON public.supplier_payment_methods;
DROP POLICY IF EXISTS "Suppliers can update their own payment methods" ON public.supplier_payment_methods;
DROP POLICY IF EXISTS "Suppliers can delete their own payment methods" ON public.supplier_payment_methods;

CREATE POLICY "Staff can manage supplier_payment_methods"
  ON public.supplier_payment_methods
  FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));
