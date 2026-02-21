-- Link stock_item to order_item and mark as sold
UPDATE public.stock_items 
SET order_item_id = 'f51fe7ba-1b5a-4128-8aec-e1c163edb948', 
    status = 'vendido',
    product_id = 'f3cb1cba-e134-40db-b4c9-e093a7a322a9'
WHERE id = '59b05dc9-92ca-4bc9-b63d-bf3933afa99b';

-- Copy delivery_data from stock_item to order_item
UPDATE public.order_items 
SET delivery_data = (SELECT data FROM public.stock_items WHERE id = '59b05dc9-92ca-4bc9-b63d-bf3933afa99b')
WHERE id = 'f51fe7ba-1b5a-4128-8aec-e1c163edb948';

-- Set product stock to 0 and available to false (item was sold)
UPDATE public.products 
SET stock = 0, available = false 
WHERE id = 'f3cb1cba-e134-40db-b4c9-e093a7a322a9';
