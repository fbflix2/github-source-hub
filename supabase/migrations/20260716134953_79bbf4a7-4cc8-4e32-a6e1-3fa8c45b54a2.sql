ALTER TABLE public.bm_tracking ALTER COLUMN sold_at DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_refund_and_restock_order(_order_id uuid, _credit_wallet boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_stock_count integer := 0;
  v_bm_count integer := 0;
  v_sub_count integer := 0;
  v_pool_count integer := 0;
  v_new_balance numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_order.status IN ('refunded','cancelled') THEN
    RAISE EXCEPTION 'Pedido já está estornado/cancelado';
  END IF;

  WITH targets AS (
    SELECT si.id
    FROM public.stock_items si
    JOIN public.order_items oi ON oi.id = si.order_item_id
    WHERE oi.order_id = _order_id
      AND si.deleted_at IS NULL
  ), updated AS (
    UPDATE public.stock_items si
    SET order_item_id = NULL,
        status = 'revisado',
        updated_at = now()
    WHERE si.id IN (SELECT id FROM targets)
       OR si.parent_id IN (SELECT id FROM targets)
    RETURNING si.id
  )
  SELECT count(*) INTO v_stock_count FROM updated;

  UPDATE public.bm_tracking
  SET status = 'em_estoque',
      client_user_id = '00000000-0000-0000-0000-000000000000'::uuid,
      client_name = NULL,
      client_email = NULL,
      order_id = NULL,
      order_item_id = NULL,
      sold_at = NULL,
      sale_price = 0,
      expires_at = now() + interval '999 years',
      removed_at = NULL,
      updated_at = now()
  WHERE order_id = _order_id;
  GET DIAGNOSTICS v_bm_count = ROW_COUNT;

  UPDATE public.subscriptions
  SET user_id = NULL,
      status = 'available',
      auto_renew = false,
      included_in_ct_client_id = NULL,
      updated_at = now()
  WHERE (raw_data->>'order_id') = _order_id::text;
  GET DIAGNOSTICS v_sub_count = ROW_COUNT;

  UPDATE public.ct_pool_items p
  SET status = 'available',
      assigned_ct_client_id = NULL,
      released_at = now(),
      updated_at = now()
  FROM public.ct_clients c
  WHERE p.assigned_ct_client_id = c.id
    AND (c.raw_data->>'order_id') = _order_id::text;
  GET DIAGNOSTICS v_pool_count = ROW_COUNT;

  IF _credit_wallet AND v_order.user_id IS NOT NULL AND COALESCE(v_order.total, 0) > 0 THEN
    UPDATE public.profiles
    SET balance = COALESCE(balance, 0) + v_order.total
    WHERE user_id = v_order.user_id
    RETURNING balance INTO v_new_balance;

    IF v_new_balance IS NOT NULL THEN
      INSERT INTO public.wallet_transactions (user_id, type, title, amount, balance_after, reference_id)
      VALUES (v_order.user_id, 'credit', 'Estorno do pedido ' || COALESCE(v_order.code, _order_id::text),
              v_order.total, v_new_balance, _order_id);
    END IF;
  END IF;

  UPDATE public.orders
  SET status = 'refunded',
      updated_at = now()
  WHERE id = _order_id;

  RETURN jsonb_build_object(
    'success', true,
    'stock_items_restocked', v_stock_count,
    'bm_tracking_reset', v_bm_count,
    'subscriptions_released', v_sub_count,
    'pool_items_released', v_pool_count,
    'wallet_credited', _credit_wallet AND v_new_balance IS NOT NULL,
    'new_balance', v_new_balance
  );
END;
$function$;