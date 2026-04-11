
CREATE TABLE public.pipeline_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  track_days INTEGER NOT NULL DEFAULT 7,
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pipelines"
  ON public.pipeline_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can manage pipelines"
  ON public.pipeline_templates FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

INSERT INTO public.pipeline_templates (name, description, track_days, tasks, is_active, position)
VALUES (
  'Esteira do Cliente (7 Dias)',
  'Tarefas que aparecem na esteira de aquecimento do cliente',
  7,
  '[
    {"title": "Login e confirmação", "description": "Para evitar bloqueio logar via cookies de preferência, verificar se não há restrições, Evite fazer qualquer atividade de segurança"},
    {"title": "Navegar organicamente", "description": "Role o feed por um tempo aleatório entre 3-10 minutos, curta 3-5 posts de seu real interesse"},
    {"title": "Configurar página", "description": "Configure sua página comercial com nome de seu produto ou serviço e publique 1-2 posts."},
    {"title": "Adicionar forma de pagamento no BM", "description": "Vá até a BM e configure sua forma de pagamento, cartão recomendado Nubank virtual"},
    {"title": "Engajar e participar em grupos", "description": "Caso tenha solicitações de amizade aceite elas, caso não tenha Envie no máximo de 3 a 5 solicitações de amizade para outros"},
    {"title": "Configure seu BM e conecte sua página", "description": "Conecte sua página no bm configure o Bm de forma completa, confirmando o email no rodapé da bm, preencha os dados"},
    {"title": "Verificar restrições e subir sua campanha", "description": "Verifique se não apareceu nenhuma notificação de restrição da bm, caso não tenha aparecido pode subir sua campanha"}
  ]'::jsonb,
  true,
  0
);

CREATE TRIGGER update_pipeline_templates_updated_at
  BEFORE UPDATE ON public.pipeline_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
