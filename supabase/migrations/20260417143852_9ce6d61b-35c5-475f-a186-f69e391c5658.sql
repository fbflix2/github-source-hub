-- 1. SECURITY: Block any user from broadcasting global notifications
DROP POLICY IF EXISTS "Users can insert global notifications" ON public.notifications;

-- (Staff already has full ALL access via "Staff can manage notifications")

-- 2. DATA MIGRATION: copy AccFace stock items into supplier_accounts (non-destructive)
DO $$
DECLARE
  v_supplier_id uuid;
  v_batch_id uuid;
  v_folder_id uuid;
  v_count integer;
BEGIN
  -- Find or create AccFace supplier
  SELECT id INTO v_supplier_id FROM public.suppliers WHERE name = 'AccFace' LIMIT 1;
  IF v_supplier_id IS NULL THEN
    INSERT INTO public.suppliers (name, status, notes)
    VALUES ('AccFace', 'active', 'Auto-criado pela integração Fornecedor secreto 1')
    RETURNING id INTO v_supplier_id;
  END IF;

  -- Find AccFace Import folder
  SELECT id INTO v_folder_id FROM public.stock_folders
  WHERE name = 'AccFace Import' AND deleted_at IS NULL LIMIT 1;

  IF v_folder_id IS NULL THEN
    RAISE NOTICE 'Pasta AccFace Import não encontrada, pulando migração histórica';
    RETURN;
  END IF;

  -- Skip if migration was already done
  SELECT COUNT(*) INTO v_count
  FROM public.supplier_batches
  WHERE supplier_id = v_supplier_id AND name = 'Importação histórica - Estoque AccFace';

  IF v_count > 0 THEN
    RAISE NOTICE 'Migração histórica AccFace já executada anteriormente, pulando';
    RETURN;
  END IF;

  -- Create historical batch
  INSERT INTO public.supplier_batches (supplier_id, name, notes)
  VALUES (
    v_supplier_id,
    'Importação histórica - Estoque AccFace',
    'Cópia das contas que estavam na pasta "AccFace Import" do estoque antes da separação dos módulos.'
  )
  RETURNING id INTO v_batch_id;

  -- Copy stock items into supplier_accounts
  INSERT INTO public.supplier_accounts (
    supplier_id, batch_id, login, password, profile_link, status, has_bm, notes
  )
  SELECT
    v_supplier_id,
    v_batch_id,
    COALESCE(si.identification, si.data->>'idPerfil', si.data->>'uid'),
    COALESCE(si.data->>'senha', si.data->>'pass'),
    si.identification_link,
    'aguardando',
    (si.type = 'bm'),
    COALESCE(si.data->>'raw', si.identification)
  FROM public.stock_items si
  WHERE si.folder = v_folder_id::text
    AND si.deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Migrados % contas históricas para supplier_accounts', v_count;
END $$;