
-- Fase 1: Colunas para configuração da loja pública do revendedor
ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS proxy_price_mode text NOT NULL DEFAULT 'multiplier' CHECK (proxy_price_mode IN ('multiplier','fixed')),
  ADD COLUMN IF NOT EXISTS proxy_price_multiplier numeric NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS proxy_fixed_price numeric,
  ADD COLUMN IF NOT EXISTS hero_title text,
  ADD COLUMN IF NOT EXISTS hero_subtitle text,
  ADD COLUMN IF NOT EXISTS about_text text;

-- Fase 2: banners podem ser específicos de um revendedor
ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES public.resellers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_banners_reseller_id ON public.banners(reseller_id) WHERE reseller_id IS NOT NULL;

-- Função pública que expõe SOMENTE colunas seguras do revendedor pelo slug
CREATE OR REPLACE FUNCTION public.get_reseller_public_by_slug(_slug text)
RETURNS TABLE (
  id uuid,
  slug text,
  company_name text,
  brand_name text,
  logo_url text,
  favicon_url text,
  primary_color text,
  accent_color text,
  support_whatsapp text,
  support_email text,
  hero_title text,
  hero_subtitle text,
  about_text text,
  proxy_price_mode text,
  proxy_price_multiplier numeric,
  proxy_fixed_price numeric,
  status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, slug, company_name, brand_name, logo_url, favicon_url,
         primary_color, accent_color, support_whatsapp, support_email,
         hero_title, hero_subtitle, about_text,
         proxy_price_mode, proxy_price_multiplier, proxy_fixed_price, status
  FROM public.resellers
  WHERE slug = _slug AND status IN ('active','warning')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_reseller_public_by_slug(text) TO anon, authenticated;

-- Trigger para auto-preencher orders.reseller_id a partir do profile do comprador
CREATE OR REPLACE FUNCTION public.autofill_order_reseller_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reseller_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT reseller_id INTO NEW.reseller_id
    FROM public.profiles
    WHERE user_id = NEW.user_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autofill_order_reseller_id ON public.orders;
CREATE TRIGGER trg_autofill_order_reseller_id
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.autofill_order_reseller_id();
