-- Adicionar colunas de controle de cobrança na tabela safe_bm_vaults
ALTER TABLE public.safe_bm_vaults 
ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_billing_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS grace_notifications JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'paid';

-- Inicializar next_billing_at para registros existentes
-- Definimos como protection_start + 1 mês
UPDATE public.safe_bm_vaults 
SET next_billing_at = COALESCE(protection_start, created_at) + INTERVAL '1 month'
WHERE next_billing_at IS NULL;

-- Adicionar índice para performance do cron
CREATE INDEX IF NOT EXISTS idx_safe_bm_vaults_next_billing ON public.safe_bm_vaults (next_billing_at) WHERE status = 'active';
