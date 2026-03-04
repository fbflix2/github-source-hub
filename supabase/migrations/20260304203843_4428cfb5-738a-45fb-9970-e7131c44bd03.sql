
-- Table to track product exchanges/swaps
CREATE TABLE public.product_exchanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  order_item_id uuid NOT NULL,
  original_product_id uuid REFERENCES public.products(id),
  original_product_name text NOT NULL,
  original_stock_item_id uuid REFERENCES public.stock_items(id),
  new_product_id uuid REFERENCES public.products(id),
  new_product_name text NOT NULL,
  new_stock_item_id uuid REFERENCES public.stock_items(id),
  price_difference numeric NOT NULL DEFAULT 0,
  wallet_adjusted boolean NOT NULL DEFAULT false,
  reason text,
  performed_by uuid NOT NULL,
  client_user_id uuid NOT NULL,
  client_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_exchanges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage exchanges"
  ON public.product_exchanges FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()));
