CREATE OR REPLACE FUNCTION public.protect_reseller_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins, service-role operations, database-internal maintenance and nested trusted triggers may update protected fields.
  -- Direct reseller updates still cannot change balance, status, commission or summary counters.
  IF public.has_role(auth.uid(), 'admin')
     OR auth.uid() IS NULL
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