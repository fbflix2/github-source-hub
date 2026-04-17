-- Restrict fbx_orders SELECT to authenticated users only (was exposed to public/anon)
DROP POLICY IF EXISTS "Users can view open orders" ON public.fbx_orders;

CREATE POLICY "Authenticated users can view open orders"
ON public.fbx_orders
FOR SELECT
TO authenticated
USING (status = 'open');