
ALTER TABLE public.ct_clients
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_payment_id uuid,
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ct_clients_status_next_billing
  ON public.ct_clients (status, next_billing);

CREATE INDEX IF NOT EXISTS idx_ct_clients_trial_ends
  ON public.ct_clients (trial_ends_at)
  WHERE status = 'trial';
