
CREATE TABLE public.bm_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id),
  order_item_id uuid REFERENCES public.order_items(id),
  stock_item_id uuid REFERENCES public.stock_items(id),
  client_user_id uuid NOT NULL,
  client_name text,
  client_email text,
  product_name text NOT NULL,
  bm_link text NOT NULL,
  sale_price numeric NOT NULL DEFAULT 0,
  sold_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  status text NOT NULL DEFAULT 'active',
  notified_at timestamptz,
  removed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bm_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage bm_tracking"
  ON public.bm_tracking FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER update_bm_tracking_updated_at
  BEFORE UPDATE ON public.bm_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
