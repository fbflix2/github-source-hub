
CREATE TABLE public.openpix_saved_pix_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pix_key text NOT NULL,
  pix_key_type text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.openpix_saved_pix_keys TO authenticated;
GRANT ALL ON public.openpix_saved_pix_keys TO service_role;
ALTER TABLE public.openpix_saved_pix_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage saved pix keys" ON public.openpix_saved_pix_keys
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.openpix_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  amount numeric NOT NULL,
  pix_key text NOT NULL,
  pix_key_type text NOT NULL,
  pix_key_name text,
  description text,
  confirmation_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  openpix_transaction_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  executed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.openpix_withdrawals TO authenticated;
GRANT ALL ON public.openpix_withdrawals TO service_role;
ALTER TABLE public.openpix_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage withdrawals" ON public.openpix_withdrawals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
