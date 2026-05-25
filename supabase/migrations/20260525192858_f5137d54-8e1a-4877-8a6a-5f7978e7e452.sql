-- 1. Associar o item de estoque ao item do pedido
UPDATE public.stock_items 
SET 
  order_item_id = '84950435-7622-4fe1-9b16-fd0c91e7b9d2',
  status = 'vendido',
  updated_at = now()
WHERE id = '4993d3dd-e92a-4b2d-9ae2-f531bd3f3045';

-- 2. Atualizar os dados de entrega no order_items (sem updated_at)
UPDATE public.order_items
SET 
  delivery_data = '{"identification_link": "https://business.facebook.com/invitation/?token=AfkNM3Hl1F6-8DDgJWlL9PpXheZe57qgSw8as2aOVvGO-8uQObwkbsyVQt5DwXPtt9W4NM3fdI6LV7qVO7ET-pCLfIYy--fBI5izjL21M0DpIz3Kkrk100mnAbQoh4U25s01cg6lhQAs4sLk-zUHIJAa6-Df2rm9yEQZA2FZkX3nCiGZT5vMEqeckv_rWltUxOgQ3LTHU2Elki3ZLezGiprJLQ8HWgtRUluZUt1esmiIAI3kAKM_yBL0kR8YvfyDr8dqkwwGqlFREK5kYCunhxh189P_qQOY", "name": "BM #4"}'::jsonb
WHERE id = '84950435-7622-4fe1-9b16-fd0c91e7b9d2';

-- 3. Marcar o pedido como concluído
UPDATE public.orders
SET 
  status = 'completed',
  updated_at = now()
WHERE id = 'd384cf95-1015-4046-b6aa-46d33774c24a';