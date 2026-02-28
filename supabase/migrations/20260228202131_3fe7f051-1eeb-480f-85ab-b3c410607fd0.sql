-- Create retroactive order for Radir's renewal that was missing
WITH new_order AS (
  INSERT INTO orders (user_id, code, subtotal, discount, total, status, payment_method, created_at)
  VALUES (
    '2d811ea5-ed52-4b62-ad1c-9757653817f3',
    'REN-2511284139-RETRO',
    25.00, 0, 25.00, 'completed', 'saldo',
    '2026-02-28T18:33:23+00'
  )
  RETURNING id
)
INSERT INTO order_items (order_id, name, price, quantity, delivery_data)
SELECT id, 'Renovação - PROXY ULTRA IPV6 SOCKS5 BRASIL', 25.00, 1, 
  '{"subscription_code": "2511284139", "type": "proxy_renewal"}'::jsonb
FROM new_order;