
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  scope text DEFAULT 'partner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subs" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);

-- Trigger to fire push when partner_referral is created
CREATE OR REPLACE FUNCTION public.notify_partner_sale_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.partners WHERE id = NEW.partner_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := 'https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1/send-partner-push',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bmxlcmtleWdmdmRuem5veGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDQ1NTAsImV4cCI6MjA4NzAyMDU1MH0.CTNgMcfo3AdbiiKIONkE0svroKgekXQ4x71bDpqwEV8"}'::jsonb,
    body := jsonb_build_object(
      'user_id', v_user_id,
      'title', '🎉 Nova venda!',
      'body', 'Você ganhou R$ ' || to_char(NEW.commission_amount, 'FM999G999D00') || ' de comissão',
      'url', '/parceria'
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_partner_sale_push
AFTER INSERT ON public.partner_referrals
FOR EACH ROW EXECUTE FUNCTION public.notify_partner_sale_push();
