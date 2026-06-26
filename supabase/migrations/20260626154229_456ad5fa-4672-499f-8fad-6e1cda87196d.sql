
-- ============================================================
-- 1) Tabela de saques do parceiro
-- ============================================================
CREATE TABLE IF NOT EXISTS public.partner_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  pix_key text NOT NULL,
  pix_key_type text NOT NULL DEFAULT 'cpf',
  holder_name text,
  status text NOT NULL DEFAULT 'pending', -- pending | paid | rejected
  admin_notes text,
  paid_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_withdrawals TO authenticated;
GRANT ALL ON public.partner_withdrawals TO service_role;

ALTER TABLE public.partner_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_withdrawals_own_select"
  ON public.partner_withdrawals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "partner_withdrawals_own_insert"
  ON public.partner_withdrawals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "partner_withdrawals_admin_update"
  ON public.partner_withdrawals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "partner_withdrawals_admin_delete"
  ON public.partner_withdrawals FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_partner_withdrawals_updated_at
  BEFORE UPDATE ON public.partner_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2) Função que debita saldo do parceiro ao solicitar saque
-- ============================================================
CREATE OR REPLACE FUNCTION public.partner_withdrawal_debit_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT balance INTO v_balance FROM public.partners WHERE id = NEW.partner_id FOR UPDATE;
    IF v_balance IS NULL OR v_balance < NEW.amount THEN
      RAISE EXCEPTION 'Saldo insuficiente';
    END IF;
    UPDATE public.partners
      SET balance = balance - NEW.amount, updated_at = now()
      WHERE id = NEW.partner_id;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
    -- estorno: devolve saldo
    UPDATE public.partners
      SET balance = balance + NEW.amount, updated_at = now()
      WHERE id = NEW.partner_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_partner_withdrawal_balance
  AFTER INSERT OR UPDATE ON public.partner_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.partner_withdrawal_debit_balance();

-- ============================================================
-- 3) Função para liberar comissões após o prazo de garantia
-- ============================================================
CREATE OR REPLACE FUNCTION public.release_partner_commissions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count integer := 0;
  v_wallet_balance numeric;
BEGIN
  FOR r IN
    SELECT pr.id, pr.partner_id, pr.commission_amount, pr.created_at,
           p.user_id, p.guarantee_days
    FROM public.partner_referrals pr
    JOIN public.partners p ON p.id = pr.partner_id
    WHERE pr.status = 'pending'
      AND p.status = 'active'
      AND pr.created_at <= now() - (COALESCE(p.guarantee_days, 7) || ' days')::interval
  LOOP
    UPDATE public.partner_referrals
      SET status = 'credited', credited_at = now(), updated_at = now()
      WHERE id = r.id;

    UPDATE public.partners
      SET balance = COALESCE(balance, 0) + r.commission_amount,
          total_earned = COALESCE(total_earned, 0) + r.commission_amount,
          updated_at = now()
      WHERE id = r.partner_id;

    UPDATE public.profiles
      SET balance = COALESCE(balance, 0) + r.commission_amount
      WHERE user_id = r.user_id
      RETURNING balance INTO v_wallet_balance;

    IF v_wallet_balance IS NOT NULL THEN
      INSERT INTO public.wallet_transactions (user_id, type, title, amount, balance_after, reference_id)
      VALUES (r.user_id, 'credit', 'Comissão de parceiro (liberada)', r.commission_amount, v_wallet_balance, r.id);
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- 4) Cron diário às 03:00 BRT (06:00 UTC)
-- ============================================================
SELECT cron.unschedule('release-partner-commissions-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'release-partner-commissions-daily');

SELECT cron.schedule(
  'release-partner-commissions-daily',
  '0 6 * * *',
  $$ SELECT public.release_partner_commissions(); $$
);
