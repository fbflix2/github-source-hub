
-- Track earnings per profile for operators
CREATE TABLE public.operator_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  profile_code text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  -- pending = profile still in pipeline
  -- frozen = profile at checkpoint (under analysis)
  -- confirmed = profile completed successfully, operator earns
  -- cancelled = profile blocked/restricted, operator does NOT earn
  frozen_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id)
);

ALTER TABLE public.operator_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own earnings"
  ON public.operator_earnings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can manage earnings"
  ON public.operator_earnings FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()));
