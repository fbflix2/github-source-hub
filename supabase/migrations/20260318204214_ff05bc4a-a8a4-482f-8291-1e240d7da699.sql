
CREATE TABLE public.safe_bm_vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_name TEXT,
  bm_name TEXT NOT NULL,
  bm_link TEXT NOT NULL,
  perfil_backup TEXT,
  purchase_date TIMESTAMPTZ,
  protection_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  link_regenerations INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  subscription_price NUMERIC NOT NULL DEFAULT 9.99,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.safe_bm_vaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage safe_bm_vaults" ON public.safe_bm_vaults FOR ALL TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "Users can view own vaults" ON public.safe_bm_vaults FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_safe_bm_vaults_updated_at 
  BEFORE UPDATE ON public.safe_bm_vaults 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
