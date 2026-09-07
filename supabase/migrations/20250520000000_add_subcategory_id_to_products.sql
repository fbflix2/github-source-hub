-- Adiciona coluna subcategory_id na tabela products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;

-- Índice para performance do filtro/exibição por subcategoria
CREATE INDEX IF NOT EXISTS idx_products_subcategory_id ON public.products(subcategory_id);
