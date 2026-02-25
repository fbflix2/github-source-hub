
UPDATE profiles 
SET balance = balance + 2.00 
WHERE user_id = '448f4563-dd6a-44ea-9238-3c668ba6ea15';

INSERT INTO wallet_transactions (user_id, type, title, amount, balance_after, reference_id)
SELECT 
  '448f4563-dd6a-44ea-9238-3c668ba6ea15',
  'deposit',
  'Recarga via PIX (correção manual)',
  2.00,
  p.balance,
  'correcao-manual-2reais'
FROM profiles p 
WHERE p.user_id = '448f4563-dd6a-44ea-9238-3c668ba6ea15';
