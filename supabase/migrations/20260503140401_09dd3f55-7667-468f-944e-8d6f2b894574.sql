
ALTER TABLE public.supplier_accounts ADD COLUMN IF NOT EXISTS password text;
ALTER TABLE public.supplier_accounts ADD COLUMN IF NOT EXISTS email_password text;

CREATE OR REPLACE FUNCTION public.supplier_accounts_encrypt_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text := public._supplier_enc_key();
BEGIN
  IF NEW.password IS NOT NULL AND NEW.password <> '' THEN
    NEW.password_enc := extensions.pgp_sym_encrypt(NEW.password, k);
    NEW.password := NULL;
  END IF;
  IF NEW.email_password IS NOT NULL AND NEW.email_password <> '' THEN
    NEW.email_password_enc := extensions.pgp_sym_encrypt(NEW.email_password, k);
    NEW.email_password := NULL;
  END IF;
  RETURN NEW;
END;
$$;
