-- Refund Mateus Cardozo (8e6b188a-8084-4419-a56a-9bd82c8e92cc)
UPDATE public.profiles SET balance = balance + 58.00 WHERE user_id = '8e6b188a-8084-4419-a56a-9bd82c8e92cc';
INSERT INTO public.wallet_transactions (user_id, type, title, amount, balance_after, reference_id)
SELECT '8e6b188a-8084-4419-a56a-9bd82c8e92cc', 'deposit', 'Estorno — Diferença valor renovação proxy (2 unidades)', 58.00, balance, 'REFUND-MATEUS-RENEWAL'
FROM public.profiles WHERE user_id = '8e6b188a-8084-4419-a56a-9bd82c8e92cc';

-- Refund User 81aa3211-e20f-4181-bd9f-df7edb3d15f6
UPDATE public.profiles SET balance = balance + 29.00 WHERE user_id = '81aa3211-e20f-4181-bd9f-df7edb3d15f6';
INSERT INTO public.wallet_transactions (user_id, type, title, amount, balance_after, reference_id)
SELECT '81aa3211-e20f-4181-bd9f-df7edb3d15f6', 'deposit', 'Estorno — Diferença valor renovação proxy', 29.00, balance, 'REFUND-81AA-RENEWAL'
FROM public.profiles WHERE user_id = '81aa3211-e20f-4181-bd9f-df7edb3d15f6';