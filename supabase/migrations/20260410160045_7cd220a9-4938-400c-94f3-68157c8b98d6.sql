-- Add tracking columns to whatsapp_logs
ALTER TABLE public.whatsapp_logs 
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_message text,
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS image_url text;

-- Index for webhook lookups by wapi_message_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_wapi_message_id 
  ON public.whatsapp_logs (wapi_message_id) 
  WHERE wapi_message_id IS NOT NULL;

-- Index for campaign analytics by template_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_template_id 
  ON public.whatsapp_logs (template_id) 
  WHERE template_id IS NOT NULL;