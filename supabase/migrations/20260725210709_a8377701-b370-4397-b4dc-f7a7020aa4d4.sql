CREATE OR REPLACE FUNCTION public.protect_reseller_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins, service-role operations and nested trusted triggers may update protected fields.
  -- Direct reseller updates still cannot change balance, status, commission or summary counters.
  IF public.has_role(auth.uid(), 'admin')
     OR current_setting('request.jwt.claim.role', true) = 'service_role'
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

WITH ledger_balance AS (
  SELECT
    r.id,
    COALESCE(SUM(CASE WHEN l.type = 'credit' THEN l.amount ELSE -l.amount END), 0) AS computed_balance
  FROM public.resellers r
  LEFT JOIN public.reseller_credit_ledger l ON l.reseller_id = r.id
  WHERE r.id = '5df6e96f-a3dc-44d7-b1e2-1e5383778774'::uuid
  GROUP BY r.id
), completed_metrics AS (
  SELECT
    r.id,
    COALESCE(SUM(o.total), 0) AS computed_gmv,
    COUNT(DISTINCT o.user_id)::integer AS computed_referrals
  FROM public.resellers r
  LEFT JOIN public.orders o
    ON o.reseller_id = r.id
   AND o.status = 'completed'
  WHERE r.id = '5df6e96f-a3dc-44d7-b1e2-1e5383778774'::uuid
  GROUP BY r.id
)
UPDATE public.resellers r
SET balance_credits = lb.computed_balance,
    total_gmv = cm.computed_gmv,
    total_referrals = cm.computed_referrals,
    updated_at = now()
FROM ledger_balance lb
JOIN completed_metrics cm ON cm.id = lb.id
WHERE r.id = lb.id;