-- Reset Marcelo's BM status
UPDATE public.safe_bm_vaults 
SET status = 'pending'
WHERE id = '7ea32c4f-de37-4f64-930e-31f89fd3dafc';

-- Add balance to Cindy (who is trying to renew the proxy)
UPDATE public.profiles 
SET balance = balance + 50
WHERE user_id = '1f70fb84-6a94-4a0d-9f20-da3d469ab618';

-- Log the transaction
INSERT INTO public.wallet_transactions (user_id, type, title, amount, balance_after)
SELECT 
    '1f70fb84-6a94-4a0d-9f20-da3d469ab618', 
    'credit', 
    'Bônus para renovação de proxy (Correção Marcelo BM)', 
    50,
    balance
FROM public.profiles
WHERE user_id = '1f70fb84-6a94-4a0d-9f20-da3d469ab618';