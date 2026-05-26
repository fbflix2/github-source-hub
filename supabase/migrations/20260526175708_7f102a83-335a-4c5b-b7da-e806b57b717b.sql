-- Refund excess charges for user Nick Paulo (20a4bc36-bcd4-477d-89f5-b347b678417c)
-- The user was charged R$21.00 for 'PROXY| IPV4 Contigência Fb' (6c396fa8-f6a0-43b2-8061-9148213df549)
-- instead of the fixed price of R$2.00 in 4 orders.

-- 1. Update order items to the correct price
UPDATE public.order_items 
SET price = 2.00 
WHERE order_id IN (
    '3a01f069-e942-4ea5-8c52-d9b3eb0c6e86', -- ORD-MPMXHM66
    'c54dc1e6-4a2b-44b1-9bc0-09b1b47147ea', -- ORD-MPMXKMWM
    '5eeba8ef-7669-40c2-9ba9-d7b7cf28cab7', -- ORD-MPMXLOHO
    'bccba5be-99d5-47a9-8ab1-568477c76ca0'  -- ORD-MPMXN3UJ
) AND product_id = '6c396fa8-f6a0-43b2-8061-9148213df549';

-- 2. Update order totals (2.00 for IPv6 + 2.00 for IPv4 = 4.00)
UPDATE public.orders 
SET subtotal = 4.00, total = 4.00 
WHERE id IN (
    '3a01f069-e942-4ea5-8c52-d9b3eb0c6e86',
    'c54dc1e6-4a2b-44b1-9bc0-09b1b47147ea',
    '5eeba8ef-7669-40c2-9ba9-d7b7cf28cab7',
    'bccba5be-99d5-47a9-8ab1-568477c76ca0'
);

-- 3. Correct wallet transactions and balance_after (cumulative correction)
-- Order 1: Charged 23, should be 4. Refund 19.
UPDATE public.wallet_transactions SET amount = -4.00, balance_after = balance_after + 19.00 WHERE reference_id = '3a01f069-e942-4ea5-8c52-d9b3eb0c6e86';
-- Order 2: Refund 19 + previous 19 = 38.
UPDATE public.wallet_transactions SET amount = -4.00, balance_after = balance_after + 38.00 WHERE reference_id = 'c54dc1e6-4a2b-44b1-9bc0-09b1b47147ea';
-- Order 3: Refund 19 + previous 38 = 57.
UPDATE public.wallet_transactions SET amount = -4.00, balance_after = balance_after + 57.00 WHERE reference_id = '5eeba8ef-7669-40c2-9ba9-d7b7cf28cab7';
-- Order 4: Refund 19 + previous 57 = 76.
UPDATE public.wallet_transactions SET amount = -4.00, balance_after = balance_after + 76.00 WHERE reference_id = 'bccba5be-99d5-47a9-8ab1-568477c76ca0';
-- Final refund: 19 * 4 = 76.
UPDATE public.wallet_transactions SET balance_after = balance_after + 76.00 WHERE created_at > (SELECT created_at FROM wallet_transactions WHERE reference_id = 'bccba5be-99d5-47a9-8ab1-568477c76ca0');

-- 4. Refund to profile balance
UPDATE public.profiles SET balance = balance + 76.00 WHERE user_id = '20a4bc36-bcd4-477d-89f5-b347b678417c';
