-- Link a valid stock item to the order item
UPDATE public.stock_items 
SET status = 'vendido', 
    order_item_id = '95c8bd08-feeb-46bf-b963-5fe3e0e0ec13' 
WHERE id = '813c437d-0994-4c1c-8ced-cd120d69fe48';

-- Update the order item with delivery information
UPDATE public.order_items 
SET delivery_data = jsonb_build_object(
    'fulfilled', true,
    'linkPerfil', 'https://business.facebook.com/invitation/?token=AflFCUMPXm7ao8vPmnzMlO4_ecDTLUVrlt_lF_zOqEW5nTYoOQke6ORW_HtrbUPzDO8qnnUvaaSRPntAlrBSDeNbbK56oLrfpNKbxAPBl6q3VJ8nUv6xsUoGvgx4d7z2sFR0khL7ryZguR0-wWPy7cjFd2VFJjh1YemF2weR7dBOtffDN41_-A9BVt_4PGpL-PAjqxTLfRZqORWaB_a4nruUxfkfzJ7Luc42uA5hYV450Tzd2e3JyvCjpAlgq3HYeRyETFd8hFw4m0ZI7H3qIdtgAOV6r6F5bg',
    'type', 'bm',
    'count', 1
)
WHERE id = '95c8bd08-feeb-46bf-b963-5fe3e0e0ec13';

-- Set the order status to completed
UPDATE public.orders 
SET status = 'completed', 
    updated_at = now() 
WHERE id = '51c5847a-49e2-46f5-b8c9-4968ae3cdfdb';

-- Sync the product stock count
UPDATE public.products 
SET stock = (
    SELECT count(*) 
    FROM public.stock_items 
    WHERE product_id = '9dfefc59-2465-49e9-902d-2bac191b287d' 
      AND status = 'revisado' 
      AND order_item_id IS NULL
)
WHERE id = '9dfefc59-2465-49e9-902d-2bac191b287d';