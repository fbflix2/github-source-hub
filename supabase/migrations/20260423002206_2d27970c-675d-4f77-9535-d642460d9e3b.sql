-- Create Safe BM category if not exists
INSERT INTO public.product_categories (name, slug)
VALUES ('Safe BM', 'safe-bm')
ON CONFLICT DO NOTHING;

-- Get the ID of the new category
DO $$
DECLARE
    new_cat_id UUID;
    prod_id UUID := 'e5118c63-ed52-4f4e-8983-f44c1ba0d17b';
BEGIN
    SELECT id INTO new_cat_id FROM public.product_categories WHERE slug = 'safe-bm';
    
    -- Update the product
    UPDATE public.products 
    SET price = 9.99, category_id = new_cat_id
    WHERE id = prod_id;

    -- Update order items that were sold at the wrong price
    UPDATE public.order_items
    SET price = 9.99
    WHERE product_id = prod_id AND price < 9.00; -- Using < 9.00 to capture the 3.33 values

    -- Update order totals for those orders
    -- This is a bit complex as an order can have multiple items, 
    -- but we can recalculate the sum of its items.
    UPDATE public.orders o
    SET total = (
        SELECT SUM(price * quantity)
        FROM public.order_items
        WHERE order_id = o.id
    )
    WHERE id IN (
        SELECT DISTINCT order_id 
        FROM public.order_items 
        WHERE product_id = prod_id
    );
END $$;
