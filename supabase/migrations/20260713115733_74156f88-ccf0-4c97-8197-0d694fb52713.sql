ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS maintenance_swap_price numeric NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS maintenance_day_price numeric NOT NULL DEFAULT 0.50;

COMMENT ON COLUMN public.resellers.maintenance_swap_price IS 'Preço cobrado do saldo do revendedor por cada troca de IP no painel de Manutenção';
COMMENT ON COLUMN public.resellers.maintenance_day_price IS 'Preço cobrado do saldo do revendedor por cada dia extra adicionado a uma assinatura';