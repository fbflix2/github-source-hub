
-- Warming profiles table
CREATE TABLE public.warming_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_code text NOT NULL,
  profile_name text,
  track_type text NOT NULL DEFAULT '15_days', -- '7_days', '15_days', '30_days'
  track_days integer NOT NULL DEFAULT 15,
  start_date timestamp with time zone NOT NULL DEFAULT now(),
  current_day integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active', -- 'active', 'completed', 'paused', 'restricted'
  trust_tier text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.warming_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage warming profiles"
  ON public.warming_profiles FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()));

-- Warming tasks table (daily checklist items)
CREATE TABLE public.warming_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.warming_profiles(id) ON DELETE CASCADE NOT NULL,
  day_number integer NOT NULL,
  title text NOT NULL,
  description text,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.warming_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage warming tasks"
  ON public.warming_tasks FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()));
