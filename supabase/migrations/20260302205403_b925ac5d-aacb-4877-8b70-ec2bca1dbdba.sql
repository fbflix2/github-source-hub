
-- Table for platform feedback from clients
CREATE TABLE public.platform_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  label text NOT NULL, -- 'otima', 'boa', 'pode_melhorar'
  suggestion text, -- only when label = 'pode_melhorar'
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_feedback ENABLE ROW LEVEL SECURITY;

-- Each user can only leave one feedback
CREATE UNIQUE INDEX idx_platform_feedback_user ON public.platform_feedback(user_id);

CREATE POLICY "Users can insert own feedback"
ON public.platform_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback"
ON public.platform_feedback FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback"
ON public.platform_feedback FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all feedback"
ON public.platform_feedback FOR SELECT
USING (is_staff(auth.uid()));
