
-- Partners table
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  commission_rate numeric NOT NULL DEFAULT 10,
  guarantee_days integer NOT NULL DEFAULT 7,
  status text NOT NULL DEFAULT 'active',
  balance numeric NOT NULL DEFAULT 0,
  total_earned numeric NOT NULL DEFAULT 0,
  total_referrals integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partner referrals table
CREATE TABLE public.partner_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id),
  order_total numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  credited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;

-- Partners RLS
CREATE POLICY "Staff can manage partners" ON public.partners FOR ALL USING (is_staff(auth.uid()));
CREATE POLICY "Users can view own partner data" ON public.partners FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own partner data" ON public.partners FOR UPDATE USING (auth.uid() = user_id);

-- Partner referrals RLS
CREATE POLICY "Staff can manage referrals" ON public.partner_referrals FOR ALL USING (is_staff(auth.uid()));
CREATE POLICY "Partners can view own referrals" ON public.partner_referrals FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.partners WHERE id = partner_referrals.partner_id AND user_id = auth.uid())
);

-- Anyone can read partner by slug (for redirect page)
CREATE POLICY "Anyone can view active partners by slug" ON public.partners FOR SELECT USING (status = 'active');

-- Updated_at trigger
CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_partner_referrals_updated_at BEFORE UPDATE ON public.partner_referrals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
