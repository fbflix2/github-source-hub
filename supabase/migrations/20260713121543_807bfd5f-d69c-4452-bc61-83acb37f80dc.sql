
ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'store';

COMMENT ON COLUMN public.banners.audience IS 'Público-alvo do banner: "store" (loja para clientes finais) ou "reseller" (painel de revendedores).';

CREATE INDEX IF NOT EXISTS idx_banners_audience_active ON public.banners(audience, active);
