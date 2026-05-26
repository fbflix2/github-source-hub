-- Conclusion of order ORD-MPMXOC4E for user Nick Paulo (20a4bc36-bcd4-477d-89f5-b347b678417c)

-- 1. Update item prices to fixed R$2.00
UPDATE public.order_items 
SET price = 2.00 
WHERE order_id = (SELECT id FROM orders WHERE code = 'ORD-MPMXOC4E');

-- 2. Update order total (22 units * 2.00 = 44.00)
UPDATE public.orders 
SET subtotal = 44.00, total = 44.00, status = 'completed', payment_method = 'saldo'
WHERE code = 'ORD-MPMXOC4E';

-- 3. Create Wallet Transaction
INSERT INTO public.wallet_transactions (user_id, type, title, amount, balance_after, reference_id)
VALUES (
    '20a4bc36-bcd4-477d-89f5-b347b678417c', 
    'purchase', 
    'Compra #ORD-MPMXOC4E', 
    -44.00, 
    32.00, -- 76.00 (current) - 44.00
    (SELECT id FROM orders WHERE code = 'ORD-MPMXOC4E')
);

-- 4. Update Profile Balance
UPDATE public.profiles SET balance = 32.00 WHERE user_id = '20a4bc36-bcd4-477d-89f5-b347b678417c';

-- 5. Provision the 22 new subscriptions (21 IPv6 + 1 Web Scraping)
-- We'll use a loop-like structure for the 21 units of IPv6
INSERT INTO public.subscriptions (user_id, product_id, name, status, type, start_date, end_date, raw_data, auto_renew)
SELECT 
    '20a4bc36-bcd4-477d-89f5-b347b678417c', 
    '2c6f6e5f-699c-43cb-a759-eecff70da854', -- Ultra IPv6
    'WS-BATCH-' || i, 
    'active', 
    'proxyfbflix', 
    now(), 
    now() + interval '30 days', 
    '{"provider": "proxyfbflix", "country_code": "BR", "city_name": "Sao Paulo", "exchange_quota_free": 2, "exchange_quota_pay": 0}', 
    false
FROM generate_series(1, 21) AS i;

-- Add the 1 Web Scraping unit
INSERT INTO public.subscriptions (user_id, product_id, name, status, type, start_date, end_date, raw_data, auto_renew)
VALUES (
    '20a4bc36-bcd4-477d-89f5-b347b678417c', 
    'e22acc24-d124-4cad-9b65-1095021d471f', -- Web Scraping
    'WS-BATCH-22', 
    'active', 
    'proxyfbflix', 
    now(), 
    now() + interval '30 days', 
    '{"provider": "proxyfbflix", "country_code": "BR", "city_name": "Sao Paulo", "exchange_quota_free": 2, "exchange_quota_pay": 0}', 
    false
);
