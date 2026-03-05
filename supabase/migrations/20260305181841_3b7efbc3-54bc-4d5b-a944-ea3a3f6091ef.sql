
-- Fix replacement for order ORD-MMCAQUN3
-- 1. Link the new stock item to the order_item
UPDATE stock_items
SET order_item_id = '659788bf-99cf-4c39-aa96-c1dd6105f30e'
WHERE id = '1d7a1a04-7dc7-403e-b39c-131b3a3a047f';

-- 2. Update delivery_data on the order_item with the new item's data
UPDATE order_items
SET delivery_data = (
  SELECT jsonb_build_object(
    'nomePerfil', si.data->>'nomePerfil',
    'emailAcesso', si.data->>'emailAcesso',
    'senhaEmail', si.data->>'senhaEmail',
    'senha', si.data->>'senha',
    'token2fa', si.data->>'token2fa',
    'emailAlternativo', si.data->>'emailAlternativo',
    'dataNascimento', si.data->>'dataNascimento',
    'genero', si.data->>'genero',
    'tempoPlataforma', si.data->>'tempoPlataforma',
    'descricao', si.data->>'descricao',
    'cookies', si.data->'cookies',
    'linkDocumento', si.data->>'linkDocumento',
    'foto_url', si.data->>'foto_url',
    'statusAtual', si.data->>'statusAtual',
    'tags', si.data->'tags',
    'nomeProduto', si.data->>'nomeProduto',
    'preco', si.data->>'preco',
    'categoryId', si.data->>'categoryId',
    'idPerfil', si.identification,
    'linkPerfil', si.identification_link
  )
  FROM stock_items si
  WHERE si.id = '1d7a1a04-7dc7-403e-b39c-131b3a3a047f'
)
WHERE id = '659788bf-99cf-4c39-aa96-c1dd6105f30e';
