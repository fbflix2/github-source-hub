
-- Table for tracking individual cash movements (entries and exits)
CREATE TABLE public.cash_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_register_id uuid NOT NULL REFERENCES public.cash_register(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'entry', -- 'entry' or 'exit'
  source text NOT NULL DEFAULT 'manual', -- 'manual' or 'automatic'
  amount numeric NOT NULL DEFAULT 0,
  description text,
  reference_id text, -- e.g. order code for automatic entries
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage cash movements"
  ON public.cash_movements FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()));
