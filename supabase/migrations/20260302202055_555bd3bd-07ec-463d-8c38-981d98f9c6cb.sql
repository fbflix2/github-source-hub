
-- Fulfill Davi's order manually (webhook was broken when he paid)
-- 1. Run the atomic fulfillment function for the order item
SELECT public.fulfill_order_item(
  '915bf565-4a45-4c38-90e1-5ee8be773e97'::uuid,
  '79152efa-04f3-469b-955a-6e00b827dcca'::uuid
);

-- 2. Mark payment as completed
UPDATE payments
SET status = 'completed',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"manual_fulfillment": true, "reason": "webhook was broken during payment"}'::jsonb
WHERE id = '8b5ccd73-eacb-4bde-906b-2524def1caae'
  AND status != 'completed';

-- 3. Mark order as completed
UPDATE orders
SET status = 'completed'
WHERE id = '9cfc0da9-f034-4c46-9e9d-b7364d4be7d5';

-- 4. Record wallet transaction for PIX payment
INSERT INTO wallet_transactions (user_id, type, title, amount, reference_id)
VALUES (
  'd0f157c9-37d3-4f15-99a7-0185ff09ed86',
  'debit',
  'Compra via PIX — ORD-MM9LXROF',
  85.00,
  '8b5ccd73-eacb-4bde-906b-2524def1caae'
);
