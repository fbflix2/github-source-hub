
CREATE TABLE public.partner_banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_url text,
  image_style text default 'cover',
  background_color text,
  cta_text text,
  link_url text,
  category text,
  position int default 0,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

GRANT SELECT ON public.partner_banners TO authenticated, anon;
GRANT ALL ON public.partner_banners TO service_role;

ALTER TABLE public.partner_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active partner banners"
ON public.partner_banners FOR SELECT
USING (active = true);

CREATE POLICY "Admins can manage partner banners"
ON public.partner_banners FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
