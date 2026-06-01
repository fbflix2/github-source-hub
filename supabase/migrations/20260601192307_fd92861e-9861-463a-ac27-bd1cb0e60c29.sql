CREATE OR REPLACE FUNCTION public.validate_coupon(_code text)
RETURNS TABLE(id uuid, code text, discount_type text, discount_value numeric, max_uses integer, used_count integer, expires_at timestamptz, product_id uuid, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.code, c.discount_type, c.discount_value, c.max_uses, c.used_count, c.expires_at, c.product_id, c.status
  FROM public.coupons c
  WHERE c.code = upper(_code)
    AND c.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text) TO anon, authenticated;