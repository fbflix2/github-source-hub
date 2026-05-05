-- 1. Descontar o valor do saldo do cliente (R$ 21.00 pelo proxy americano)
UPDATE public.profiles 
SET balance = balance - 21.00 
WHERE user_id = 'fedd9f7c-0c2f-4987-a2a6-c04b831569e4';

-- 2. Registrar a transação de débito no extrato
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
  'purchase', 
  'Compra — PROXY| IPV4 Americana Premium (Entrega Manual)', 
  -21.00, 
  balance, 
  'f2653550-e410-49fd-9ec9-2c3203a24cfe'
FROM public.profiles 
WHERE user_id = 'fedd9f7c-0c2f-4987-a2a6-c04b831569e4';

-- 3. Criar a assinatura do proxy para o cliente
INSERT INTO public.subscriptions (
  user_id,
  name,
  status,
  type,
  product_id,
  start_date,
  end_date,
  auto_renew,
  raw_data
) VALUES (
  'fedd9f7c-0c2f-4987-a2a6-c04b831569e4',
  'WS-MOOAD3ZW-USA',
  'active',
  'proxyfbflix',
  'ed9f5577-fdc3-4c35-bdfb-3eb25a4e99b6',
  now(),
  now() + interval '30 days',
  false,
  jsonb_build_object(
    'city_name', 'New York',
    'country_code', 'US',
    'provider', 'proxyfbflix',
    'proxy_address', '104.253.91.81',
    'port', '6514',
    'username', 'fhvaccdh',
    'password', '19ao11w7oapk',
    'type', 'proxy_contract',
    'admin_allocated', true
  )
);

-- 4. Atualizar o item do pedido com os dados de entrega
UPDATE public.order_items
SET delivery_data = jsonb_build_object(
  'fulfilled', true,
  'type', 'proxyfbflix_proxy',
  'proxy_address', '104.253.91.81',
  'port', '6514',
  'username', 'fhvaccdh',
  'password', '19ao11w7oapk',
  'location', 'USA',
  'admin_allocated', true
)
WHERE id = '6078b987-6263-4197-b598-01f546807460';