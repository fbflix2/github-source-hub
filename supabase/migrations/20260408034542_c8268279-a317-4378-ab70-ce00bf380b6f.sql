
-- Fix last distribution: move R$565.36 from Operacional to personal caixas

-- 1. Reduce Operacional saldo by 565.36
UPDATE fb_finance_caixas SET saldo_atual = saldo_atual - 565.36 WHERE id = '7e3e2f89-c70e-4381-81ae-5746037422ca';

-- 2. Update the Operacional lancamento to reduce by 565.36
UPDATE fb_finance_lancamentos SET entrada = entrada - 565.36 WHERE id = 'f31288fe-cbee-4e18-9393-1e343e892acc';

-- 3. Distribute 565.36 to personal caixas using personal percentages (total 100%)
-- Conta Corrente Pessoal 5% = 28.268
UPDATE fb_finance_caixas SET saldo_atual = saldo_atual + 28.268 WHERE id = '6916c634-a7fb-4282-ba73-b5a72817714c';
-- Dia a Dia/Emergências 10% = 56.536
UPDATE fb_finance_caixas SET saldo_atual = saldo_atual + 56.536 WHERE id = 'b0efbf91-a92f-4aae-b19b-6e472ebcfea2';
-- Entrada Compra Casa 20% = 113.072
UPDATE fb_finance_caixas SET saldo_atual = saldo_atual + 113.072 WHERE id = '83b7039f-b552-49da-949e-c55535b6c035';
-- Estilo de Vida 30% = 169.608
UPDATE fb_finance_caixas SET saldo_atual = saldo_atual + 169.608 WHERE id = '981090d7-a8cc-4ad0-9a29-1d57fd9a91fc';
-- Fundo Emergência 15% = 84.804
UPDATE fb_finance_caixas SET saldo_atual = saldo_atual + 84.804 WHERE id = 'b9851856-af60-4104-8756-bb3b5dfacfc2';
-- Janela Oportunidade 20% = 113.072
UPDATE fb_finance_caixas SET saldo_atual = saldo_atual + 113.072 WHERE id = '4dc008ba-7cbd-4fb9-9d9d-bf633f55af49';

-- 4. Create lancamentos for personal allocations
INSERT INTO fb_finance_lancamentos (data, entrada, saida, categoria, descricao, tipo, caixa_destino_id) VALUES
('2026-04-08', 28.268, 0, 'Distribuição PJ', 'Excedente Pro Labore → Conta Corrente Pessoal (5%)', 'pessoal', '6916c634-a7fb-4282-ba73-b5a72817714c'),
('2026-04-08', 56.536, 0, 'Distribuição PJ', 'Excedente Pro Labore → Dia a Dia/Emergências (10%)', 'empresa', 'b0efbf91-a92f-4aae-b19b-6e472ebcfea2'),
('2026-04-08', 113.072, 0, 'Distribuição PJ', 'Excedente Pro Labore → Entrada compra casa (20%)', 'pessoal', '83b7039f-b552-49da-949e-c55535b6c035'),
('2026-04-08', 169.608, 0, 'Distribuição PJ', 'Excedente Pro Labore → Estilo de Vida (30%)', 'pessoal', '981090d7-a8cc-4ad0-9a29-1d57fd9a91fc'),
('2026-04-08', 84.804, 0, 'Distribuição PJ', 'Excedente Pro Labore → Fundo Emergência (15%)', 'pessoal', 'b9851856-af60-4104-8756-bb3b5dfacfc2'),
('2026-04-08', 113.072, 0, 'Distribuição PJ', 'Excedente Pro Labore → Janela Oportunidade (20%)', 'pessoal', '4dc008ba-7cbd-4fb9-9d9d-bf633f55af49');

-- 5. Update the distribuicao record to reflect corrected values
UPDATE fb_finance_distribuicoes 
SET valores_alocados = jsonb_set(
  valores_alocados::jsonb, 
  '{operacional}', 
  to_jsonb((valores_alocados::jsonb->>'operacional')::numeric - 565.36)
)
WHERE id = '19817a1c-b007-4fd3-afe1-6e599e5006c0';
