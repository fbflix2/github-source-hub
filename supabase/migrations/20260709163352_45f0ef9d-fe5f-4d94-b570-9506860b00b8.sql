-- Link table between Scale Pro subscriptions and proxy subscriptions
CREATE TABLE public.ct_client_proxies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ct_client_id uuid NOT NULL REFERENCES public.ct_clients(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ct_client_proxies_active_subscription_unique UNIQUE (subscription_id, released_at)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ct_client_proxies TO authenticated;
GRANT ALL ON public.ct_client_proxies TO service_role;

ALTER TABLE public.ct_client_proxies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam ct_client_proxies"
  ON public.ct_client_proxies FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Cliente vê proxies do seu Scale Pro"
  ON public.ct_client_proxies FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ct_clients cc
    WHERE cc.id = ct_client_proxies.ct_client_id AND cc.user_id = auth.uid()
  ));

CREATE INDEX idx_ct_client_proxies_ct_client ON public.ct_client_proxies(ct_client_id);
CREATE INDEX idx_ct_client_proxies_subscription ON public.ct_client_proxies(subscription_id);

CREATE TRIGGER update_ct_client_proxies_updated_at
  BEFORE UPDATE ON public.ct_client_proxies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Marca proxies inclusos em Scale Pro (não cobrar individualmente)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS included_in_ct_client_id uuid REFERENCES public.ct_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_included_ct ON public.subscriptions(included_in_ct_client_id) WHERE included_in_ct_client_id IS NOT NULL;