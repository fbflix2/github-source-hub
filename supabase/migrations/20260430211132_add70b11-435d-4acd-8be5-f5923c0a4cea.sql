CREATE TABLE public.whatsapp_contact_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_contact_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view contact lists"
ON public.whatsapp_contact_lists FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can create contact lists"
ON public.whatsapp_contact_lists FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update contact lists"
ON public.whatsapp_contact_lists FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete contact lists"
ON public.whatsapp_contact_lists FOR DELETE TO authenticated
USING (public.is_staff(auth.uid()));

CREATE TRIGGER update_whatsapp_contact_lists_updated_at
BEFORE UPDATE ON public.whatsapp_contact_lists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_whatsapp_contact_lists_created_by ON public.whatsapp_contact_lists(created_by);