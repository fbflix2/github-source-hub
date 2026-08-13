CREATE TABLE public.supplier_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.supplier_batches(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'perfil',
  name text NOT NULL,
  identification text,
  identification_link text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  payout_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  reject_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  stock_item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL,
  sold_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_submissions_supplier ON public.supplier_submissions(supplier_id, status);
CREATE INDEX idx_supplier_submissions_status ON public.supplier_submissions(status);
CREATE INDEX idx_supplier_submissions_stock_item ON public.supplier_submissions(stock_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_submissions TO authenticated;
GRANT ALL ON public.supplier_submissions TO service_role;

ALTER TABLE public.supplier_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view supplier submissions"
ON public.supplier_submissions FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update supplier submissions"
ON public.supplier_submissions FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert supplier submissions"
ON public.supplier_submissions FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete supplier submissions"
ON public.supplier_submissions FOR DELETE TO authenticated
USING (public.is_staff(auth.uid()));

CREATE TRIGGER update_supplier_submissions_updated_at
BEFORE UPDATE ON public.supplier_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();