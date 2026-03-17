CREATE TABLE public.warming_operator_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL,
  goal_type text NOT NULL DEFAULT 'daily',
  target_profiles integer NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.warming_operator_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage warming operator goals"
  ON public.warming_operator_goals FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()));

CREATE UNIQUE INDEX warming_operator_goals_unique_active 
  ON public.warming_operator_goals (operator_id, goal_type) 
  WHERE active = true;