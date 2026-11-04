-- One consolidated WhatsApp report daily at 00:00 America/Sao_Paulo (03:00 UTC).
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS public.lauth_daily_reports (
 report_date date PRIMARY KEY,
 status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','sent','failed')),
 profile_count integer NOT NULL DEFAULT 0,
 error text,
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lauth_daily_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lauth_daily_reports FROM anon,authenticated;
CREATE TABLE IF NOT EXISTS private.lauth_report_auth (
 id integer PRIMARY KEY DEFAULT 1 CHECK(id=1),
 secret text NOT NULL
);
REVOKE ALL ON private.lauth_report_auth FROM PUBLIC,anon,authenticated;
INSERT INTO private.lauth_report_auth(id,secret) VALUES(1,encode(gen_random_bytes(32),'hex')) ON CONFLICT(id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.verify_lauth_daily_report_secret(p_secret text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM private.lauth_report_auth WHERE id=1 AND secret=p_secret AND length(p_secret)=64);
$$;
REVOKE ALL ON FUNCTION public.verify_lauth_daily_report_secret(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_lauth_daily_report_secret(text) TO service_role;
CREATE OR REPLACE FUNCTION private.dispatch_lauth_daily_report()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text;
BEGIN
 SELECT secret INTO token FROM private.lauth_report_auth WHERE id=1;
 PERFORM net.http_post(
  url:='https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1/lauth-sold-alert',
  headers:=jsonb_build_object('Content-Type','application/json','x-lauth-daily-secret',token),
  body:='{"action":"daily-report"}'::jsonb,
  timeout_milliseconds:=15000
 );
END;
$$;
REVOKE ALL ON FUNCTION private.dispatch_lauth_daily_report() FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('fbflix-lauth-daily-report-midnight-brasilia','0 3 * * *',$$SELECT private.dispatch_lauth_daily_report();$$);
