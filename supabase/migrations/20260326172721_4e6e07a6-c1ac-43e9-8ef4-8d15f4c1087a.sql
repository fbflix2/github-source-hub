
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'push' CHECK (type IN ('push', 'popup')),
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  image_url text,
  link text DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'active')),
  scheduled_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  global boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage admin_notifications"
ON public.admin_notifications
FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Users can read active admin_notifications"
ON public.admin_notifications
FOR SELECT
TO authenticated
USING (is_active = true AND status IN ('sent', 'active'));
