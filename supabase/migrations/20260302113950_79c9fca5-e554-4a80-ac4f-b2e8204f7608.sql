
CREATE TABLE public.cost_center (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'fixed' CHECK (type IN ('fixed', 'variable')),
  amount NUMERIC NOT NULL DEFAULT 0,
  recurrence TEXT DEFAULT 'monthly' CHECK (recurrence IN ('monthly', 'weekly', 'yearly', 'one_time')),
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cost_center ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage cost center" ON public.cost_center FOR ALL USING (is_staff(auth.uid()));
