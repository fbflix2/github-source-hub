-- Reposição retroativa: transfere R$ 1.400 do Operacional para Capital de Giro e zera a dívida
INSERT INTO public.fb_finance_lancamentos (data, entrada, saida, categoria, descricao, tipo, caixa_destino_id)
VALUES (CURRENT_DATE, 0, 1400, 'Transferência', 'Reposição retroativa Capital de Giro (saída Operacional)', 'empresa', '7e3e2f89-c70e-4381-81ae-5746037422ca');

INSERT INTO public.fb_finance_lancamentos (data, entrada, saida, categoria, descricao, tipo, caixa_destino_id)
VALUES (CURRENT_DATE, 1400, 0, 'Transferência', 'Reposição retroativa Capital de Giro (entrada)', 'empresa', 'e849a5f7-cbf8-468a-8e0d-bf8d822f6cc7');

UPDATE public.fb_finance_caixas SET saldo_atual = saldo_atual - 1400 WHERE id = '7e3e2f89-c70e-4381-81ae-5746037422ca';
UPDATE public.fb_finance_caixas SET saldo_atual = saldo_atual + 1400 WHERE id = 'e849a5f7-cbf8-468a-8e0d-bf8d822f6cc7';

UPDATE public.fb_finance_config SET capital_giro_debt = 0;