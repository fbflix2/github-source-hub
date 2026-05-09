ALTER TABLE public.pipeline_templates ADD COLUMN category TEXT DEFAULT 'perfil' CHECK (category IN ('perfil', 'bm'));

COMMENT ON COLUMN public.pipeline_templates.category IS 'Categoria da esteira: perfil ou bm';
