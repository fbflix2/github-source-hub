
-- Client warming profiles (profiles added by the client themselves)
CREATE TABLE public.client_warming_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_code text NOT NULL,
  profile_name text,
  track_type text NOT NULL DEFAULT '7_days',
  track_days integer NOT NULL DEFAULT 7,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  current_day integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'ativo',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Client warming tasks (individual task progress per profile per day)
CREATE TABLE public.client_warming_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.client_warming_profiles(id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  title text NOT NULL,
  description text,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_warming_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_warming_tasks ENABLE ROW LEVEL SECURITY;

-- Users can manage their own warming profiles
CREATE POLICY "Users can view own client warming profiles"
  ON public.client_warming_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own client warming profiles"
  ON public.client_warming_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own client warming profiles"
  ON public.client_warming_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own client warming profiles"
  ON public.client_warming_profiles FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Staff can manage all
CREATE POLICY "Staff can manage client warming profiles"
  ON public.client_warming_profiles FOR ALL TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

-- Tasks: users can manage tasks for their own profiles
CREATE POLICY "Users can view own client warming tasks"
  ON public.client_warming_tasks FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM public.client_warming_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own client warming tasks"
  ON public.client_warming_tasks FOR INSERT TO authenticated
  WITH CHECK (profile_id IN (SELECT id FROM public.client_warming_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own client warming tasks"
  ON public.client_warming_tasks FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM public.client_warming_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own client warming tasks"
  ON public.client_warming_tasks FOR DELETE TO authenticated
  USING (profile_id IN (SELECT id FROM public.client_warming_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Staff can manage client warming tasks"
  ON public.client_warming_tasks FOR ALL TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_client_warming_profiles_updated_at
  BEFORE UPDATE ON public.client_warming_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
