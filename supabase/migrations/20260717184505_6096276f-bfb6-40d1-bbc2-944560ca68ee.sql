
CREATE TABLE public.marketplace_bms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text NOT NULL DEFAULT 'Brasil',
  code text NOT NULL DEFAULT 'BR',
  bm_id text,
  verification text NOT NULL DEFAULT 'Rodada',
  limit_daily text NOT NULL DEFAULT '',
  accounts int NOT NULL DEFAULT 5,
  created_year text NOT NULL DEFAULT '2024',
  risk text NOT NULL DEFAULT 'BAIXO',
  method text NOT NULL DEFAULT 'Cartão',
  gasto_total numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_bms TO anon, authenticated;
GRANT ALL ON public.marketplace_bms TO service_role, authenticated;
ALTER TABLE public.marketplace_bms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active mkt bms" ON public.marketplace_bms FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage mkt bms" ON public.marketplace_bms FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.marketplace_bm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_name text NOT NULL,
  seller_whatsapp text NOT NULL,
  bm_name text NOT NULL,
  country text NOT NULL DEFAULT 'Brasil',
  verification text,
  limit_daily text,
  accounts int,
  created_year text,
  risk text,
  method text,
  gasto_total numeric,
  asking_price numeric NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'novo',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.marketplace_bm_leads TO anon, authenticated;
GRANT ALL ON public.marketplace_bm_leads TO service_role, authenticated;
ALTER TABLE public.marketplace_bm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can submit lead" ON public.marketplace_bm_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "admin read leads" ON public.marketplace_bm_leads FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update leads" ON public.marketplace_bm_leads FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete leads" ON public.marketplace_bm_leads FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Seed do catálogo
INSERT INTO public.marketplace_bms (name, verification, limit_daily, accounts, created_year, risk, method, gasto_total, price, sort_order) VALUES
('Dentista O Sane','Rodada','R$ 2.241 / dia',5,'2024','BAIXO','Cartão',16853.61,2000,1),
('Dra. Ingrid','Rodada','R$ 1.309 / dia',5,'2024','BAIXO','Cartão',14276.59,1800,2),
('Refrigera Max 1','Rodada','R$ 1.310 / dia',5,'2025','BAIXO','Cartão',12883.26,1600,3),
('BM 2022','Rodada Verificada','R$ 4.973 / dia',19,'2022','ALTO HISTÓRICO','Cartão',80099.94,3000,4),
('Debo M','Rodada','R$ 1.264 / dia',5,'2025','BAIXO','Cartão',18222.93,2000,5),
('Agência Karina','Rodada','R$ 1.264 / dia',5,'2023','BAIXO','Cartão',13385.93,1800,6),
('DC Estratégico','Rodada','R$ 1.307 / dia',5,'2020','BAIXO','Cartão',2298.74,1200,7),
('BM Live','Rodada','R$ 1.307 / dia',5,'2023','BAIXO','Cartão',7746.70,1800,8),
('Alpha Anúncios','Rodada','R$ 1.294 / dia',5,'2021','BAIXO','Cartão',30.01,600,9),
('BM Mariana','Rodada Verificada','R$ 2.109 / dia',5,'2024','VERIFICADA','Cartão',18645.87,2000,10),
('JOAB Vieira Feitosa','Rodada Verificada','R$ 2.287 / dia',5,'2026','VERIFICADA','Cartão',4185.12,1200,11),
('RUMA','Rodada','R$ 1.289 / dia',5,'2020','BAIXO','Cartão',3161.49,1200,12),
('BALLI','Rodada','No Limit',5,'2021','PREMIUM','Cartão / Pré-paga',25424.29,600,13);
