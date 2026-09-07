-- Suporte a subcategorias: categorias podem ter uma categoria pai,
-- e produtos podem ter uma subcategoria além da categoria principal.

ALTER TABLE product_categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES product_categories(id) ON DELETE SET NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES product_categories(id) ON DELETE SET NULL;
