-- 1. product_views: remove redundant permissive INSERT policy ("Insert own product views" already enforces user_id IS NULL OR user_id = auth.uid())
DROP POLICY IF EXISTS "Anyone can insert product views" ON public.product_views;

-- 2. consent_logs: remove redundant permissive INSERT policy ("Insert own consent logs" already enforces user_id IS NULL OR user_id = auth.uid())
DROP POLICY IF EXISTS "Anyone can insert consent logs" ON public.consent_logs;

-- 3. partner_journey_events: remove redundant permissive INSERT policy ("Insert own journey events" already enforces user_id IS NULL OR user_id = auth.uid())
DROP POLICY IF EXISTS "anyone can insert journey events" ON public.partner_journey_events;

-- 4. marketplace_bm_leads: replace WITH CHECK (true) with field and initial-status validation
DROP POLICY IF EXISTS "anyone can submit lead" ON public.marketplace_bm_leads;
CREATE POLICY "anyone can submit lead"
ON public.marketplace_bm_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  char_length(trim(seller_name)) >= 2
  AND char_length(trim(seller_whatsapp)) >= 8
  AND char_length(trim(bm_name)) >= 2
  AND asking_price >= 0
  AND status = 'novo'
);

-- 5. reseller_product_tags: replace USING (true) with active-reseller check
DROP POLICY IF EXISTS "Public can read reseller product tags" ON public.reseller_product_tags;
CREATE POLICY "Public can read reseller product tags"
ON public.reseller_product_tags
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.id = reseller_product_tags.reseller_id
      AND r.status = 'active'
  )
);