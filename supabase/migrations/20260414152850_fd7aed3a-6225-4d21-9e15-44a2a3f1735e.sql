-- Remove the incorrect Pro Labore lancamento from 2026-04-11
DELETE FROM fb_finance_lancamentos WHERE id = 'b570ee6a-2e7c-465d-a973-665d8e521699';

-- Subtract R$ 14.70 from Pro Labore balance
UPDATE fb_finance_caixas SET saldo_atual = saldo_atual - 14.70 WHERE id = '65edfdc1-4db5-4d25-bcd8-cc4ebe35f703';

-- Update the distribuicao record to set pro_labore to 0
UPDATE fb_finance_distribuicoes 
SET valores_alocados = jsonb_set(valores_alocados::jsonb, '{pro_labore}', '0')
WHERE id = '4032f027-c6a3-4c49-959f-e022395179a1';