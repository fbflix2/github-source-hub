-- Add attachments and copy_items to tutorials
ALTER TABLE public.tutorials 
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS copy_items jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Feedback / comments table
CREATE TABLE IF NOT EXISTS public.tutorial_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id uuid NOT NULL REFERENCES public.tutorials(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  helpful boolean,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutorial_id, user_id)
);

ALTER TABLE public.tutorial_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read tutorial feedback"
  ON public.tutorial_feedback FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own tutorial feedback"
  ON public.tutorial_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tutorial feedback"
  ON public.tutorial_feedback FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tutorial feedback"
  ON public.tutorial_feedback FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage all tutorial feedback"
  ON public.tutorial_feedback FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_tutorial_feedback_updated_at
  BEFORE UPDATE ON public.tutorial_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tutorial_feedback_tutorial ON public.tutorial_feedback(tutorial_id);