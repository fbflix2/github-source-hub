
-- Backfill body + contact_name from raw payload (W-API msgContent shape)
UPDATE public.whatsapp_messages
SET body = COALESCE(
  raw->'msgContent'->>'conversation',
  raw->'msgContent'->'extendedTextMessage'->>'text',
  raw->'msgContent'->'imageMessage'->>'caption',
  raw->'msgContent'->'videoMessage'->>'caption'
),
contact_name = COALESCE(contact_name, raw->'sender'->>'pushName')
WHERE body IS NULL AND raw IS NOT NULL;

-- Refresh conversation previews/contact_name based on latest message
UPDATE public.whatsapp_conversations c
SET last_message_preview = LEFT(COALESCE(m.body, ''), 200),
    contact_name = COALESCE(c.contact_name, m.contact_name)
FROM (
  SELECT DISTINCT ON (phone) phone, body, contact_name, created_at
  FROM public.whatsapp_messages
  ORDER BY phone, created_at DESC
) m
WHERE c.phone = m.phone;
