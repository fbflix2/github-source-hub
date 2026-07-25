
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS reseller_id uuid;
CREATE INDEX IF NOT EXISTS idx_coupons_reseller_id ON public.coupons(reseller_id);
ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_scope_unique
  ON public.coupons (code, COALESCE(reseller_id, '00000000-0000-0000-0000-000000000000'::uuid));

DROP POLICY IF EXISTS "Resellers can manage own coupons" ON public.coupons;
CREATE POLICY "Resellers can manage own coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (reseller_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.resellers r WHERE r.id = coupons.reseller_id AND r.user_id = auth.uid()))
  WITH CHECK (reseller_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.resellers r WHERE r.id = coupons.reseller_id AND r.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _reseller_id uuid DEFAULT NULL)
 RETURNS TABLE(id uuid, code text, discount_type text, discount_value numeric, max_uses integer, used_count integer, expires_at timestamp with time zone, product_id uuid, status text, reseller_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.code, c.discount_type, c.discount_value, c.max_uses, c.used_count, c.expires_at, c.product_id, c.status, c.reseller_id
  FROM public.coupons c
  WHERE c.code = upper(_code)
    AND c.status = 'active'
    AND (
      (_reseller_id IS NULL AND c.reseller_id IS NULL)
      OR (_reseller_id IS NOT NULL AND c.reseller_id = _reseller_id)
    )
  LIMIT 1;
$function$;
