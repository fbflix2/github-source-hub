-- 0. Tornar profile_id nullable (necessário para preservar histórico de ganhos confirmados)
ALTER TABLE public.operator_earnings ALTER COLUMN profile_id DROP NOT NULL;

-- 1. Desvincular ganhos confirmados do perfil/tarefa antes de apagar (preserva saldo)
UPDATE public.operator_earnings
SET profile_id = NULL, task_id = NULL
WHERE status = 'confirmed';

-- 2. Apagar ganhos pendentes/cancelados (não confirmados)
DELETE FROM public.operator_earnings
WHERE status <> 'confirmed';

-- 3. Apagar notas rápidas dos perfis (se a tabela existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='warming_quick_notes') THEN
    EXECUTE 'DELETE FROM public.warming_quick_notes';
  END IF;
END $$;

-- 4. Apagar registros de qualidade manual (se a tabela existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='warming_profile_quality') THEN
    EXECUTE 'DELETE FROM public.warming_profile_quality';
  END IF;
END $$;

-- 5. Apagar todas as tarefas de aquecimento
DELETE FROM public.warming_tasks;

-- 6. Apagar todos os perfis de aquecimento
DELETE FROM public.warming_profiles;