ALTER TABLE public.supplier_batches ADD COLUMN type TEXT DEFAULT 'purchase';
ALTER TABLE public.supplier_accounts ADD COLUMN is_replacement BOOLEAN DEFAULT false;

-- Update existing batches to 'purchase' type just in case
UPDATE public.supplier_batches SET type = 'purchase' WHERE type IS NULL;
