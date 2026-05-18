UPDATE public.safe_bm_vaults 
SET status = 'active', 
    last_billing_at = COALESCE(last_billing_at, now())
WHERE billing_status = 'paid' 
  AND status IN ('pending', 'suspended', 'inactive');