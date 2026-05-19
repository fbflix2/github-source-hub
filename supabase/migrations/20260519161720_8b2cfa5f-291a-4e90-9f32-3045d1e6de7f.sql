-- Corrigir o primeiro item do pedido com o ID correto do lote P4670
UPDATE public.order_items oi
SET delivery_data = COALESCE(si.data, '{}'::jsonb)
  || jsonb_build_object(
    'stock_item_id', si.id,
    'name', si.name,
    'linkPerfil', si.identification_link,
    'bmLinks', jsonb_build_array(si.identification_link)
  )
FROM public.stock_items si
WHERE oi.id = '8949e693-cf3a-40cc-a9a4-16d40750950e'
  AND si.id = '0cbb4cb4-b899-4a5d-9c71-ab6f1e8a313c';

UPDATE public.stock_items
SET status = 'vendido', order_item_id = '8949e693-cf3a-40cc-a9a4-16d40750950e'
WHERE id = '0cbb4cb4-b899-4a5d-9c71-ab6f1e8a313c';

-- Garantir que os itens errados M2803 fiquem desvinculados e fora desta venda
UPDATE public.stock_items
SET status = 'available', order_item_id = NULL
WHERE id IN (
  '6e603826-270f-496c-b9ae-bc457f047398',
  '303f93fa-43dd-412c-a115-069108149692'
);

-- Recalcular o estoque do produto pela regra atual de entrega automática: status revisado e sem pedido
UPDATE public.products
SET stock = (
    SELECT COUNT(*)
    FROM public.stock_items
    WHERE product_id = '9dfefc59-2465-49e9-902d-2bac191b287d'
      AND status = 'revisado'
      AND order_item_id IS NULL
      AND deleted_at IS NULL
  ),
  available = (
    SELECT COUNT(*) > 0
    FROM public.stock_items
    WHERE product_id = '9dfefc59-2465-49e9-902d-2bac191b287d'
      AND status = 'revisado'
      AND order_item_id IS NULL
      AND deleted_at IS NULL
  )
WHERE id = '9dfefc59-2465-49e9-902d-2bac191b287d';