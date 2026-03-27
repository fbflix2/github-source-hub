-- Insert missing tasks (days 16-30) for 30_days profiles that only have 15 tasks
-- Using the default 30_days track task definitions

-- First, get the profile IDs that need fixing
WITH profiles_to_fix AS (
  SELECT wp.id as profile_id
  FROM warming_profiles wp
  JOIN (
    SELECT profile_id, MAX(day_number) as max_day
    FROM warming_tasks GROUP BY profile_id
  ) tc ON tc.profile_id = wp.id
  WHERE wp.track_type = '30_days' AND tc.max_day < 30
)
INSERT INTO warming_tasks (profile_id, day_number, title, description)
SELECT pf.profile_id, t.day, t.title, t.description
FROM profiles_to_fix pf
CROSS JOIN (VALUES
  (16, 'Volume R$30', 'Construir volume de gastos.'),
  (17, 'Multi-objetivos R$30', 'Engagement + Conversions + Traffic.'),
  (18, 'Eventos reais R$35', 'Gerar eventos de conversão reais.'),
  (19, 'Escalar R$35', 'Manter escala consistente.'),
  (20, 'BM fully check', 'Verificar BM completo.'),
  (21, 'Ads R$40', 'Escalar para R$40/dia.'),
  (22, 'Lookalike audiences', 'Criar públicos semelhantes.'),
  (23, 'Retargeting R$40', 'Campanhas de retargeting.'),
  (24, 'Volume R$45', 'Aumentar volume.'),
  (25, 'Spike test R$50', 'Testar picos de orçamento.'),
  (26, 'Manutenção R$40', 'Manter orçamento estável.'),
  (27, 'Multi-creatives R$50', 'Variar creatives extensivamente.'),
  (28, 'Ads R$60', 'Escalar agressivamente.'),
  (29, 'Tier 3+ check', 'Mirar tier 3 ou superior.'),
  (30, 'Finalização R$80', 'Teste final com orçamento máximo.')
) AS t(day, title, description)
WHERE NOT EXISTS (
  SELECT 1 FROM warming_tasks wt 
  WHERE wt.profile_id = pf.profile_id AND wt.day_number = t.day
);

-- Re-sync track_days
UPDATE warming_profiles wp
SET track_days = (
  SELECT COUNT(*) FROM warming_tasks wt WHERE wt.profile_id = wp.id
)
WHERE track_type = '30_days'
AND track_days != (SELECT COUNT(*) FROM warming_tasks wt WHERE wt.profile_id = wp.id);