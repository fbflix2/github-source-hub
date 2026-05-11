-- 1. Identify IDs
-- Mariana Raissa: f143781e-a1d8-4bc9-a618-bd3c62bfe0e3
-- ฟารานัส ถนอมพิชัย: 8ba17da8-8b85-4b3e-8d7f-1067ac31fbd0
-- Order Item ID: ffa2f6fd-e438-4ae3-95e8-c705e4ce1c77
-- Replacement ID: 758d22f5-bb0a-4114-a663-5477b0b40a2a

-- 2. Swap statuses in stock_items
UPDATE public.stock_items SET status = 'vendido', order_item_id = 'ffa2f6fd-e438-4ae3-95e8-c705e4ce1c77' WHERE id = 'f143781e-a1d8-4bc9-a618-bd3c62bfe0e3';
UPDATE public.stock_items SET status = 'bloqueado', order_item_id = NULL WHERE id = '8ba17da8-8b85-4b3e-8d7f-1067ac31fbd0';

-- 3. Update the replacement record
UPDATE public.replacements 
SET 
  item_name = 'ฟารานัส ถนอมพิชัย', 
  stock_item_id = '8ba17da8-8b85-4b3e-8d7f-1067ac31fbd0',
  new_stock_item_id = 'f143781e-a1d8-4bc9-a618-bd3c62bfe0e3'
WHERE id = '758d22f5-bb0a-4114-a663-5477b0b40a2a';

-- 4. Update order_items delivery_data with Mariana's credentials
UPDATE public.order_items
SET delivery_data = (
  SELECT jsonb_build_object(
    'nomePerfil', data->>'nomePerfil',
    'emailAcesso', data->>'emailAcesso',
    'senhaEmail', data->>'senhaEmail',
    'senha', data->>'senha',
    'token2fa', data->>'token2fa',
    'emailAlternativo', data->>'emailAlternativo',
    'dataNascimento', data->>'dataNascimento',
    'genero', data->>'genero',
    'tempoPlataforma', data->>'tempoPlataforma',
    'descricao', data->>'descricao',
    'cookies', data->'cookies',
    'linkPerfil', identification_link,
    'idPerfil', identification,
    '_replaced', true,
    '_replaced_at', now(),
    '_replacement_stock_item_id', 'f143781e-a1d8-4bc9-a618-bd3c62bfe0e3',
    '_replacement_old_stock_item_id', '8ba17da8-8b85-4b3e-8d7f-1067ac31fbd0'
  )
  FROM public.stock_items 
  WHERE id = 'f143781e-a1d8-4bc9-a618-bd3c62bfe0e3'
)
WHERE id = 'ffa2f6fd-e438-4ae3-95e8-c705e4ce1c77';