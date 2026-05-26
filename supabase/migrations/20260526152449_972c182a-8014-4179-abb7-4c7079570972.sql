ALTER TABLE public.product_categories ADD COLUMN IF NOT EXISTS restricted_to TEXT[];

-- Ensure the column is accessible
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
