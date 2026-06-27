CREATE OR REPLACE FUNCTION public.upsert_whatsapp_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id uuid;
  v_profile_avatar text;
  v_msg_avatar text;
  v_preview text;
BEGIN
  SELECT user_id INTO v_client_id
  FROM public.profiles
  WHERE regexp_replace(COALESCE(phone,''), '\D','','g') = NEW.phone
  LIMIT 1;

  IF v_client_id IS NOT NULL THEN
    SELECT avatar_url INTO v_profile_avatar
    FROM public.profiles
    WHERE user_id = v_client_id
    LIMIT 1;
  END IF;

  v_msg_avatar := COALESCE(
    NEW.raw->'sender'->>'profilePicture',
    NEW.raw->'chat'->>'profilePicture',
    NEW.raw->>'profilePicture',
    NEW.raw->'data'->'sender'->>'profilePicture'
  );

  v_preview := COALESCE(
    NULLIF(NEW.body, ''),
    CASE COALESCE(NEW.message_type, 'text')
      WHEN 'image' THEN '[Imagem]'
      WHEN 'audio' THEN '[Áudio]'
      WHEN 'video' THEN '[Vídeo]'
      WHEN 'document' THEN '[Documento]'
      WHEN 'sticker' THEN '[Figurinha]'
      WHEN 'reaction' THEN '[Reação]'
      ELSE '[Mensagem]'
    END
  );

  INSERT INTO public.whatsapp_conversations
    (phone, contact_name, last_message_at, last_message_preview, unread_count, client_user_id, avatar_url)
  VALUES (
    NEW.phone,
    COALESCE(NEW.contact_name, (SELECT full_name FROM public.profiles WHERE user_id = v_client_id LIMIT 1)),
    NEW.created_at,
    LEFT(v_preview, 200),
    CASE WHEN NEW.direction = 'in' THEN 1 ELSE 0 END,
    v_client_id,
    COALESCE(v_profile_avatar, v_msg_avatar)
  )
  ON CONFLICT (phone) DO UPDATE SET
    last_message_at = EXCLUDED.last_message_at,
    last_message_preview = EXCLUDED.last_message_preview,
    contact_name = COALESCE(EXCLUDED.contact_name, public.whatsapp_conversations.contact_name),
    client_user_id = COALESCE(public.whatsapp_conversations.client_user_id, EXCLUDED.client_user_id),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.whatsapp_conversations.avatar_url),
    unread_count = CASE
      WHEN NEW.direction = 'in' THEN public.whatsapp_conversations.unread_count + 1
      ELSE public.whatsapp_conversations.unread_count
    END,
    status = CASE WHEN NEW.direction = 'in' THEN 'open' ELSE public.whatsapp_conversations.status END,
    updated_at = now();

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_upsert_whatsapp_conversation ON public.whatsapp_messages;
CREATE TRIGGER trg_upsert_whatsapp_conversation
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.upsert_whatsapp_conversation();

ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_conversations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
  END IF;
END $$;