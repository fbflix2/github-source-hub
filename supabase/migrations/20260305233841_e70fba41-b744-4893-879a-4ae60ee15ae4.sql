-- Move BM 7295 to product "BM 3 (Antiga)" (9dfefc59)
UPDATE stock_items 
SET product_id = '9dfefc59-2465-49e9-902d-2bac191b287d'
WHERE id = '3c7b6252-8da1-4d17-813e-b47643a6cb21';

-- Update bm_tracking for this item too
UPDATE bm_tracking 
SET product_name = 'BM 3 (Antiga)'
WHERE stock_item_id = '3c7b6252-8da1-4d17-813e-b47643a6cb21';

-- Clean up all references to duplicate product
UPDATE stock_items SET product_id = NULL WHERE product_id = '10af1bf0-d2af-4a8b-a60f-5060503ba27e' AND id != '3c7b6252-8da1-4d17-813e-b47643a6cb21';
UPDATE order_items SET product_id = NULL WHERE product_id = '10af1bf0-d2af-4a8b-a60f-5060503ba27e';
UPDATE subscriptions SET product_id = NULL WHERE product_id = '10af1bf0-d2af-4a8b-a60f-5060503ba27e';
UPDATE coupons SET product_id = NULL WHERE product_id = '10af1bf0-d2af-4a8b-a60f-5060503ba27e';
UPDATE product_exchanges SET original_product_id = '9dfefc59-2465-49e9-902d-2bac191b287d' WHERE original_product_id = '10af1bf0-d2af-4a8b-a60f-5060503ba27e';
UPDATE product_exchanges SET new_product_id = '9dfefc59-2465-49e9-902d-2bac191b287d' WHERE new_product_id = '10af1bf0-d2af-4a8b-a60f-5060503ba27e';
UPDATE product_waitlist SET product_id = '9dfefc59-2465-49e9-902d-2bac191b287d' WHERE product_id = '10af1bf0-d2af-4a8b-a60f-5060503ba27e';

-- Delete duplicate product "BM 3. Antiga"
DELETE FROM products WHERE id = '10af1bf0-d2af-4a8b-a60f-5060503ba27e';