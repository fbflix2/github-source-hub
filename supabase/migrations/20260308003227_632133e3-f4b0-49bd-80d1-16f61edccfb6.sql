CREATE TABLE public.migration_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  status text NOT NULL DEFAULT 'pending',
  migrated_at timestamp with time zone,
  added_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.migration_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage migration_tracking"
  ON public.migration_tracking
  FOR ALL
  USING (is_staff(auth.uid()));

CREATE TRIGGER update_migration_tracking_updated_at
  BEFORE UPDATE ON public.migration_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();