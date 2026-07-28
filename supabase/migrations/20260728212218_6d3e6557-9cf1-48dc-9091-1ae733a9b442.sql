-- Permitir débito controlado de créditos do revendedor por rotinas internas
CREATE OR REPLACE FUNCTION public.protect_reseller_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin')
     OR auth.uid() IS NULL
     OR current_setting('request.jwt.claim.role', true) = 'service_role'
     OR current_setting('app.allow_reseller_balance_update', true) = 'on'
     OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  NEW.model := OLD.model;
  NEW.commission_rate := OLD.commission_rate;
  NEW.balance_credits := OLD.balance_credits;
  NEW.status := OLD.status;
  NEW.min_proxies_per_month := OLD.min_proxies_per_month;
  NEW.min_monthly_recharge := OLD.min_monthly_recharge;
  NEW.proxy_unit_cost := OLD.proxy_unit_cost;
  NEW.total_gmv := OLD.total_gmv;
  NEW.total_commissions_earned := OLD.total_commissions_earned;
  NEW.total_referrals := OLD.total_referrals;
  NEW.slug := OLD.slug;
  RETURN NEW;
END;
$$;

-- Compra de cotas extras de troca (50% do preço)
CREATE OR REPLACE FUNCTION public.buy_extra_exchange_quota(_subscription_id uuid, _qty integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub record;
  v_prof record;
  v_prod record;
  v_res record;
  v_override numeric;
  v_unit numeric := 0;
  v_total numeric := 0;
  v_cost numeric := 0;
  v_new_balance numeric;
  v_new_credits numeric;
  v_raw jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF _qty IS NULL OR _qty < 1 OR _qty > 10 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  SELECT * INTO v_sub FROM public.subscriptions WHERE id = _subscription_id FOR UPDATE;
  IF NOT FOUND OR v_sub.user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Assinatura não encontrada';
  END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF v_sub.product_id IS NOT NULL THEN
    SELECT * INTO v_prod FROM public.products WHERE id = v_sub.product_id;
  END IF;

  v_unit := COALESCE(v_prod.price, 0);

  IF v_prof.reseller_id IS NOT NULL THEN
    SELECT * INTO v_res FROM public.resellers WHERE id = v_prof.reseller_id FOR UPDATE;
    IF FOUND THEN
      IF v_res.status NOT IN ('active', 'warning') THEN
        RAISE EXCEPTION 'Loja indisponível no momento';
      END IF;

      SELECT COALESCE(o.custom_price, 0) INTO v_override
      FROM public.reseller_price_overrides o
      WHERE o.reseller_id = v_res.id
        AND o.product_id = v_sub.product_id
        AND COALESCE(o.enabled, true) = true
      LIMIT 1;

      IF v_override IS NOT NULL AND v_override > 0 THEN
        v_unit := v_override;
      ELSIF v_res.proxy_price_mode = 'fixed' AND v_res.proxy_fixed_price IS NOT NULL THEN
        v_unit := v_res.proxy_fixed_price;
      ELSE
        v_unit := COALESCE(v_prod.price, 0) * COALESCE(NULLIF(v_res.proxy_price_multiplier, 0), 1);
      END IF;

      v_cost := ROUND(COALESCE(v_prod.reseller_cost, 0) * 0.5 * _qty, 2);
    END IF;
  END IF;

  -- Fallback: último preço pago pelo cliente por este produto
  IF COALESCE(v_unit, 0) <= 0 AND v_sub.product_id IS NOT NULL THEN
    SELECT oi.price INTO v_unit
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.user_id = v_uid AND oi.product_id = v_sub.product_id
    ORDER BY oi.created_at DESC
    LIMIT 1;
  END IF;

  v_total := ROUND(COALESCE(v_unit, 0) * 0.5 * _qty, 2);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Preço indisponível para esta assinatura';
  END IF;

  IF COALESCE(v_prof.balance, 0) < v_total THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  IF v_res.id IS NOT NULL AND v_cost > 0 AND COALESCE(v_res.balance_credits, 0) < v_cost THEN
    RAISE EXCEPTION 'Compra indisponível no momento. Fale com o suporte da sua loja.';
  END IF;

  -- Debita o cliente
  UPDATE public.profiles
  SET balance = COALESCE(balance, 0) - v_total
  WHERE user_id = v_uid
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.wallet_transactions (user_id, type, title, amount, balance_after, reference_id)
  VALUES (v_uid, 'debit', 'Cotas extras de troca de proxy (x' || _qty || ')', v_total, v_new_balance, v_sub.id);

  -- Debita o revendedor (50% do custo FBFlix)
  IF v_res.id IS NOT NULL AND v_cost > 0 THEN
    PERFORM set_config('app.allow_reseller_balance_update', 'on', true);

    UPDATE public.resellers
    SET balance_credits = COALESCE(balance_credits, 0) - v_cost,
        updated_at = now()
    WHERE id = v_res.id
    RETURNING balance_credits INTO v_new_credits;

    INSERT INTO public.reseller_credit_ledger
      (reseller_id, type, amount, balance_after, reference_id, description)
    VALUES
      (v_res.id, 'debit', v_cost, v_new_credits, v_sub.id,
       'Custo FBFlix - Cotas extras de troca (x' || _qty || ')');

    PERFORM set_config('app.allow_reseller_balance_update', 'off', true);
  END IF;

  -- Credita as cotas
  v_raw := COALESCE(v_sub.raw_data, '{}'::jsonb);
  v_raw := v_raw || jsonb_build_object(
    'exchange_quota_pay',
    COALESCE((v_raw->>'exchange_quota_pay')::int, 0) + _qty
  );

  UPDATE public.subscriptions
  SET raw_data = v_raw, updated_at = now()
  WHERE id = v_sub.id;

  RETURN jsonb_build_object(
    'success', true,
    'quantity', _qty,
    'charged', v_total,
    'new_balance', v_new_balance,
    'reseller_charged', v_cost
  );
END;
$$;

REVOKE ALL ON FUNCTION public.buy_extra_exchange_quota(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_extra_exchange_quota(uuid, integer) TO authenticated;