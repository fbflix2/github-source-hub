-- Retroactively create 2 supplier_batches for today's manual purchases
-- and populate supplier_accounts from existing stock_items.data

DO $$
DECLARE
  v_supplier_id uuid := '06dab98f-81f4-4d4d-ad81-60c3178cd0da'; -- AccFace
  v_batch_indo uuid := gen_random_uuid();
  v_batch_vv7 uuid := gen_random_uuid();
  v_item record;
BEGIN
  -- BATCH 1: INDONESIA (10 items, today 13:14)
  INSERT INTO supplier_batches (id, supplier_id, name, notes, created_by, created_at)
  VALUES (
    v_batch_indo,
    v_supplier_id,
    'INDONESIA CỔ (2010-2023) - LIVE ADS - NO2FA (2026-04-17 13:14)',
    'Compra retroativa via Blocagem. ID produto: 11573 | Custo unit.: R$ 12.02 | 10 itens',
    NULL,
    '2026-04-17 13:14:09.519761+00'
  );

  -- Insert supplier_accounts for INDONESIA stock_items
  FOR v_item IN
    SELECT id, name, data, created_at
    FROM stock_items
    WHERE folder = '6564d612-5c16-466d-ba90-ba6c0d857382'
      AND created_at = '2026-04-17 13:14:09.519761+00'
      AND (data->>'accfaceProductId') = '11573'
  LOOP
    INSERT INTO supplier_accounts (
      supplier_id, batch_id, login, password, profile_link,
      status, has_bm, notes, created_at
    ) VALUES (
      v_supplier_id,
      v_batch_indo,
      v_item.data->>'idPerfil',
      v_item.data->>'pass',
      CASE
        WHEN (v_item.data->>'idPerfil') ~ '^\d{6,}$'
        THEN 'https://facebook.com/profile.php?id=' || (v_item.data->>'idPerfil')
        ELSE NULL
      END,
      'aguardando',
      false,
      v_item.data->>'raw',
      v_item.created_at
    );
  END LOOP;

  -- BATCH 2: VV7 (1 item, today 14:12)
  INSERT INTO supplier_batches (id, supplier_id, name, notes, created_by, created_at)
  VALUES (
    v_batch_vv7,
    v_supplier_id,
    'VV7 - Clone Name US - VN 2FA (2026-04-17 14:12)',
    'Compra retroativa via Blocagem. ID produto: 10002 | Custo unit.: R$ 0.64 | 1 item',
    NULL,
    '2026-04-17 14:12:48.881749+00'
  );

  FOR v_item IN
    SELECT id, name, data, created_at
    FROM stock_items
    WHERE folder = '6564d612-5c16-466d-ba90-ba6c0d857382'
      AND created_at = '2026-04-17 14:12:48.881749+00'
      AND (data->>'accfaceProductId') = '10002'
  LOOP
    INSERT INTO supplier_accounts (
      supplier_id, batch_id, login, password, profile_link,
      status, has_bm, notes, created_at
    ) VALUES (
      v_supplier_id,
      v_batch_vv7,
      v_item.data->>'idPerfil',
      v_item.data->>'pass',
      CASE
        WHEN (v_item.data->>'idPerfil') ~ '^\d{6,}$'
        THEN 'https://facebook.com/profile.php?id=' || (v_item.data->>'idPerfil')
        ELSE NULL
      END,
      'aguardando',
      false,
      v_item.data->>'raw',
      v_item.created_at
    );
  END LOOP;
END $$;