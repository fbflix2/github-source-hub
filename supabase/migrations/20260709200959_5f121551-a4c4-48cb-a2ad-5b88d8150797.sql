
-- ========== RESELLERS ==========
CREATE TABLE public.resellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  brand_name TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | suspended | inactive | warning
  model TEXT NOT NULL DEFAULT 'percentage', -- percentage | credit
  commission_rate NUMERIC NOT NULL DEFAULT 25,
  balance_credits NUMERIC NOT NULL DEFAULT 0,
  min_proxies_per_month INTEGER NOT NULL DEFAULT 5,
  min_monthly_recharge NUMERIC NOT NULL DEFAULT 100,
  proxy_unit_cost NUMERIC NOT NULL DEFAULT 10, -- custo por proxy no modelo crédito
  -- branding
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#22c55e',
  accent_color TEXT DEFAULT '#0ea5e9',
  support_email TEXT,
  support_whatsapp TEXT,
  -- domínio
  custom_domain TEXT UNIQUE,
  domain_status TEXT DEFAULT 'pending', -- pending | verifying | verified | failed
  domain_verification_token TEXT,
  domain_verified_at TIMESTAMPTZ,
  -- openpix / split
  openpix_pix_key TEXT,
  openpix_pix_key_type TEXT, -- cpf | cnpj | email | phone | random
  -- métricas
  total_gmv NUMERIC NOT NULL DEFAULT 0,
  total_commissions_earned NUMERIC NOT NULL DEFAULT 0,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  -- meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resellers TO authenticated;
GRANT ALL ON public.resellers TO service_role;

ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage resellers"
ON public.resellers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Reseller can view own record"
ON public.resellers FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "Reseller can update own branding"
ON public.resellers FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  -- campos sensíveis (model, commission_rate, balance_credits, status, mínimos, proxy_unit_cost) só admin altera
);

CREATE TRIGGER resellers_updated_at
BEFORE UPDATE ON public.resellers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_resellers_status ON public.resellers(status);
CREATE INDEX idx_resellers_custom_domain ON public.resellers(custom_domain);

-- Trigger para bloquear alteração de campos sensíveis via UPDATE de não-admin
CREATE OR REPLACE FUNCTION public.protect_reseller_admin_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- Se não é admin, restaura campos sensíveis
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

CREATE TRIGGER trg_protect_reseller_admin_fields
BEFORE UPDATE ON public.resellers
FOR EACH ROW EXECUTE FUNCTION public.protect_reseller_admin_fields();

-- ========== RESELLER COMMISSIONS ==========
CREATE TABLE public.reseller_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  order_id UUID,
  referred_user_id UUID,
  order_total NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | credited | cancelled | refunded
  credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_commissions TO authenticated;
GRANT ALL ON public.reseller_commissions TO service_role;

ALTER TABLE public.reseller_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commissions"
ON public.reseller_commissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Reseller can view own commissions"
ON public.reseller_commissions FOR SELECT TO authenticated
USING (
  reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
);

CREATE INDEX idx_reseller_commissions_reseller ON public.reseller_commissions(reseller_id);
CREATE INDEX idx_reseller_commissions_status ON public.reseller_commissions(status);

-- ========== RESELLER CREDIT LEDGER ==========
CREATE TABLE public.reseller_credit_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- recharge | purchase | refund | adjustment
  amount NUMERIC NOT NULL, -- positivo para crédito, negativo para débito
  balance_after NUMERIC NOT NULL,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.reseller_credit_ledger TO authenticated;
GRANT ALL ON public.reseller_credit_ledger TO service_role;

ALTER TABLE public.reseller_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all ledger"
ON public.reseller_credit_ledger FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Reseller views own ledger"
ON public.reseller_credit_ledger FOR SELECT TO authenticated
USING (reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid()));

CREATE INDEX idx_reseller_credit_ledger_reseller ON public.reseller_credit_ledger(reseller_id, created_at DESC);

-- ========== RESELLER PRICE OVERRIDES ==========
CREATE TABLE public.reseller_price_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  custom_price NUMERIC NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reseller_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_price_overrides TO authenticated;
GRANT ALL ON public.reseller_price_overrides TO service_role;
GRANT SELECT ON public.reseller_price_overrides TO anon; -- storefront público do revendedor

ALTER TABLE public.reseller_price_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view enabled overrides"
ON public.reseller_price_overrides FOR SELECT TO anon, authenticated
USING (enabled = true);

CREATE POLICY "Reseller manages own overrides"
ON public.reseller_price_overrides FOR ALL TO authenticated
USING (reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid()))
WITH CHECK (reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage all overrides"
ON public.reseller_price_overrides FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER reseller_price_overrides_updated_at
BEFORE UPDATE ON public.reseller_price_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== ADICIONAR reseller_id ==========
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_reseller ON public.profiles(reseller_id);
CREATE INDEX IF NOT EXISTS idx_orders_reseller ON public.orders(reseller_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_reseller ON public.subscriptions(reseller_id);

-- ========== FUNÇÃO PARA CRIAR COMISSÃO NO PEDIDO COMPLETADO ==========
CREATE OR REPLACE FUNCTION public.process_reseller_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reseller record;
  v_commission NUMERIC;
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS NULL OR OLD.status <> 'completed')
     AND NEW.reseller_id IS NOT NULL THEN

    SELECT id, model, commission_rate, status INTO v_reseller
    FROM public.resellers
    WHERE id = NEW.reseller_id AND status IN ('active','warning');

    IF NOT FOUND THEN RETURN NEW; END IF;

    -- Só gera comissão no modelo percentage; no modelo crédito o ganho é embutido no preço do revendedor
    IF v_reseller.model = 'percentage' THEN
      v_commission := NEW.total * (v_reseller.commission_rate / 100.0);

      IF NOT EXISTS (SELECT 1 FROM public.reseller_commissions WHERE order_id = NEW.id) THEN
        INSERT INTO public.reseller_commissions
          (reseller_id, order_id, referred_user_id, order_total, commission_amount, status)
        VALUES
          (NEW.reseller_id, NEW.id, NEW.user_id, NEW.total, v_commission, 'pending');

        UPDATE public.resellers
          SET total_referrals = total_referrals + 1,
              total_gmv = total_gmv + NEW.total,
              updated_at = now()
          WHERE id = NEW.reseller_id;
      END IF;
    ELSE
      -- Modelo crédito: só atualiza GMV
      UPDATE public.resellers
        SET total_gmv = total_gmv + NEW.total,
            total_referrals = total_referrals + 1,
            updated_at = now()
        WHERE id = NEW.reseller_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_process_reseller_commission
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.process_reseller_commission();

-- ========== FUNÇÃO PARA LIBERAR COMISSÕES APÓS GARANTIA (7 dias) ==========
CREATE OR REPLACE FUNCTION public.release_reseller_commissions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT rc.id, rc.reseller_id, rc.commission_amount
    FROM public.reseller_commissions rc
    JOIN public.resellers rs ON rs.id = rc.reseller_id
    WHERE rc.status = 'pending'
      AND rs.status IN ('active','warning')
      AND rc.created_at <= now() - interval '7 days'
  LOOP
    UPDATE public.reseller_commissions
      SET status = 'credited', credited_at = now(), updated_at = now()
      WHERE id = r.id;

    UPDATE public.resellers
      SET total_commissions_earned = total_commissions_earned + r.commission_amount,
          updated_at = now()
      WHERE id = r.reseller_id;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ========== FUNÇÃO PARA CANCELAR COMISSÃO EM CASO DE REEMBOLSO ==========
CREATE OR REPLACE FUNCTION public.cancel_reseller_commission_on_refund()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref record;
BEGIN
  IF NEW.status IN ('cancelled','refunded') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    FOR v_ref IN
      SELECT * FROM public.reseller_commissions WHERE order_id = NEW.id
    LOOP
      IF v_ref.status = 'pending' THEN
        UPDATE public.reseller_commissions
          SET status = 'cancelled', updated_at = now()
          WHERE id = v_ref.id;
        UPDATE public.resellers
          SET total_referrals = GREATEST(0, total_referrals - 1),
              updated_at = now()
          WHERE id = v_ref.reseller_id;
      ELSIF v_ref.status = 'credited' THEN
        UPDATE public.reseller_commissions
          SET status = 'refunded', updated_at = now()
          WHERE id = v_ref.id;
        UPDATE public.resellers
          SET total_commissions_earned = GREATEST(0, total_commissions_earned - v_ref.commission_amount),
              total_referrals = GREATEST(0, total_referrals - 1),
              updated_at = now()
          WHERE id = v_ref.reseller_id;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cancel_reseller_commission_on_refund
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.cancel_reseller_commission_on_refund();
