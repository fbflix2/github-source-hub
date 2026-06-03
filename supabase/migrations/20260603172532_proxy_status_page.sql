CREATE TABLE IF NOT EXISTS public.proxy_status_checks (
  id bigserial PRIMARY KEY,
  service text NOT NULL,
  status text NOT NULL CHECK (status IN ('operational','degraded','down','unknown')),
  latency_ms integer,
  http_status integer,
  message text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proxy_status_checks_service_time
  ON public.proxy_status_checks(service, checked_at DESC);

GRANT SELECT ON public.proxy_status_checks TO anon, authenticated;
GRANT ALL ON public.proxy_status_checks TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.proxy_status_checks_id_seq TO service_role;

ALTER TABLE public.proxy_status_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read status checks"
  ON public.proxy_status_checks FOR SELECT
  TO anon, authenticated
  USING (true);
