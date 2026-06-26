
-- partner_campaigns
CREATE TABLE public.partner_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  destination_url TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_campaigns TO authenticated;
GRANT SELECT, UPDATE ON public.partner_campaigns TO anon;
GRANT ALL ON public.partner_campaigns TO service_role;
ALTER TABLE public.partner_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners manage own campaigns" ON public.partner_campaigns
  FOR ALL TO authenticated
  USING (partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Public can read active campaigns by short_code" ON public.partner_campaigns
  FOR SELECT TO anon USING (status = 'active');

CREATE TRIGGER trg_partner_campaigns_updated_at BEFORE UPDATE ON public.partner_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- partner_pixels
CREATE TABLE public.partner_pixels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  pixel_id TEXT NOT NULL,
  access_token TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_pixels TO authenticated;
GRANT ALL ON public.partner_pixels TO service_role;
ALTER TABLE public.partner_pixels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners manage own pixels" ON public.partner_pixels
  FOR ALL TO authenticated
  USING (partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_partner_pixels_updated_at BEFORE UPDATE ON public.partner_pixels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- partner_creatives
CREATE TABLE public.partner_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'image',
  media_url TEXT,
  copy_text TEXT,
  product_id UUID,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.partner_creatives TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_creatives TO authenticated;
GRANT ALL ON public.partner_creatives TO service_role;
ALTER TABLE public.partner_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view creatives" ON public.partner_creatives
  FOR SELECT TO authenticated USING (status = 'active' OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins manage creatives" ON public.partner_creatives
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_partner_creatives_updated_at BEFORE UPDATE ON public.partner_creatives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC to increment click count safely from public route
CREATE OR REPLACE FUNCTION public.partner_campaign_increment_click(_short_code TEXT)
RETURNS TABLE(destination_url TEXT, partner_id UUID, campaign_id UUID, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.partner_campaigns
    SET clicks = clicks + 1, updated_at = now()
    WHERE short_code = _short_code AND status = 'active'
    RETURNING partner_campaigns.destination_url, partner_campaigns.partner_id, partner_campaigns.id,
              partner_campaigns.utm_source, partner_campaigns.utm_medium, partner_campaigns.utm_campaign,
              partner_campaigns.utm_content, partner_campaigns.utm_term;
END;
$$;

GRANT EXECUTE ON FUNCTION public.partner_campaign_increment_click(TEXT) TO anon, authenticated;
