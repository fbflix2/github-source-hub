ALTER TABLE public.openpix_withdrawals
  ADD COLUMN IF NOT EXISTS confirmation_code_hash text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

UPDATE public.openpix_withdrawals
SET confirmation_code = NULL
WHERE confirmation_code IS NOT NULL;

REVOKE ALL ON public.openpix_withdrawals FROM anon, authenticated;

GRANT SELECT (
  id,
  requested_by,
  amount,
  pix_key,
  pix_key_type,
  pix_key_name,
  description,
  expires_at,
  status,
  openpix_transaction_id,
  error_message,
  created_at,
  confirmed_at,
  executed_at
) ON public.openpix_withdrawals TO authenticated;

GRANT ALL ON public.openpix_withdrawals TO service_role;