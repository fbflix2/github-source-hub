CREATE OR REPLACE FUNCTION public.buy_extra_exchange_quota(_subscription_id uuid, _qty integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sub record;
  v_prof record;
  v_prod_price numeric := 0;
  v_prod_cost numeric := 0;
  v_res_id uuid := NULL;
  v_res_status text := NULL;
  v_res_balance numeric := 0;
  v_res_price_mode text := NULL;
  v_res_fixed_price numeric := NULL;
  v_res_multiplier numeric := 1;
  v_override numeric := NULL;
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

  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE id = _subscription_id
  FOR UPDATE;

  IF NOT FOUND OR v_sub.user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Assinatura não encontrada';
  END IF;

  SELECT * INTO v_prof
  FROM public.profiles
  WHERE user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF v_sub.product_id IS NOT NULL THEN
    SELECT COALESCE(p.price, 0), COALESCE(p.reseller_cost, 0)
      INTO v_prod_price, v_prod_cost
    FROM public.products p
    WHERE p.id = v_sub.product_id;
  END IF;

  v_unit := COALESCE(v_prod_price, 0);

  IF v_prof.reseller_id IS NOT NULL THEN
    SELECT
      r.id,
      r.status,
      COALESCE(r.balance_credits, 0),
      r.proxy_price_mode,
      r.proxy_fixed_price,
      COALESCE(NULLIF(r.proxy_price_multiplier, 0), 1)
    INTO
      v_res_id,
      v_res_status,
      v_res_balance,
      v_res_price_mode,
      v_res_fixed_price,
      v_res_multiplier
    FROM public.resellers r
    WHERE r.id = v_prof.reseller_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_res_status NOT IN ('active', 'warning') THEN
        RAISE EXCEPTION 'Loja indisponível no momento';
      END IF;

      SELECT COALESCE(o.custom_price, 0)
      INTO v_override
      FROM public.reseller_price_overrides o
      WHERE o.reseller_id = v_res_id
        AND o.product_id = v_sub.product_id
        AND COALESCE(o.enabled, true) = true
      LIMIT 1;

      IF COALESCE(v_override, 0) > 0 THEN
        v_unit := v_override;
      ELSIF v_res_price_mode = 'fixed' AND v_res_fixed_price IS NOT NULL THEN
        v_unit := v_res_fixed_price;
      ELSE
        v_unit := COALESCE(v_prod_price, 0) * v_res_multiplier;
      END IF;

      v_cost := ROUND(COALESCE(v_prod_cost, 0) * 0.5 * _qty, 2);
    ELSE
      v_res_id := NULL;
      v_res_balance := 0;
    END IF;
  END IF;

  IF COALESCE(v_unit, 0) <= 0 AND v_sub.product_id IS NOT NULL THEN
    SELECT oi.price
    INTO v_unit
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.user_id = v_uid
      AND oi.product_id = v_sub.product_id
    ORDER BY oi.created_at DESC
    LIMIT 1;
  END IF;

  IF COALESCE(v_unit, 0) <= 0 THEN
    v_unit := COALESCE(
      NULLIF(v_sub.raw_data->>'renewal_price', '')::numeric,
      NULLIF(v_sub.raw_data->>'price', '')::numeric,
      0
    );
  END IF;

  v_total := ROUND(COALESCE(v_unit, 0) * 0.5 * _qty, 2);

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Preço indisponível para esta assinatura';
  END IF;

  IF COALESCE(v_prof.balance, 0) < v_total THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  IF v_res_id IS NOT NULL AND v_cost > 0 AND v_res_balance < v_cost THEN
    RAISE EXCEPTION 'Compra indisponível no momento. Fale com o suporte da sua loja.';
  END IF;

  UPDATE public.profiles
  SET balance = COALESCE(balance, 0) - v_total
  WHERE user_id = v_uid
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.wallet_transactions
    (user_id, type, title, amount, balance_after, reference_id)
  VALUES
    (v_uid, 'debit', 'Cotas extras de troca de proxy (x' || _qty || ')', v_total, v_new_balance, v_sub.id);

  IF v_res_id IS NOT NULL AND v_cost > 0 THEN
    PERFORM set_config('app.allow_reseller_balance_update', 'on', true);

    UPDATE public.resellers
    SET balance_credits = COALESCE(balance_credits, 0) - v_cost,
        updated_at = now()
    WHERE id = v_res_id
    RETURNING balance_credits INTO v_new_credits;

    INSERT INTO public.reseller_credit_ledger
      (reseller_id, type, amount, balance_after, reference_id, description)
    VALUES
      (v_res_id, 'debit', v_cost, v_new_credits, v_sub.id,
       'Custo FBFlix - Cotas extras de troca (x' || _qty || ')');

    PERFORM set_config('app.allow_reseller_balance_update', 'off', true);
  END IF;

  v_raw := COALESCE(v_sub.raw_data, '{}'::jsonb);
  v_raw := v_raw || jsonb_build_object(
    'exchange_quota_pay',
    COALESCE((v_raw->>'exchange_quota_pay')::int, 0) + _qty
  );

  UPDATE public.subscriptions
  SET raw_data = v_raw,
      updated_at = now()
  WHERE id = v_sub.id;

  RETURN jsonb_build_object(
    'success', true,
    'quantity', _qty,
    'charged', v_total,
    'new_balance', v_new_balance,
    'reseller_charged', v_cost
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.buy_extra_exchange_quota(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_extra_exchange_quota(uuid, integer) TO authenticated;