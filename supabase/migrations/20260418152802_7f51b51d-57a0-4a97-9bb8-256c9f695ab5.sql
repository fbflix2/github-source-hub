DO $$
DECLARE
  primary_id uuid;
BEGIN
  SELECT id INTO primary_id
  FROM public.fb_finance_config
  ORDER BY created_at ASC, id ASC
  LIMIT 1;

  IF primary_id IS NULL THEN
    RAISE EXCEPTION 'fb_finance_config must contain at least one row before consolidation';
  END IF;

  UPDATE public.fb_finance_config AS target
  SET
    capital_giro_debt = src.capital_giro_debt,
    distribution_percentages = src.distribution_percentages,
    personal_distribution_percentages = src.personal_distribution_percentages,
    password_hash = COALESCE(NULLIF(target.password_hash, ''), src.password_hash),
    updated_at = now()
  FROM (
    SELECT
      COALESCE(
        (
          SELECT capital_giro_debt
          FROM public.fb_finance_config
          WHERE capital_giro_debt <> 0
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 1
        ),
        0
      ) AS capital_giro_debt,
      COALESCE(
        (
          SELECT distribution_percentages
          FROM public.fb_finance_config
          WHERE distribution_percentages IS NOT NULL
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 1
        ),
        '{"dia_a_dia": 2, "dividendos": 1, "operacional": 80, "capital_giro": 2, "fundos_reserva": 15}'::jsonb
      ) AS distribution_percentages,
      COALESCE(
        (
          SELECT personal_distribution_percentages
          FROM public.fb_finance_config
          WHERE personal_distribution_percentages IS NOT NULL
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 1
        ),
        '{"dia_a_dia": 30, "estilo_vida": 15, "investimentos": 20, "fundo_emergencia": 20, "janela_oportunidade": 15}'::jsonb
      ) AS personal_distribution_percentages,
      (
        SELECT password_hash
        FROM public.fb_finance_config
        WHERE password_hash IS NOT NULL AND password_hash <> ''
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      ) AS password_hash
  ) AS src
  WHERE target.id = primary_id;

  DELETE FROM public.fb_finance_config
  WHERE id <> primary_id;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS fb_finance_config_singleton_idx
ON public.fb_finance_config ((true));