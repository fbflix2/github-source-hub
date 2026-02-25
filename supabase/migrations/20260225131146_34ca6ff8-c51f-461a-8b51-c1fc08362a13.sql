
-- Credit the missed R$ 2.10 payment for user 448f4563-dd6a-44ea-9238-3c668ba6ea15
-- First update the balance
UPDATE profiles 
SET balance = balance + 2.10 
WHERE user_id = '448f4563-dd6a-44ea-9238-3c668ba6ea15';

-- Insert the wallet transaction record
INSERT INTO wallet_transactions (user_id, type, title, amount, balance_after, reference_id)
SELECT 
  '448f4563-dd6a-44ea-9238-3c668ba6ea15',
  'deposit',
  'Recarga via PIX (correção manual)',
  2.10,
  p.balance,
  '6f32de42'
FROM profiles p 
WHERE p.user_id = '448f4563-dd6a-44ea-9238-3c668ba6ea15';
