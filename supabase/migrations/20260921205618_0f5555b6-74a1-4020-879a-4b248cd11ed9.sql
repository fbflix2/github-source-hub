ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS coupon_code text;

DROP FUNCTION IF EXISTS public.get_partner_by_slug(text);

CREATE OR REPLACE FUNCTION public.get_partner_by_slug(_slug text)
RETURNS TABLE(id uuid, slug text, coupon_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.slug, p.coupon_code
  FROM public.partners p
  WHERE lower(p.slug) = lower(_slug)
    AND p.status = 'active'
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_by_slug(text) TO anon, authenticated;