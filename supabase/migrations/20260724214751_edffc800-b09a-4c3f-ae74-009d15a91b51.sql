CREATE POLICY "Resellers can view own reseller payments"
ON public.payments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.resellers r ON r.id = o.reseller_id
    WHERE o.id = payments.order_id
      AND r.user_id = auth.uid()
  )
);