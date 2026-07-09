
DROP POLICY IF EXISTS "Staff can insert logs" ON public.whatsapp_logs;
DROP POLICY IF EXISTS "Staff can update logs" ON public.whatsapp_logs;
CREATE POLICY "Staff can insert logs" ON public.whatsapp_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update logs" ON public.whatsapp_logs
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Insert own consent logs" ON public.consent_logs;
CREATE POLICY "Insert own consent logs" ON public.consent_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Insert own journey events" ON public.partner_journey_events;
CREATE POLICY "Insert own journey events" ON public.partner_journey_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Insert own product views" ON public.product_views;
CREATE POLICY "Insert own product views" ON public.product_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "No client access" ON public.password_reset_codes;
CREATE POLICY "No client access" ON public.password_reset_codes
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

ALTER FUNCTION public.process_partner_referral() SET search_path = public;
ALTER FUNCTION public.process_safe_bm_renewals() SET search_path = public;
