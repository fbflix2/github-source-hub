
-- Table to store notification sound assignments
CREATE TABLE public.notification_sounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  label text NOT NULL,
  sound_url text,
  file_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_sounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage notification sounds"
  ON public.notification_sounds FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()));

CREATE POLICY "Anyone can view active sounds"
  ON public.notification_sounds FOR SELECT
  TO authenticated
  USING (active = true);

-- Seed default event rows
INSERT INTO public.notification_sounds (event_key, label) VALUES
  ('order_completed', 'Pedido Concluído'),
  ('wallet_deposit', 'Recarga de Saldo (PIX)'),
  ('new_ticket', 'Novo Ticket de Suporte'),
  ('team_chat', 'Mensagem no Chat da Equipe');

-- Storage bucket for notification sounds
INSERT INTO storage.buckets (id, name, public) VALUES ('notification-sounds', 'notification-sounds', true);

-- Storage policies
CREATE POLICY "Staff can upload notification sounds"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'notification-sounds' AND is_staff(auth.uid()));

CREATE POLICY "Staff can delete notification sounds"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'notification-sounds' AND is_staff(auth.uid()));

CREATE POLICY "Anyone can read notification sounds"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'notification-sounds');
