CREATE TABLE public.marketplace_bm_finance (
  bm_id uuid PRIMARY KEY REFERENCES public.marketplace_bms(id) ON DELETE CASCADE,
  cost numeric NOT NULL DEFAULT 0,
  tax_percent numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_bm_finance TO authenticated;
GRANT ALL ON public.marketplace_bm_finance TO service_role;

ALTER TABLE public.marketplace_bm_finance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage marketplace bm finance"
  ON public.marketplace_bm_finance
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_marketplace_bm_finance_updated_at
  BEFORE UPDATE ON public.marketplace_bm_finance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();