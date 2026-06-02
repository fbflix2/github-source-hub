
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  chat_id text,
  wapi_message_id text,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  from_me boolean NOT NULL DEFAULT false,
  body text,
  message_type text DEFAULT 'text',
  media_url text,
  contact_name text,
  status text DEFAULT 'sent',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wamsg_phone_created ON public.whatsapp_messages(phone, created_at DESC);
CREATE INDEX idx_wamsg_created ON public.whatsapp_messages(created_at DESC);
CREATE UNIQUE INDEX idx_wamsg_wapi_id ON public.whatsapp_messages(wapi_message_id) WHERE wapi_message_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all whatsapp messages"
  ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert whatsapp messages"
  ON public.whatsapp_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update whatsapp messages"
  ON public.whatsapp_messages FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()));

-- Conversations metadata (status, assignee, last seen)
CREATE TABLE public.whatsapp_conversations (
  phone text PRIMARY KEY,
  contact_name text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  unread_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid,
  client_user_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_waconv_last ON public.whatsapp_conversations(last_message_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view conversations" ON public.whatsapp_conversations
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff manage conversations" ON public.whatsapp_conversations
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Trigger: upsert conversation on message insert
CREATE OR REPLACE FUNCTION public.upsert_whatsapp_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  SELECT user_id INTO v_client_id FROM public.profiles
  WHERE regexp_replace(COALESCE(phone,''), '\D','','g') = NEW.phone
  LIMIT 1;

  INSERT INTO public.whatsapp_conversations
    (phone, contact_name, last_message_at, last_message_preview, unread_count, client_user_id)
  VALUES (
    NEW.phone,
    COALESCE(NEW.contact_name, (SELECT full_name FROM public.profiles WHERE user_id = v_client_id LIMIT 1)),
    NEW.created_at,
    LEFT(COALESCE(NEW.body,''), 200),
    CASE WHEN NEW.direction = 'in' THEN 1 ELSE 0 END,
    v_client_id
  )
  ON CONFLICT (phone) DO UPDATE SET
    last_message_at = EXCLUDED.last_message_at,
    last_message_preview = EXCLUDED.last_message_preview,
    contact_name = COALESCE(public.whatsapp_conversations.contact_name, EXCLUDED.contact_name),
    client_user_id = COALESCE(public.whatsapp_conversations.client_user_id, EXCLUDED.client_user_id),
    unread_count = CASE
      WHEN NEW.direction = 'in' THEN public.whatsapp_conversations.unread_count + 1
      ELSE public.whatsapp_conversations.unread_count END,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_upsert_wa_conversation
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.upsert_whatsapp_conversation();

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
