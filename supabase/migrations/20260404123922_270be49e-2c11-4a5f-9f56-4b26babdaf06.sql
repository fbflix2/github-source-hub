CREATE TABLE public.fb_finance_custos_pessoais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'fixo',
  categoria text NOT NULL DEFAULT 'moradia',
  dia_vencimento integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  notas text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fb_finance_custos_pessoais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage fb_finance_custos_pessoais"
  ON public.fb_finance_custos_pessoais
  FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));