
-- Fb Finance Config (senha + percentuais globais)
CREATE TABLE public.fb_finance_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  password_hash text NOT NULL,
  distribution_percentages jsonb NOT NULL DEFAULT '{"capital_giro": 2, "fundos_reserva": 15, "dividendos": 1, "operacional": 80, "dia_a_dia": 2}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fb_finance_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage fb_finance_config" ON public.fb_finance_config FOR ALL TO authenticated USING (is_staff(auth.uid()));

-- Fb Finance Caixas/Envelopes
CREATE TABLE public.fb_finance_caixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  saldo_atual numeric NOT NULL DEFAULT 0,
  alvo_percent numeric NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'empresa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fb_finance_caixas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage fb_finance_caixas" ON public.fb_finance_caixas FOR ALL TO authenticated USING (is_staff(auth.uid()));

-- Fb Finance Lançamentos
CREATE TABLE public.fb_finance_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL DEFAULT 'empresa',
  categoria text NOT NULL DEFAULT 'outros',
  descricao text,
  entrada numeric NOT NULL DEFAULT 0,
  saida numeric NOT NULL DEFAULT 0,
  caixa_destino_id uuid REFERENCES public.fb_finance_caixas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fb_finance_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage fb_finance_lancamentos" ON public.fb_finance_lancamentos FOR ALL TO authenticated USING (is_staff(auth.uid()));

-- Fb Finance Distribuições Diárias
CREATE TABLE public.fb_finance_distribuicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT CURRENT_DATE,
  entrada_dia numeric NOT NULL DEFAULT 0,
  percentuais jsonb NOT NULL DEFAULT '{}'::jsonb,
  valores_alocados jsonb NOT NULL DEFAULT '{}'::jsonb,
  aplicado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fb_finance_distribuicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage fb_finance_distribuicoes" ON public.fb_finance_distribuicoes FOR ALL TO authenticated USING (is_staff(auth.uid()));

-- Fb Finance Despesas Planejadas
CREATE TABLE public.fb_finance_despesas_planejadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  dia_vencimento integer NOT NULL DEFAULT 1,
  categoria text NOT NULL DEFAULT 'fixo',
  pago boolean NOT NULL DEFAULT false,
  mes_ref text NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fb_finance_despesas_planejadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage fb_finance_despesas" ON public.fb_finance_despesas_planejadas FOR ALL TO authenticated USING (is_staff(auth.uid()));

-- Seed default caixas
INSERT INTO public.fb_finance_caixas (nome, alvo_percent, tipo) VALUES
  ('Conta Corrente Pessoal', 0, 'pessoal'),
  ('Fundo Emergência', 0, 'pessoal'),
  ('Investimentos', 0, 'pessoal'),
  ('Estilo de Vida', 0, 'pessoal'),
  ('Janela Oportunidade', 0, 'pessoal'),
  ('Capital de Giro', 2, 'empresa'),
  ('Fundos Reserva/Crise', 15, 'empresa'),
  ('Dividendos', 1, 'empresa'),
  ('Operacional', 80, 'empresa'),
  ('Dia a Dia/Emergências', 2, 'empresa');
