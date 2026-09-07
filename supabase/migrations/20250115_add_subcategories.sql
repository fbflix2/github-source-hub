-- Add subcategory support: parent_id on product_categories, subcategory_id on products
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES product_categories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES product_categories(id) ON DELETE SET NULL;
