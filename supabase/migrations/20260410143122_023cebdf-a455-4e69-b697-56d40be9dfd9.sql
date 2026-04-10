-- Templates de mensagens WhatsApp
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_key TEXT NOT NULL, -- proxy_expiring, proxy_cancelled, password_reset, promo, custom, general
  name TEXT NOT NULL,
  message_body TEXT NOT NULL, -- suporta placeholders: {{nome}}, {{produto}}, {{valor}}, {{data}}, {{link}}
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage templates"
  ON public.whatsapp_templates FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Logs de envio de mensagens WhatsApp
CREATE TABLE public.whatsapp_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  user_id UUID, -- destinatário (pode ser nulo para envios avulsos)
  phone TEXT NOT NULL,
  message_sent TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, sent, delivered, read, failed
  wapi_message_id TEXT,
  error_message TEXT,
  event_key TEXT, -- referência rápida do tipo de evento
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view logs"
  ON public.whatsapp_logs FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert logs"
  ON public.whatsapp_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- Service role também pode inserir (para cron jobs e edge functions)
CREATE POLICY "Service can insert logs"
  ON public.whatsapp_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service can update logs"
  ON public.whatsapp_logs FOR UPDATE
  TO service_role
  USING (true);

-- Trigger updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_logs_updated_at
  BEFORE UPDATE ON public.whatsapp_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();