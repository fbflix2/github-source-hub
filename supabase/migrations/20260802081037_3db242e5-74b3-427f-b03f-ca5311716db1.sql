ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'hero',
  ADD COLUMN IF NOT EXISTS badge_text text,
  ADD COLUMN IF NOT EXISTS accent_color text;

INSERT INTO public.banners (title, subtitle, cta_text, link_url, position, active, category, kind, badge_text, accent_color, audience, image_style)
SELECT 'Combos de Proteção: economize até 30%',
       'Proteja 10, 25 ou 50 BMs em um único plano. Recuperação rápida, suporte prioritário e desconto progressivo por unidade.',
       'Ver combos', '/safe-bm/combos', 0, true, 'promo', 'sub', 'NOVO • SAFE BM', '#00F0FF', 'store', 'contained'
WHERE NOT EXISTS (SELECT 1 FROM public.banners WHERE kind = 'sub');