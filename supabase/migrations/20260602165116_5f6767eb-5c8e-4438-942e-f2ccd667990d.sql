
-- 1) Departments table
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  color text DEFAULT '#22c55e',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Departments are viewable by everyone"
  ON public.departments FOR SELECT USING (true);

CREATE POLICY "Admins manage departments"
  ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.departments (name, slug, color, sort_order) VALUES
  ('Atendimento', 'atendimento', '#22c55e', 1),
  ('Comercial', 'comercial', '#3b82f6', 2),
  ('Suporte', 'suporte', '#a855f7', 3),
  ('Parcerias', 'parcerias', '#f59e0b', 4)
ON CONFLICT (slug) DO NOTHING;

-- 2) Link profiles to departments (keep legacy text column for now)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- Backfill department_id from existing text department field where possible
UPDATE public.profiles p
SET department_id = d.id
FROM public.departments d
WHERE p.department_id IS NULL
  AND p.department IS NOT NULL
  AND lower(trim(p.department)) = lower(d.name);

-- 3) Tickets: assignment + audit
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS sender_user_id uuid,
  ADD COLUMN IF NOT EXISTS sender_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- 4) WhatsApp messages: track which staff sent the outbound
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS sender_user_id uuid,
  ADD COLUMN IF NOT EXISTS sender_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- 5) Transfers audit log (covers tickets and WhatsApp)
CREATE TABLE public.conversation_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('ticket','whatsapp')),
  ticket_id uuid,
  conversation_phone text,
  from_user_id uuid,
  to_user_id uuid,
  from_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  to_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_transfers_ticket ON public.conversation_transfers(ticket_id);
CREATE INDEX idx_conv_transfers_phone ON public.conversation_transfers(conversation_phone);

GRANT SELECT, INSERT ON public.conversation_transfers TO authenticated;
GRANT ALL ON public.conversation_transfers TO service_role;

ALTER TABLE public.conversation_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read transfers"
  ON public.conversation_transfers FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff insert transfers"
  ON public.conversation_transfers FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Client reads own ticket transfers"
  ON public.conversation_transfers FOR SELECT TO authenticated
  USING (
    kind = 'ticket'
    AND ticket_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );
