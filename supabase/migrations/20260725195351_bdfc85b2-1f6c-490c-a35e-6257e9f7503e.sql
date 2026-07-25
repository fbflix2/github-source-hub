CREATE POLICY "Resellers can view their orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  reseller_id IN (
    SELECT id FROM public.resellers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Resellers can view their order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.resellers r ON r.id = o.reseller_id
    WHERE o.id = order_items.order_id
      AND r.user_id = auth.uid()
  )
);