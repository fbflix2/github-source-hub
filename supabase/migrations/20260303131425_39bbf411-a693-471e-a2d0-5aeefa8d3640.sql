
CREATE TABLE public.replacements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  item_name text NOT NULL,
  client_user_id uuid NOT NULL,
  client_name text,
  reason text NOT NULL,
  item_value numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

ALTER TABLE public.replacements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage replacements" ON public.replacements FOR ALL USING (is_staff(auth.uid()));
