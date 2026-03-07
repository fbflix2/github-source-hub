
CREATE TABLE public.banner_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.banner_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view banner categories" ON public.banner_categories
  FOR SELECT USING (true);

CREATE POLICY "Staff can manage banner categories" ON public.banner_categories
  FOR ALL USING (is_staff(auth.uid()));

-- Seed default categories
INSERT INTO public.banner_categories (value, label, position) VALUES
  ('promo', 'Promoção', 1),
  ('destaque', 'Destaque', 2),
  ('info', 'Informativo', 3),
  ('evento', 'Evento', 4);
