
CREATE TABLE public.product_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL,
  user_id uuid,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_views_product_viewed ON public.product_views (product_id, viewed_at DESC);
CREATE INDEX idx_product_views_viewed_at ON public.product_views (viewed_at DESC);

GRANT INSERT ON public.product_views TO anon, authenticated;
GRANT SELECT ON public.product_views TO authenticated;
GRANT ALL ON public.product_views TO service_role;

ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert product views"
  ON public.product_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can view product views"
  ON public.product_views FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));
