
CREATE TABLE public.moderator_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  allowed_paths text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.moderator_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage moderator permissions"
  ON public.moderator_permissions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own permissions"
  ON public.moderator_permissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
