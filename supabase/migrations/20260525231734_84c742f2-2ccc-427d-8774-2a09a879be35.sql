DO $$
DECLARE
  v_order_id uuid;
  v_user_id uuid := '9f6f44db-4407-4b86-8501-801c9ab0be5c';
  v_new_balance numeric;
BEGIN
  SELECT id INTO v_order_id FROM public.orders WHERE code = 'ORD-MPLSTT6S';

  UPDATE public.orders
  SET subtotal = 500, total = 500, updated_at = now()
  WHERE id = v_order_id;

  UPDATE public.profiles
  SET balance = balance - 400, updated_at = now()
  WHERE user_id = v_user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.wallet_transactions (user_id, type, amount, title, balance_after, reference_id)
  VALUES (v_user_id, 'purchase', -400, 'Ajuste — Cobrança complementar #ORD-MPLSTT6S (4 perfis adicionais)', v_new_balance, v_order_id::text);
END $$;