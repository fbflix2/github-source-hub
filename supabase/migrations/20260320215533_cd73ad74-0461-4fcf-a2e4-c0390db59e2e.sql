
-- Insert Gustavo Davi as ct_client on Black Pro plan
INSERT INTO ct_clients (user_id, plan_id, status, start_date, next_billing, monthly_value, telegram)
VALUES (
  'ecb138ec-4e43-43a2-9a61-7f889088aabf',
  '50fe47a7-d81c-41db-a448-d9e0b517bd95',
  'ativo',
  '2026-03-17',
  '2026-04-17',
  5000,
  NULL
);

-- Insert his structure items based on Black Pro plan (3 perfis, 6 proxies, 4 bms, 20 contas)
DO $$
DECLARE
  v_client_id uuid;
  i integer;
BEGIN
  SELECT id INTO v_client_id FROM ct_clients WHERE user_id = 'ecb138ec-4e43-43a2-9a61-7f889088aabf' ORDER BY created_at DESC LIMIT 1;

  -- 3 Perfis
  FOR i IN 1..3 LOOP
    INSERT INTO ct_items (ct_client_id, type, status, identifier) VALUES (v_client_id, 'perfil', 'ativo', 'Perfil ' || i);
  END LOOP;

  -- 6 Proxies
  FOR i IN 1..6 LOOP
    INSERT INTO ct_items (ct_client_id, type, status, identifier, metadata) VALUES (v_client_id, 'proxy', 'ativo', 'Proxy BR Dedicado ' || i, '{"swaps_remaining": 4, "swaps_total": 4}'::jsonb);
  END LOOP;

  -- 4 BMs
  INSERT INTO ct_items (ct_client_id, type, status, identifier) VALUES (v_client_id, 'bm', 'ativo', 'BM Matriz 1');
  INSERT INTO ct_items (ct_client_id, type, status, identifier) VALUES (v_client_id, 'bm', 'ativo', 'BM Matriz 2');
  INSERT INTO ct_items (ct_client_id, type, status, identifier) VALUES (v_client_id, 'bm', 'ativo', 'BM Reserva 1');
  INSERT INTO ct_items (ct_client_id, type, status, identifier) VALUES (v_client_id, 'bm', 'ativo', 'BM Reserva 2');

  -- 20 Contas de anúncio
  FOR i IN 1..20 LOOP
    INSERT INTO ct_items (ct_client_id, type, status, identifier) VALUES (v_client_id, 'conta', 'ativo', 'Conta de Anúncio ' || i);
  END LOOP;
END $$;
