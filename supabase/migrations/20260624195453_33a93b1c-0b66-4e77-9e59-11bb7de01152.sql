
CREATE TABLE public.friend_request_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.supplier_batches(id) ON DELETE CASCADE,
  profile_url text NOT NULL,
  profile_name text,
  notes text,
  added boolean NOT NULL DEFAULT false,
  added_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_frt_batch ON public.friend_request_targets(batch_id);
CREATE INDEX idx_frt_added ON public.friend_request_targets(added);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_request_targets TO authenticated;
GRANT ALL ON public.friend_request_targets TO service_role;

ALTER TABLE public.friend_request_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage friend_request_targets"
  ON public.friend_request_targets
  FOR ALL
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));
