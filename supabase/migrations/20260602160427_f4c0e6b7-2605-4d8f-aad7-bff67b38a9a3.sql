
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS internal_notes text;
