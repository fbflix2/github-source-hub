
-- Add recipient_id for direct messages (NULL = group message)
ALTER TABLE public.team_messages ADD COLUMN recipient_id uuid DEFAULT NULL;

-- Drop all existing policies on team_messages
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'team_messages' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_messages', pol.policyname);
  END LOOP;
END $$;

-- Staff can see group messages and their own DMs
CREATE POLICY "Staff can view team messages"
ON public.team_messages FOR SELECT
TO authenticated
USING (
  is_staff(auth.uid()) AND (
    recipient_id IS NULL
    OR user_id = auth.uid()
    OR recipient_id = auth.uid()
  )
);

-- Staff can send messages
CREATE POLICY "Staff can insert team messages"
ON public.team_messages FOR INSERT
TO authenticated
WITH CHECK (is_staff(auth.uid()) AND user_id = auth.uid());

-- Staff can delete own messages
CREATE POLICY "Staff can delete own messages"
ON public.team_messages FOR DELETE
TO authenticated
USING (is_staff(auth.uid()) AND user_id = auth.uid());
