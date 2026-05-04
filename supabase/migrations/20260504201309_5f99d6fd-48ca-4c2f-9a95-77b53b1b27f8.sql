-- Ajustar políticas para supplier_requests
DROP POLICY IF EXISTS "Admins can manage all supplier requests" ON public.supplier_requests;
CREATE POLICY "Users can manage supplier requests" 
ON public.supplier_requests 
FOR ALL 
USING (auth.role() = 'authenticated');

-- Ajustar políticas para supplier_request_items
DROP POLICY IF EXISTS "Staff can manage request items" ON public.supplier_request_items;
CREATE POLICY "Users can manage supplier request items" 
ON public.supplier_request_items 
FOR ALL 
USING (auth.role() = 'authenticated');
