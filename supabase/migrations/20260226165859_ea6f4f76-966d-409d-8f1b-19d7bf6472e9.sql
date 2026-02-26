
-- Team chat messages table
CREATE TABLE public.team_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

-- Only staff can read/write
CREATE POLICY "Staff can view team messages"
  ON public.team_messages FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can send team messages"
  ON public.team_messages FOR INSERT
  WITH CHECK (public.is_staff(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Staff can delete own messages"
  ON public.team_messages FOR DELETE
  USING (public.is_staff(auth.uid()) AND auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;
