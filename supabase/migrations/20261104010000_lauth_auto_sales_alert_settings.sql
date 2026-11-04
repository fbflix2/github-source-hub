-- Lauth sale notifications: automatic alerts, manual folder movement approval only.
CREATE TABLE IF NOT EXISTS public.lauth_automation_settings (
 id integer PRIMARY KEY DEFAULT 1 CHECK (id=1),
 alerts_enabled boolean NOT NULL DEFAULT true,
 movement_requires_approval boolean NOT NULL DEFAULT true CHECK (movement_requires_approval = true),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.lauth_automation_settings(id,alerts_enabled,movement_requires_approval)
 VALUES (1,true,true)
 ON CONFLICT(id) DO UPDATE SET alerts_enabled=true,movement_requires_approval=true,updated_at=now();
ALTER TABLE public.lauth_automation_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lauth_automation_settings FROM anon,authenticated;
CREATE TABLE IF NOT EXISTS public.lauth_auto_alerts (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','sent','failed')),
 profile_ids text[] NOT NULL DEFAULT '{}',
 message_id text,
 error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz
);
ALTER TABLE public.lauth_auto_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lauth_auto_alerts FROM anon,authenticated;
