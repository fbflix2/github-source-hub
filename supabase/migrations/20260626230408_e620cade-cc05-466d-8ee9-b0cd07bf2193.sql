
CREATE TABLE public.consent_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  event_type TEXT NOT NULL,
  policy_version TEXT,
  preferences JSONB,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_consent_logs_user_id ON public.consent_logs(user_id);
CREATE INDEX idx_consent_logs_event_type ON public.consent_logs(event_type);

GRANT INSERT ON public.consent_logs TO anon;
GRANT SELECT, INSERT ON public.consent_logs TO authenticated;
GRANT ALL ON public.consent_logs TO service_role;

ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert consent logs"
ON public.consent_logs FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Users can view their own consent logs"
ON public.consent_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.data_subject_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  request_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  details TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dsr_user_id ON public.data_subject_requests(user_id);
CREATE INDEX idx_dsr_status ON public.data_subject_requests(status);

GRANT SELECT, INSERT ON public.data_subject_requests TO authenticated;
GRANT ALL ON public.data_subject_requests TO service_role;

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests"
ON public.data_subject_requests FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own requests"
ON public.data_subject_requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update requests"
ON public.data_subject_requests FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_dsr_updated_at
BEFORE UPDATE ON public.data_subject_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
