-- Cash register for daily open/close reconciliation
CREATE TABLE public.cash_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  
  -- System-calculated values (auto-filled on close)
  system_revenue NUMERIC NOT NULL DEFAULT 0,
  system_expenses NUMERIC NOT NULL DEFAULT 0,
  system_balance NUMERIC NOT NULL DEFAULT 0,
  
  -- User-informed values
  bank_balance NUMERIC,
  withdrawals NUMERIC NOT NULL DEFAULT 0,
  deposits NUMERIC NOT NULL DEFAULT 0,
  
  -- Difference (auto-calculated: bank_balance - system_balance + withdrawals - deposits)
  difference NUMERIC NOT NULL DEFAULT 0,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_register ENABLE ROW LEVEL SECURITY;

-- Only staff can manage cash register
CREATE POLICY "Staff can view cash register" ON public.cash_register
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert cash register" ON public.cash_register
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update cash register" ON public.cash_register
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()));