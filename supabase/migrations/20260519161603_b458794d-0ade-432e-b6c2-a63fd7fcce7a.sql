-- 1) Devolver os itens M2803 entregues por engano para o estado anterior de disponíveis fora do pedido
UPDATE public.stock_items
SET status = 'available', order_item_id = NULL
WHERE id IN (
  '6e603826-270f-496c-b9ae-bc457f047398',
  '303f93fa-43dd-412c-a115-069108149692'
);

-- 2) Entregar os 2 itens corretos do lote P4670 para o pedido da Aline
WITH chosen AS (
  SELECT *
  FROM public.stock_items
  WHERE id IN (
    '0cbb4cb4-b899-4a5d-9d8b-d774f964c1e9',
    '1d732d42-f0b8-4775-9d8b-d774f964c1e9'
  )
), assign AS (
  SELECT
    c.*,
    CASE
      WHEN c.id = '0cbb4cb4-b899-4a5d-9d8b-d774f964c1e9'::uuid THEN '8949e693-cf3a-40cc-a9a4-16d40750950e'::uuid
      ELSE 'cae2438e-15b6-4623-950e-3ddca232106b'::uuid
    END AS target_order_item_id
  FROM chosen c
)
UPDATE public.order_items oi
SET delivery_data = COALESCE(assign.data, '{}'::jsonb)
  || jsonb_build_object(
    'stock_item_id', assign.id,
    'name', assign.name,
    'linkPerfil', assign.identification_link,
    'bmLinks', jsonb_build_array(assign.identification_link)
  )
FROM assign
WHERE oi.id = assign.target_order_item_id;

WITH assign AS (
  SELECT
    id,
    CASE
      WHEN id = '0cbb4cb4-b899-4a5d-9d8b-d774f964c1e9'::uuid THEN '8949e693-cf3a-40cc-a9a4-16d40750950e'::uuid
      ELSE 'cae2438e-15b6-4623-950e-3ddca232106b'::uuid
    END AS target_order_item_id
  FROM public.stock_items
  WHERE id IN (
    '0cbb4cb4-b899-4a5d-9d8b-d774f964c1e9',
    '1d732d42-f0b8-4775-9d8b-d774f964c1e9'
  )
)
UPDATE public.stock_items si
SET status = 'vendido', order_item_id = assign.target_order_item_id
FROM assign
WHERE si.id = assign.id;

-- 3) Deixar os demais itens P4670 do produto disponíveis para a automação correta (status revisado)
UPDATE public.stock_items
SET status = 'revisado', order_item_id = NULL
WHERE product_id = '9dfefc59-2465-49e9-902d-2bac191b287d'
  AND data->>'perfilBackup' = 'P4670'
  AND id NOT IN (
    '0cbb4cb4-b899-4a5d-9d8b-d774f964c1e9',
    '1d732d42-f0b8-4775-9d8b-d774f964c1e9'
  );

-- 4) Recalcular o estoque visível do produto com base nos itens corretos restantes
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