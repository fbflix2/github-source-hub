-- Adiciona coluna subcategory_id à tabela products
-- Resolve erro: "Could not find the 'subcategory_id' column of 'products' in the schema cache"

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_subcategory_id
  ON public.products(subcategory_id);

NOTIFY pgrst, 'reload schema';
