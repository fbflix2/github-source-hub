-- Adiciona suporte a subcategorias de produtos
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES product_categories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES product_categories(id) ON DELETE SET NULL;
