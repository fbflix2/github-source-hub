-- Order ORD-MPMXOC4E item that lacked product_id (was inserted with raw name)
UPDATE public.order_items
SET product_id = '2c6f6e5f-699c-43cb-a759-eecff70da854',
    delivery_data = COALESCE(delivery_data, '{}'::jsonb) || jsonb_build_object('fulfilled', true, 'type', 'proxy_contract')
WHERE id = 'cc4b5d36-ba99-4305-9fa2-cdd54ceb08fb';

-- Also link the other completed proxy items that were inserted without product_id
UPDATE public.order_items
SET product_id = '2c6f6e5f-699c-43cb-a759-eecff70da854',
    delivery_data = COALESCE(delivery_data, '{}'::jsonb) || jsonb_build_object('fulfilled', true)
WHERE id IN (
  '71cc68ba-8539-4a23-8870-bb8ffc6e0e5d',
  '1edb1131-d91f-480d-b022-a36cbbf488c2',
  'aea3c1b3-69b0-4980-853a-7ac8ac44bec4',
  'fb5db4d3-b1fb-43b0-832c-341f51b15427',
  '16c41348-97a8-43a2-a3f3-fbb0e7d0bbc6'
);

-- The "PROXY HTTP IPV6 ALTA DEMANDA" items → product 0f469662
UPDATE public.order_items
SET product_id = '0f469662-a5ce-4761-ba70-07aab27fdf0b',
    delivery_data = COALESCE(delivery_data, '{}'::jsonb) || jsonb_build_object('fulfilled', true)
WHERE id = '28567aad-e6ed-44a4-8fd0-f22042e0490c';

-- The web scraping orphan
UPDATE public.order_items
SET product_id = 'e22acc24-d124-4cad-9b65-1095021d471f',
    delivery_data = COALESCE(delivery_data, '{}'::jsonb) || jsonb_build_object('fulfilled', true)
WHERE id = '843c97a4-f13e-4096-8810-06b60ee38bfb';
