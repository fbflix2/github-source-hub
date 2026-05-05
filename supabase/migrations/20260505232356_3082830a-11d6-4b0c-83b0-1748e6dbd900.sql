-- 1. Estornar o valor para o saldo do cliente
UPDATE public.profiles 
SET balance = balance + 22.00 
WHERE user_id = 'fedd9f7c-0c2f-4987-a2a6-c04b831569e4';

-- 2. Registrar a transação de estorno
INSERT INTO public.wallet_transactions (
  user_id, 
  type, 
  title, 
  amount, 
  balance_after, 
  reference_id
)
SELECT 
  'fedd9f7c-0c2f-4987-a2a6-c04b831569e4', 
  'deposit', 
  'Estorno — Pedido ORD-MOOAD3ZW (Proxy não entregue)', 
  22.00, 
  balance, 
  'f2653550-e410-49fd-9ec9-2c3203a24cfe'
FROM public.profiles 
WHERE user_id = 'fedd9f7c-0c2f-4987-a2a6-c04b831569e4';

-- 3. Marcar o item do pedido como cancelado ou erro (opcional, mas bom para histórico)
UPDATE public.order_items
SET delivery_data = '{"status": "error", "reason": "product_inactive", "refunded": true}'::jsonb
WHERE id = '6078b987-6263-4197-b598-01f546807460';