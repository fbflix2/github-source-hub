
CREATE TABLE public.whatsapp_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut text NOT NULL,
  body text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_qr_shortcut ON public.whatsapp_quick_replies(shortcut);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_quick_replies TO authenticated;
GRANT ALL ON public.whatsapp_quick_replies TO service_role;

ALTER TABLE public.whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view quick replies" ON public.whatsapp_quick_replies
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff manage quick replies" ON public.whatsapp_quick_replies
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_wa_qr_updated_at
BEFORE UPDATE ON public.whatsapp_quick_replies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
