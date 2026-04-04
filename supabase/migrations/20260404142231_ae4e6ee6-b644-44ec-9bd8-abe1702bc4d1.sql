INSERT INTO public.fb_finance_caixas (nome, tipo, saldo_atual, alvo_percent, meta)
SELECT 'Pro Labore', 'empresa', 0, 10, 0
WHERE NOT EXISTS (SELECT 1 FROM public.fb_finance_caixas WHERE nome = 'Pro Labore');