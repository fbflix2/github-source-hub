-- Atualizar a assinatura com um IP confirmado dos EUA (Buffalo, NY)
UPDATE public.subscriptions 
SET raw_data = raw_data || jsonb_build_object(
  'proxy_address', '198.144.190.43',
  'port', '5890',
  'city_name', 'Buffalo',
  'country_code', 'US',
  'exchange_quota_free', 1
)
WHERE name = 'WS-MOOAD3ZW-USA' AND user_id = 'fedd9f7c-0c2f-4987-a2a6-c04b831569e4';

-- Também atualizar os dados de entrega no pedido para que o cliente veja a mudança lá
UPDATE public.order_items
SET delivery_data = delivery_data || jsonb_build_object(
  'proxy_address', '198.144.190.43',
  'port', '5890',
  'location', 'USA (Buffalo)'
)
WHERE order_id = 'f2653550-e410-49fd-9ec9-2c3203a24cfe';