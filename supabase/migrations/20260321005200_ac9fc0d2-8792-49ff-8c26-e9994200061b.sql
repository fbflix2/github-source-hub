CREATE TABLE public.invoice_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('INV-' || substr(gen_random_uuid()::text, 1, 8)),
  client_user_id uuid NOT NULL,
  client_name text,
  client_email text,
  product_name text NOT NULL,
  product_id uuid REFERENCES public.products(id),
  amount numeric NOT NULL DEFAULT 0,
  reference_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  status text NOT NULL DEFAULT 'pending',
  payment_id uuid REFERENCES public.payments(id),
  mp_payment_id text,
  qr_code text,
  qr_code_base64 text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  paid_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage invoice_links" ON public.invoice_links
  FOR ALL TO authenticated USING (is_staff(auth.uid()));

CREATE POLICY "Anyone can view invoice by code" ON public.invoice_links
  FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER update_invoice_links_updated_at
  BEFORE UPDATE ON public.invoice_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();