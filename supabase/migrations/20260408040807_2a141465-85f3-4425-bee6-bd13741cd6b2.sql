
-- Fix: Restore R$ 565.36 to Operacional (was wrongly subtracted in previous migration)
-- The surplus came from the unallocated Pro Labore share, NOT from Operacional
UPDATE fb_finance_caixas
SET saldo_atual = saldo_atual + 565.36
WHERE id = '7e3e2f89-c70e-4381-81ae-5746037422ca'; -- Operacional

-- Update the distribution record to include personal box allocations
UPDATE fb_finance_distribuicoes
SET valores_alocados = jsonb_build_object(
  'dividendos', 32.3064,
  'pro_labore', 0,
  'operacional', 807.661999999999,
  'capital_giro', 48.459599999999995,
  'fundos_reserva', 161.532,
  'conta_corrente_pessoal', 28.268,
  'fundo_emergencia', 84.804,
  'estilo_vida', 169.608,
  'entrada_casa', 113.072,
  'dia_a_dia_emergencias', 56.536,
  'janela_oportunidade', 113.072
)
WHERE id = '19817a1c-b007-4fd3-afe1-6e599e5006c0';
