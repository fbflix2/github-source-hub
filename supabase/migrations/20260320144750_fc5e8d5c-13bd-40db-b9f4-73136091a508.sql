
CREATE TABLE public.order_bumps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  bump_product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  bump_type text NOT NULL DEFAULT 'secondary',
  discount_percent numeric NOT NULL DEFAULT 0,
  fixed_price numeric,
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, bump_product_id)
);

ALTER TABLE public.order_bumps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage order bumps" ON public.order_bumps
  FOR ALL TO authenticated USING (is_staff(auth.uid()));

CREATE POLICY "Anyone can view active order bumps" ON public.order_bumps
  FOR SELECT TO public USING (active = true);
