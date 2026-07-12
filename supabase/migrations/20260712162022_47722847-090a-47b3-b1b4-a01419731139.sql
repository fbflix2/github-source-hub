
CREATE POLICY "Resellers can view their subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
);

CREATE POLICY "Resellers can view their subscribers profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT s.user_id FROM public.subscriptions s
    JOIN public.resellers r ON r.id = s.reseller_id
    WHERE r.user_id = auth.uid()
  )
);
