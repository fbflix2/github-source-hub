ALTER TABLE public.supplier_batches
  ADD COLUMN IF NOT EXISTS reviewed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;
CREATE INDEX IF NOT EXISTS idx_supplier_batches_reviewed ON public.supplier_batches(reviewed);