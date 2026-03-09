
-- Table to store cost breakdown per product
CREATE TABLE public.product_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  tax_percent numeric NOT NULL DEFAULT 0,
  labor_cost numeric NOT NULL DEFAULT 0,
  other_costs numeric NOT NULL DEFAULT 0,
  notes text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

-- RLS
ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage product costs"
  ON public.product_costs
  FOR ALL
  TO public
  USING (is_staff(auth.uid()));

-- Auto-update updated_at
CREATE TRIGGER update_product_costs_updated_at
  BEFORE UPDATE ON public.product_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
