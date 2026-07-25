CREATE OR REPLACE FUNCTION public.get_reseller_checkout_prices(_slug text, _product_ids uuid[])
RETURNS TABLE(
  reseller_id uuid,
  product_id uuid,
  final_price numeric,
  enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id AS reseller_id,
    p.id AS product_id,
    CASE
      WHEN o.product_id IS NOT NULL THEN COALESCE(o.custom_price, 0)
      WHEN r.proxy_price_mode = 'fixed' AND r.proxy_fixed_price IS NOT NULL THEN COALESCE(r.proxy_fixed_price, 0)
      ELSE COALESCE(p.price, 0) * COALESCE(NULLIF(r.proxy_price_multiplier, 0), 1)
    END AS final_price,
    COALESCE(o.enabled, true) AS enabled
  FROM public.resellers r
  JOIN public.products p ON p.id = ANY(_product_ids)
  LEFT JOIN public.reseller_price_overrides o
    ON o.reseller_id = r.id
   AND o.product_id = p.id
  LEFT JOIN public.product_categories pc
    ON pc.id = p.category_id
  WHERE r.slug = lower(trim(_slug))
    AND r.status IN ('active', 'warning')
    AND (
      p.icon_type = 'proxy'
      OR pc.slug = 'proxy'
      OR lower(COALESCE(p.name, '')) LIKE '%proxy%'
      OR EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.tags, ARRAY[]::text[])) tag
        WHERE lower(tag) LIKE '%proxy%'
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_reseller_checkout_prices(text, uuid[]) TO anon, authenticated, service_role;