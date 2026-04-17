-- Restrict invoice_links SELECT to owner and staff only
DROP POLICY IF EXISTS "Anyone can view invoice links" ON public.invoice_links;
DROP POLICY IF EXISTS "Public can view invoice links" ON public.invoice_links;
DROP POLICY IF EXISTS "Public read invoice_links" ON public.invoice_links;
DROP POLICY IF EXISTS "invoice_links_select_public" ON public.invoice_links;

CREATE POLICY "Owner or staff can view invoice links"
ON public.invoice_links
FOR SELECT
TO authenticated
USING (
  client_user_id = auth.uid()
  OR public.is_staff(auth.uid())
);