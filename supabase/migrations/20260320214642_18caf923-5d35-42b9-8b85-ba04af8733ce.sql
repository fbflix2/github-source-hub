-- Allow clients to read ct_plans (all active plans for comparison)
CREATE POLICY "Authenticated users can view active plans"
ON public.ct_plans FOR SELECT TO authenticated
USING (active = true);

-- Allow clients to read their own ct_clients row
CREATE POLICY "Users can view own ct_client"
ON public.ct_clients FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Allow clients to read their own ct_items
CREATE POLICY "Users can view own ct_items"
ON public.ct_items FOR SELECT TO authenticated
USING (ct_client_id IN (SELECT id FROM public.ct_clients WHERE user_id = auth.uid()));

-- Allow clients to read their own ct_replacements
CREATE POLICY "Users can view own ct_replacements"
ON public.ct_replacements FOR SELECT TO authenticated
USING (ct_client_id IN (SELECT id FROM public.ct_clients WHERE user_id = auth.uid()));

-- Allow clients to insert replacement requests
CREATE POLICY "Users can request ct_replacements"
ON public.ct_replacements FOR INSERT TO authenticated
WITH CHECK (ct_client_id IN (SELECT id FROM public.ct_clients WHERE user_id = auth.uid()));

-- Allow clients to read their own ct_tickets
CREATE POLICY "Users can view own ct_tickets"
ON public.ct_tickets FOR SELECT TO authenticated
USING (ct_client_id IN (SELECT id FROM public.ct_clients WHERE user_id = auth.uid()));

-- Allow clients to insert tickets
CREATE POLICY "Users can create ct_tickets"
ON public.ct_tickets FOR INSERT TO authenticated
WITH CHECK (ct_client_id IN (SELECT id FROM public.ct_clients WHERE user_id = auth.uid()));

-- Allow clients to read their own ct_extra_charges
CREATE POLICY "Users can view own ct_extra_charges"
ON public.ct_extra_charges FOR SELECT TO authenticated
USING (ct_client_id IN (SELECT id FROM public.ct_clients WHERE user_id = auth.uid()));