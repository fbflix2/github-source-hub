
-- 1) purchase_requests: restrict to authenticated
DROP POLICY IF EXISTS "Suppliers can view open purchase requests" ON public.purchase_requests;
CREATE POLICY "Suppliers can view open purchase requests"
ON public.purchase_requests
FOR SELECT
TO authenticated
USING (status = 'open');

-- 2) tutorial_feedback: remove broad read, keep owner + admin via existing admin policy
DROP POLICY IF EXISTS "Anyone authenticated can read tutorial feedback" ON public.tutorial_feedback;
CREATE POLICY "Users can read their own tutorial feedback"
ON public.tutorial_feedback
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 3) Make documents bucket private and drop public read policy
UPDATE storage.buckets SET public = false WHERE id = 'documents';
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;

-- 4) Fix function search_path
CREATE OR REPLACE FUNCTION public.check_supplier_token(token text)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $function$
    SELECT id FROM public.suppliers WHERE access_token = token AND status = 'active';
$function$;

CREATE OR REPLACE FUNCTION public.process_whatsapp_queue()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1/wapi-send',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bmxlcmtleWdmdmRuem5veGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDQ1NTAsImV4cCI6MjA4NzAyMDU1MH0.CTNgMcfo3AdbiiKIONkE0svroKgekXQ4x71bDpqwEV8"}'::jsonb,
    body := '{"action": "process-queue"}'::jsonb
  );
END;
$function$;
