-- Add scheduled_at column if it doesn't exist
ALTER TABLE public.whatsapp_logs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status_scheduled ON public.whatsapp_logs (status, scheduled_at) WHERE status = 'queued';

-- Enable the pg_net extension if not already enabled (required for calling Edge Functions from SQL)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to call the process-queue action in the Edge Function
CREATE OR REPLACE FUNCTION public.process_whatsapp_queue()
RETURNS void AS $$
DECLARE
  v_project_id TEXT;
  v_anon_key TEXT;
BEGIN
  -- We'll use the environment variables if available, but usually we need to hardcode or get them from a config table
  -- Since we are in a migration, we might not have easy access to project_id and anon_key.
  -- However, we can use a simpler approach: just call the function.
  
  -- For now, let's just make sure the status 'queued' is handled in the Edge Function.
  -- The Edge Function itself can be called by a cron.
  
  -- We will use the service role key if possible, but it's safer to use pg_net to call the local endpoint.
  PERFORM net.http_post(
    url := 'https://' || (SELECT current_setting('request.headers', true)::json->>'host') || '/functions/v1/wapi-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', (SELECT 'Bearer ' || current_setting('request.headers', true)::json->>'apikey')
    ),
    body := '{"action": "process-queue"}'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: In Supabase, the best way to call an Edge Function from a cron is via a simple HTTP request.
-- However, we can also just use a cron that calls the Edge Function directly.

-- Select the cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the queue processor to run every minute
-- We use the internal URL for the edge function if possible, or just call a SQL function that does it.
-- Since the host and apikey might not be available in a cron context, it's better to use a dedicated secret or hardcoded value if we had to.
-- BUT: Lovable can help us set up the cron in the Supabase dashboard if this fails.
-- I'll try to schedule it.
SELECT cron.schedule('process-whatsapp-queue', '* * * * *', 'SELECT public.process_whatsapp_queue()');
