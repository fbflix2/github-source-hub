-- Registrar a movimentação do pedido ORD-MM7MPBVI da Carolina (PIX R$21,00 para compra de proxy)
INSERT INTO wallet_transactions (user_id, type, amount, title, reference_id, balance_after)
VALUES (
  'df73991b-410b-474b-a892-43c603cfc373',
  'debit',
  -21.00,
  'Compra Proxy - ORD-MM7MPBVI (PIX)',
  (SELECT id FROM orders WHERE code = 'ORD-MM7MPBVI' LIMIT 1),
  0
);