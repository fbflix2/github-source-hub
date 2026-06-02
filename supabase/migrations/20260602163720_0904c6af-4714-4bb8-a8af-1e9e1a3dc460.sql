ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS avatar_url text;

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
BEGIN
  SELECT user_id INTO v_client_id FROM public.profiles
  WHERE regexp_replace(COALESCE(phone,''), '\D','','g') = NEW.phone
  LIMIT 1;

  IF v_client_id IS NOT NULL THEN
    SELECT avatar_url INTO v_profile_avatar FROM public.profiles WHERE user_id = v_client_id LIMIT 1;
  END IF;

  -- Try extract profile pic from raw webhook payload
  v_msg_avatar := COALESCE(
    NEW.raw->'sender'->>'profilePicture',
    NEW.raw->'chat'->>'profilePicture',
    NEW.raw->>'profilePicture',
    NEW.raw->'data'->'sender'->>'profilePicture'
  );

  INSERT INTO public.whatsapp_conversations
    (phone, contact_name, last_message_at, last_message_preview, unread_count, client_user_id, avatar_url)
  VALUES (
    NEW.phone,
    COALESCE(NEW.contact_name, (SELECT full_name FROM public.profiles WHERE user_id = v_client_id LIMIT 1)),
    NEW.created_at,
    LEFT(COALESCE(NEW.body,''), 200),
    CASE WHEN NEW.direction = 'in' THEN 1 ELSE 0 END,
    v_client_id,
    COALESCE(v_profile_avatar, v_msg_avatar)
  )
  ON CONFLICT (phone) DO UPDATE SET
    last_message_at = EXCLUDED.last_message_at,
    last_message_preview = EXCLUDED.last_message_preview,
    contact_name = COALESCE(public.whatsapp_conversations.contact_name, EXCLUDED.contact_name),
    client_user_id = COALESCE(public.whatsapp_conversations.client_user_id, EXCLUDED.client_user_id),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.whatsapp_conversations.avatar_url),
    unread_count = CASE
      WHEN NEW.direction = 'in' THEN public.whatsapp_conversations.unread_count + 1
      ELSE public.whatsapp_conversations.unread_count END,
    updated_at = now();
  RETURN NEW;
END;
$function$;