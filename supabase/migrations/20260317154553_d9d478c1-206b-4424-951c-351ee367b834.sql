
-- Table for internal proxy configurations (staff-only)
CREATE TABLE public.internal_proxy_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT 'Proxy Interno BR',
  provider_slug text NOT NULL DEFAULT 'webshare',
  country_code text NOT NULL DEFAULT 'BR',
  host text,
  converted_host text,
  http_port integer NOT NULL DEFAULT 80,
  socks5_port integer NOT NULL DEFAULT 1080,
  alt_http_port integer NOT NULL DEFAULT 3128,
  username text,
  password text,
  source text NOT NULL DEFAULT 'webshare_auto',
  status text NOT NULL DEFAULT 'active',
  notes text,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_proxy_configs ENABLE ROW LEVEL SECURITY;

-- Staff-only access
CREATE POLICY "Staff can manage internal proxy configs"
  ON public.internal_proxy_configs
  FOR ALL
  USING (public.is_staff(auth.uid()));

-- Auto-update timestamp
CREATE TRIGGER update_internal_proxy_configs_updated_at
  BEFORE UPDATE ON public.internal_proxy_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
