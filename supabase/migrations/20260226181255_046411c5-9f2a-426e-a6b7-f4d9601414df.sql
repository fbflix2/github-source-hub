
ALTER TABLE public.product_defaults
  ADD COLUMN IF NOT EXISTS price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tempo_plataforma text,
  ADD COLUMN IF NOT EXISTS description text;
