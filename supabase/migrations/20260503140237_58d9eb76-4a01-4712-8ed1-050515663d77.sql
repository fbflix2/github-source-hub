
-- 1. supplier_accounts: admin-only, drop plaintext columns
DROP POLICY IF EXISTS "Staff can manage supplier_accounts" ON public.supplier_accounts;
CREATE POLICY "Admins can manage supplier_accounts"
  ON public.supplier_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.supplier_accounts DROP COLUMN IF EXISTS password;
ALTER TABLE public.supplier_accounts DROP COLUMN IF EXISTS email_password;

CREATE OR REPLACE FUNCTION public.supplier_accounts_encrypt_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_supplier_account_credentials(_account_id uuid)
RETURNS TABLE(password text, email_password text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    CASE WHEN sa.password_enc IS NOT NULL
      THEN extensions.pgp_sym_decrypt(sa.password_enc, public._supplier_enc_key())
      ELSE NULL END,
    CASE WHEN sa.email_password_enc IS NOT NULL
      THEN extensions.pgp_sym_decrypt(sa.email_password_enc, public._supplier_enc_key())
      ELSE NULL END
  FROM public.supplier_accounts sa
  WHERE sa.id = _account_id;
END;
$$;

-- 2. internal_proxy_configs: admin-only
DROP POLICY IF EXISTS "Staff can manage internal proxy configs" ON public.internal_proxy_configs;
CREATE POLICY "Admins can manage internal proxy configs"
  ON public.internal_proxy_configs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. fb_finance_config: admin-only
DROP POLICY IF EXISTS "Staff can manage fb_finance_config" ON public.fb_finance_config;
CREATE POLICY "Admins can manage fb_finance_config"
  ON public.fb_finance_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. migration_tracking: admin-only authenticated
DROP POLICY IF EXISTS "Staff can manage migration_tracking" ON public.migration_tracking;
CREATE POLICY "Admins can manage migration_tracking"
  ON public.migration_tracking
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. ss_transactions: split policies and recreate safe view
DROP POLICY IF EXISTS "Buyers and staff view full transaction" ON public.ss_transactions;

DROP POLICY IF EXISTS "Buyers can view own transactions" ON public.ss_transactions;
CREATE POLICY "Buyers can view own transactions"
  ON public.ss_transactions
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "Staff can view all transactions (read)" ON public.ss_transactions;
CREATE POLICY "Staff can view all transactions (read)"
  ON public.ss_transactions
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_ss_transaction_credentials(_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  SELECT buyer_id, status, account_credentials INTO v_row
  FROM public.ss_transactions
  WHERE id = _transaction_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF public.is_staff(auth.uid()) THEN
    RETURN v_row.account_credentials;
  END IF;

  IF v_row.buyer_id = auth.uid()
     AND v_row.status IN ('delivered', 'confirmed', 'completed') THEN
    RETURN v_row.account_credentials;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_ss_transaction_credentials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ss_transaction_credentials(uuid) TO authenticated;

-- Recreate the safe view (drop first because column ordering changes)
DROP VIEW IF EXISTS public.ss_transactions_safe;
CREATE VIEW public.ss_transactions_safe
WITH (security_invoker = true) AS
SELECT
  id, listing_id, buyer_id, seller_id, amount, platform_fee, fee_rate, status,
  CASE
    WHEN public.is_staff(auth.uid()) THEN account_credentials
    WHEN buyer_id = auth.uid() AND status IN ('delivered','confirmed','completed') THEN account_credentials
    ELSE NULL
  END AS account_credentials,
  validation_checklist, validated_by, validated_at, delivered_at, confirmed_at,
  disputed_at, dispute_reason, dispute_resolution, notes, created_at, updated_at
FROM public.ss_transactions;

GRANT SELECT ON public.ss_transactions_safe TO authenticated;

-- 6. Fix function search_path on handle_lauth_transfer_trigger
CREATE OR REPLACE FUNCTION public.handle_lauth_transfer_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_lauth_email TEXT;
  v_lauth_enabled BOOLEAN;
  v_payload JSONB;
BEGIN
  IF (NEW.status = 'vendido' AND (OLD.status IS NULL OR OLD.status != 'vendido')) AND NEW.order_item_id IS NOT NULL THEN
    SELECT o.user_id INTO v_user_id
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = NEW.order_item_id;

    SELECT lauth_email, lauth_enabled INTO v_lauth_email, v_lauth_enabled
    FROM public.profiles
    WHERE user_id = v_user_id;

    IF v_lauth_enabled = TRUE AND v_lauth_email IS NOT NULL AND NEW.identification IS NOT NULL THEN
      v_payload := jsonb_build_object(
        'profileId', NEW.identification,
        'email', v_lauth_email,
        'itemId', NEW.id
      );

      PERFORM net.http_post(
        url := 'https://mxnlerkeygfvdnznoxld.functions.supabase.co/lauth-transfer',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := v_payload
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 7. Revoke EXECUTE from anon/authenticated on internal trigger functions
REVOKE EXECUTE ON FUNCTION public._supplier_enc_key() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bm_tracking_on_stock_promotion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_single_default_template() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_product_slug() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_lauth_transfer_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.supplier_accounts_encrypt_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_product_stock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon;
