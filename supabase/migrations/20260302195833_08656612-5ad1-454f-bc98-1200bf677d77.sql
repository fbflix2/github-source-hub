UPDATE subscriptions 
SET end_date = '2026-04-01 11:10:00+00',
    raw_data = jsonb_set(
      COALESCE(raw_data, '{}'::jsonb),
      '{exchange_quota_free}',
      '2'::jsonb
    )
WHERE id = 'b2fb8ee6-1bbb-4beb-a59d-c2a7bdd17af4';