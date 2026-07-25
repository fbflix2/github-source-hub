CREATE OR REPLACE FUNCTION public.check_reseller_checkout_capacity(
  _reseller_id uuid,
  _product_ids uuid[],
  _quantities integer[]
)
RETURNS TABLE(can_cover boolean, total_cost numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric := 0;
  v_total_cost numeric := 0;
BEGIN
  IF _reseller_id IS NULL OR _product_ids IS NULL OR array_length(_product_ids, 1) IS NULL THEN
    RETURN QUERY SELECT true, 0::numeric;
    RETURN;
  END IF;

  SELECT COALESCE(r.balance_credits, 0)
    INTO v_balance
  FROM public.resellers r
  WHERE r.id = _reseller_id
    AND r.status IN ('active', 'warning')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric;
    RETURN;
  END IF;

  WITH requested_items AS (
    SELECT
      pid AS product_id,
      GREATEST(COALESCE(qty, 1), 1) AS quantity
    FROM unnest(_product_ids, _quantities) AS u(pid, qty)
  )
  SELECT COALESCE(SUM(COALESCE(p.reseller_cost, 0) * ri.quantity), 0)
    INTO v_total_cost
  FROM requested_items ri
  JOIN public.products p ON p.id = ri.product_id;

  RETURN QUERY SELECT (v_total_cost <= 0 OR v_balance >= v_total_cost), v_total_cost;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_reseller_checkout_capacity(uuid, uuid[], integer[]) TO anon;
GRANT EXECUTE ON FUNCTION public.check_reseller_checkout_capacity(uuid, uuid[], integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_reseller_checkout_capacity(uuid, uuid[], integer[]) TO service_role;