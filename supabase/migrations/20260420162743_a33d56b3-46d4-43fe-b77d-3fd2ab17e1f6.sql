
-- 1) FIX SUBSCRIPTION TYPE
UPDATE public.subscriptions
SET type = 'webshare', updated_at = now()
WHERE id = '6da54d54-b12d-4f62-b5b0-17770582621e'
  AND raw_data->>'webshare_proxy_id' IS NOT NULL;

UPDATE public.subscriptions
SET type = 'webshare', updated_at = now()
WHERE type = 'proxybr'
  AND raw_data->>'webshare_proxy_id' IS NOT NULL;

-- 2) site_settings lockdown
DROP POLICY IF EXISTS "Anyone can view settings" ON public.site_settings;

CREATE POLICY "Public can read whitelisted settings"
ON public.site_settings
FOR SELECT
USING (
  key IN (
    'site_config','hidden_nav_links','tutorial_categories',
    'termos_uso','termos_uso_updated','client_warming_track_config',
    'warming_ready_criteria','imageviewer_base_template_url',
    'imageviewer_positions','doc_identidade_template_url'
  )
  OR key LIKE 'operator_display_name_%'
  OR key LIKE 'operator_cover_%'
);

CREATE POLICY "Authenticated can read app settings"
ON public.site_settings
FOR SELECT
TO authenticated
USING (
  key NOT IN (
    'monthly_goals','fixed_cost_allocation','credentials_job',
    'sync_progress','sync_result','proxybr_reseller_discounts',
    'fbx_p2p_fee','fbx_purchase_discount','fbx_recharge_fee',
    'warming_commission_rate'
  )
  AND key NOT LIKE 'warming_quality_%'
  AND key NOT LIKE 'warming_notes_%'
);

-- 3) ss_transactions: split policies
DROP POLICY IF EXISTS "Users can view own transactions" ON public.ss_transactions;

CREATE POLICY "Buyers and staff view full transaction"
ON public.ss_transactions
FOR SELECT
TO authenticated
USING (buyer_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "Sellers view own transactions metadata"
ON public.ss_transactions
FOR SELECT
TO authenticated
USING (seller_id = auth.uid() AND buyer_id <> auth.uid());

CREATE OR REPLACE VIEW public.ss_transactions_safe
WITH (security_invoker = true) AS
SELECT
  id, listing_id, buyer_id, seller_id, amount, platform_fee, fee_rate,
  status, validation_checklist, validated_by, validated_at,
  delivered_at, confirmed_at, disputed_at, dispute_reason, dispute_resolution,
  notes, created_at, updated_at
FROM public.ss_transactions;

GRANT SELECT ON public.ss_transactions_safe TO authenticated;

-- 4) supplier_accounts encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.supplier_accounts
  ADD COLUMN IF NOT EXISTS password_enc bytea,
  ADD COLUMN IF NOT EXISTS email_password_enc bytea;

CREATE OR REPLACE FUNCTION public._supplier_enc_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('app.supplier_encryption_key', true),
    'fbflix-supplier-default-key-rotate-me-please-2026'
  );
$$;

CREATE OR REPLACE FUNCTION public.supplier_accounts_encrypt_trigger()
RETURNS TRIGGER
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

DROP TRIGGER IF EXISTS supplier_accounts_encrypt ON public.supplier_accounts;
CREATE TRIGGER supplier_accounts_encrypt
BEFORE INSERT OR UPDATE ON public.supplier_accounts
FOR EACH ROW
EXECUTE FUNCTION public.supplier_accounts_encrypt_trigger();

UPDATE public.supplier_accounts
SET password_enc = extensions.pgp_sym_encrypt(password, public._supplier_enc_key()),
    password = NULL
WHERE password IS NOT NULL AND password <> '' AND password_enc IS NULL;

UPDATE public.supplier_accounts
SET email_password_enc = extensions.pgp_sym_encrypt(email_password, public._supplier_enc_key()),
    email_password = NULL
WHERE email_password IS NOT NULL AND email_password <> '' AND email_password_enc IS NULL;

CREATE OR REPLACE FUNCTION public.get_supplier_account_credentials(_account_id uuid)
RETURNS TABLE(password text, email_password text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    CASE WHEN sa.password_enc IS NOT NULL
      THEN extensions.pgp_sym_decrypt(sa.password_enc, public._supplier_enc_key())
      ELSE sa.password END,
    CASE WHEN sa.email_password_enc IS NOT NULL
      THEN extensions.pgp_sym_decrypt(sa.email_password_enc, public._supplier_enc_key())
      ELSE sa.email_password END
  FROM public.supplier_accounts sa
  WHERE sa.id = _account_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_supplier_account_credentials(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_account_credentials(uuid) TO authenticated;
