-- Update user balance
UPDATE public.profiles
SET balance = balance + 58.00
WHERE user_id = '8e6b188a-8084-4419-a56a-9bd82c8e92cc';

-- Insert refund transaction
INSERT INTO public.wallet_transactions (user_id, type, title, amount, balance_after)
VALUES (
  '8e6b188a-8084-4419-a56a-9bd82c8e92cc',
  'refund',
  'Estorno: Diferença Renovação Proxy (Correção de Valor)',
  58.00,
  (SELECT balance FROM public.profiles WHERE user_id = '8e6b188a-8084-4419-a56a-9bd82c8e92cc')
);