
CREATE TABLE public.product_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.product_waitlist ENABLE ROW LEVEL SECURITY;

-- Users can insert their own waitlist entries
CREATE POLICY "Users can insert own waitlist" ON public.product_waitlist
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own waitlist entries
CREATE POLICY "Users can view own waitlist" ON public.product_waitlist
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete own waitlist entries
CREATE POLICY "Users can delete own waitlist" ON public.product_waitlist
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Staff can manage all waitlist entries
CREATE POLICY "Staff can manage waitlist" ON public.product_waitlist
  FOR ALL TO authenticated
  USING (is_staff(auth.uid()));
