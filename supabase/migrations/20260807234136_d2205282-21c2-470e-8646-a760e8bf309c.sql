CREATE OR REPLACE FUNCTION public.process_reseller_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reseller record;
  v_item record;
  v_prod_cost numeric;
  v_total_debit numeric := 0;
  v_margin numeric := 0;
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS NULL OR OLD.status <> 'completed')
     AND NEW.reseller_id IS NOT NULL THEN

    SELECT id, status, balance_credits INTO v_reseller
    FROM public.resellers
    WHERE id = NEW.reseller_id AND status IN ('active','warning')
    FOR UPDATE;

    IF NOT FOUND THEN RETURN NEW; END IF;

    IF EXISTS (
      SELECT 1 FROM public.reseller_credit_ledger
      WHERE reference_id = NEW.id AND type = 'debit'
    ) THEN
      RETURN NEW;
    END IF;

    FOR v_item IN
      SELECT oi.product_id, oi.quantity, oi.price, p.name, p.reseller_cost
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = NEW.id
    LOOP
      v_prod_cost := COALESCE(v_item.reseller_cost, 0) * COALESCE(v_item.quantity, 1);
      IF v_prod_cost > 0 THEN
        v_total_debit := v_total_debit + v_prod_cost;

        INSERT INTO public.reseller_credit_ledger
          (reseller_id, type, amount, balance_after, reference_id, description)
        VALUES
          (v_reseller.id,
           'debit',
           v_prod_cost,
           v_reseller.balance_credits - v_total_debit,
           NEW.id,
           'Custo FBFlix - ' || COALESCE(v_item.name, 'Produto') ||
             CASE WHEN COALESCE(v_item.quantity,1) > 1
               THEN ' (x' || v_item.quantity || ')' ELSE '' END);
      END IF;
    END LOOP;

    IF v_total_debit > 0 THEN
      UPDATE public.resellers
        SET balance_credits = balance_credits - v_total_debit,
            total_gmv = total_gmv + NEW.total,
            total_referrals = total_referrals + 1,
            updated_at = now()
        WHERE id = v_reseller.id;
    ELSE
      UPDATE public.resellers
        SET total_gmv = total_gmv + NEW.total,
            total_referrals = total_referrals + 1,
            updated_at = now()
        WHERE id = v_reseller.id;
    END IF;

    -- Registra a margem (lucro) do revendedor
    v_margin := GREATEST(COALESCE(NEW.total, 0) - v_total_debit, 0);
    IF v_margin > 0 AND NOT EXISTS (
      SELECT 1 FROM public.reseller_commissions WHERE order_id = NEW.id
    ) THEN
      INSERT INTO public.reseller_commissions
        (reseller_id, order_id, referred_user_id, order_total, commission_amount, status)
      VALUES
        (v_reseller.id, NEW.id, NEW.user_id, COALESCE(NEW.total,0), v_margin, 'credited');

      UPDATE public.resellers
        SET total_commissions_earned = COALESCE(total_commissions_earned,0) + v_margin,
            updated_at = now()
        WHERE id = v_reseller.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;