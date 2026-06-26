
-- Trigger: ao cancelar/reembolsar um pedido, cancelar (ou estornar) a comissão do parceiro
CREATE OR REPLACE FUNCTION public.cancel_partner_referral_on_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref record;
BEGIN
  IF NEW.status IN ('cancelled','refunded') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    FOR v_ref IN
      SELECT * FROM public.partner_referrals WHERE order_id = NEW.id
    LOOP
      IF v_ref.status = 'pending' THEN
        UPDATE public.partner_referrals
          SET status = 'cancelled', updated_at = now()
          WHERE id = v_ref.id;
        UPDATE public.partners
          SET total_referrals = GREATEST(0, total_referrals - 1),
              updated_at = now()
          WHERE id = v_ref.partner_id;

      ELSIF v_ref.status = 'credited' THEN
        -- Estorno: debitar saldo e total_earned do parceiro
        UPDATE public.partner_referrals
          SET status = 'refunded', updated_at = now()
          WHERE id = v_ref.id;
        UPDATE public.partners
          SET balance = GREATEST(0, COALESCE(balance,0) - v_ref.commission_amount),
              total_earned = GREATEST(0, COALESCE(total_earned,0) - v_ref.commission_amount),
              total_referrals = GREATEST(0, total_referrals - 1),
              updated_at = now()
          WHERE id = v_ref.partner_id;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_partner_referral_on_refund ON public.orders;
CREATE TRIGGER trg_cancel_partner_referral_on_refund
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.cancel_partner_referral_on_refund();
