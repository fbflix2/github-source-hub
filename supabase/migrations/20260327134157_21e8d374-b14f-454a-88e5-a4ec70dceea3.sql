CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid PRIMARY KEY,
  is_online boolean NOT NULL DEFAULT false,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_path text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_presence'
      AND policyname = 'Users can view own presence'
  ) THEN
    CREATE POLICY "Users can view own presence"
    ON public.user_presence
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_presence'
      AND policyname = 'Staff can view team presence'
  ) THEN
    CREATE POLICY "Staff can view team presence"
    ON public.user_presence
    FOR SELECT
    TO authenticated
    USING (public.is_staff(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_presence'
      AND policyname = 'Users can insert own presence'
  ) THEN
    CREATE POLICY "Users can insert own presence"
    ON public.user_presence
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_presence'
      AND policyname = 'Users can update own presence'
  ) THEN
    CREATE POLICY "Users can update own presence"
    ON public.user_presence
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen_at
  ON public.user_presence (last_seen_at DESC);

DROP TRIGGER IF EXISTS update_user_presence_updated_at ON public.user_presence;
CREATE TRIGGER update_user_presence_updated_at
BEFORE UPDATE ON public.user_presence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();