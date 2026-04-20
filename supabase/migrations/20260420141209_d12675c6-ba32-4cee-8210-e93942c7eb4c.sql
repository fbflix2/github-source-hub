DROP VIEW IF EXISTS public.fbx_orders_public;

CREATE VIEW public.fbx_orders_public
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  type,
  quantity,
  status,
  fee_rate,
  fee_amount,
  created_at,
  updated_at
FROM public.fbx_orders
WHERE status = 'open';

GRANT SELECT ON public.fbx_orders_public TO authenticated;