-- Add 58.00 to Cledoir's balance
UPDATE public.profiles 
SET balance = balance + 58.00 
WHERE user_id = '02969eb6-bd47-4f21-88ac-46acdb6bf92b';

-- Insert transaction record
INSERT INTO public.wallet_transactions (user_id, type, title, amount, balance_after, reference_id)
SELECT 
  '02969eb6-bd47-4f21-88ac-46acdb6bf92b', 
  'deposit', 
  'Estorno — Diferença valor renovação proxy (2 unidades)', 
  58.00, 
  balance, 
  'REFUND-CLEDOIR-RENEWAL' 
FROM public.profiles 
WHERE user_id = '02969eb6-bd47-4f21-88ac-46acdb6bf92b';