DROP POLICY IF EXISTS "Public can view enabled overrides" ON public.reseller_price_overrides;
CREATE POLICY "Public can view reseller overrides"
ON public.reseller_price_overrides
FOR SELECT
TO anon, authenticated
USING (true);