-- Fix RLS policy for supplier_accounts to allow moderators (operators) to view and manage data
DROP POLICY IF EXISTS "Admins can manage supplier_accounts" ON public.supplier_accounts;

CREATE POLICY "Staff can manage supplier_accounts" 
ON public.supplier_accounts 
FOR ALL 
TO authenticated 
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));
