
-- Reverter bônus indevido de R$50 e creditar refund de R$29 (cobrança a mais na renovação)
-- Saldo final: R$21 - R$50 (estorno bônus) + R$29 (refund overcharge) = R$0

UPDATE public.profiles
SET balance = 0
WHERE user_id = '1f70fb84-6a94-4a0d-9f20-da3d469ab618';

INSERT INTO public.wallet_transactions (user_id, type, title, amount, balance_after)
VALUES 
  ('1f70fb84-6a94-4a0d-9f20-da3d469ab618', 'debit', 'Estorno: bônus indevido lançado por engano', -50, -29),
  ('1f70fb84-6a94-4a0d-9f20-da3d469ab618', 'credit', 'Reembolso: cobrança a mais na renovação do proxy (R$50 cobrado, valor correto R$21)', 29, 0);
