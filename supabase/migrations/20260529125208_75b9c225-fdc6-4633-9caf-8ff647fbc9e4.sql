-- Update the order item
UPDATE public.order_items 
SET 
  product_id = 'f1e3ffa5-38e7-4fd1-a48a-69957a753457',
  name = 'PROXY| IPV6 | HTTP',
  price = 20.00,
  delivery_data = jsonb_build_object(
    'count', 1,
    'fulfilled', false,
    'type', 'webshare_proxy',
    'notes', 'Troca manual solicitada via admin. Proxy anterior: WS-MPOXGICL'
  )
WHERE id = '68e3994a-2adf-4271-8fca-2ef481366623';

-- Record the exchange
INSERT INTO public.product_exchanges (
  order_id,
  order_item_id,
  original_product_id,
  original_product_name,
  new_product_id,
  new_product_name,
  price_difference,
  wallet_adjusted,
  reason,
  performed_by,
  client_user_id,
  client_name
) VALUES (
  '6844887b-f6ae-43da-b224-3ae2071a60cb',
  '68e3994a-2adf-4271-8fca-2ef481366623',
  '6c396fa8-f6a0-43b2-8061-9148213df549',
  'PROXY| IPV4 Contigência Fb',
  'f1e3ffa5-38e7-4fd1-a48a-69957a753457',
  'PROXY| IPV6 | HTTP',
  0,
  false,
  'Troca manual IPv4 -> IPv6 (WS-MPOXGICL). Diferença de valor ignorada.',
  '51d84540-066d-4f6d-b06b-a4c6156474c3', -- Using the ID found in previous turn for performed_by
  '11c86e93-1d59-419c-9ed1-e1ecddee8764',
  'VIVIAN BIANCHI MALACARNE'
);