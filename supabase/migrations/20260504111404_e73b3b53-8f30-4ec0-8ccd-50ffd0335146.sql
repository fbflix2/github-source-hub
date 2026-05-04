-- Drop the existing restricted policy
DROP POLICY IF EXISTS "Admins can manage supplier_accounts" ON public.supplier_accounts;

-- Create a new policy that allows both Admins and Moderators (Staff)
CREATE POLICY "Staff can manage supplier_accounts" 
ON public.supplier_accounts 
FOR ALL 
USING (is_staff(auth.uid())) 
WITH CHECK (is_staff(auth.uid()));