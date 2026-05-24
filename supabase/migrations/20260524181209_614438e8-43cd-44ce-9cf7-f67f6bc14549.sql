-- Update first item
UPDATE stock_items 
SET order_item_id = '78502208-b6ea-4c6a-9acb-e3c5005f93c1', status = 'vendido', updated_at = now() 
WHERE id = '5e744f28-860d-4ae5-bee3-677249a191ab';

UPDATE order_items 
SET delivery_data = (SELECT data || jsonb_build_object('linkPerfil', identification_link) FROM stock_items WHERE id = '5e744f28-860d-4ae5-bee3-677249a191ab')
WHERE id = '78502208-b6ea-4c6a-9acb-e3c5005f93c1';

-- Update second item
UPDATE stock_items 
SET order_item_id = 'dedf570a-8d87-4046-8f16-fffdda7a09af', status = 'vendido', updated_at = now() 
WHERE id = '67a48e03-2f21-4d53-a813-84bfbf3bab9f';

UPDATE order_items 
SET delivery_data = (SELECT data || jsonb_build_object('linkPerfil', identification_link) FROM stock_items WHERE id = '67a48e03-2f21-4d53-a813-84bfbf3bab9f')
WHERE id = 'dedf570a-8d87-4046-8f16-fffdda7a09af';

-- Update third item
UPDATE stock_items 
SET order_item_id = 'a5abadf1-a5c3-4109-897e-aaf0a8094a6c', status = 'vendido', updated_at = now() 
WHERE id = '219d31ef-b861-4440-a293-8335bfa9c45b';

UPDATE order_items 
SET delivery_data = (SELECT data || jsonb_build_object('linkPerfil', identification_link) FROM stock_items WHERE id = '219d31ef-b861-4440-a293-8335bfa9c45b')
WHERE id = 'a5abadf1-a5c3-4109-897e-aaf0a8094a6c';

-- Update product stock count
UPDATE products 
SET stock = (SELECT count(*) FROM stock_items WHERE product_id = '9dfefc59-2465-49e9-902d-2bac191b287d' AND status = 'revisado' AND order_item_id IS NULL AND deleted_at IS NULL)
WHERE id = '9dfefc59-2465-49e9-902d-2bac191b287d';