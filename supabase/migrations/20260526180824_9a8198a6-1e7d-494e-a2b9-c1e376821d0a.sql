-- Provision missing proxy subscriptions for user Nick Paulo (20a4bc36-bcd4-477d-89f5-b347b678417c)
-- We need to deliver:
-- 4x PROXY| IPV4 Contigência Fb
-- 4x PROXY ULTRA BR IPV6 SOCKS5 ALTA DEMANDA
-- 1x PROXY ALTA ROTAÇÃO WEB SCRAPING
-- 2x Additional unit corrections

INSERT INTO public.subscriptions (
    user_id, 
    product_id, 
    name, 
    status, 
    type, 
    start_date, 
    end_date, 
    raw_data, 
    auto_renew
) VALUES 
-- IPv4 Contingência Units
('20a4bc36-bcd4-477d-89f5-b347b678417c', '6c396fa8-f6a0-43b2-8061-9148213df549', 'WS-MANUAL-1', 'active', 'proxyfbflix', now(), now() + interval '30 days', '{"provider": "proxyfbflix", "city_name": "Sao Paulo", "proxy_address": "92.112.172.205", "fbflix_proxy_id": "d-17371142821", "port": 6477, "username": "fhvaccdh", "password": "19ao11w7oapk"}', false),
('20a4bc36-bcd4-477d-89f5-b347b678417c', '6c396fa8-f6a0-43b2-8061-9148213df549', 'WS-MANUAL-2', 'active', 'proxyfbflix', now(), now() + interval '30 days', '{"provider": "proxyfbflix", "city_name": "Sao Paulo", "proxy_address": "92.112.171.118", "fbflix_proxy_id": "d-17371142820", "port": 6086, "username": "fhvaccdh", "password": "19ao11w7oapk"}', false),
('20a4bc36-bcd4-477d-89f5-b347b678417c', '6c396fa8-f6a0-43b2-8061-9148213df549', 'WS-MANUAL-3', 'active', 'proxyfbflix', now(), now() + interval '30 days', '{"provider": "proxyfbflix", "city_name": "Sao Paulo", "proxy_address": "45.39.35.163", "fbflix_proxy_id": "d-17371142814", "port": 5596, "username": "fhvaccdh", "password": "19ao11w7oapk"}', false),
('20a4bc36-bcd4-477d-89f5-b347b678417c', '6c396fa8-f6a0-43b2-8061-9148213df549', 'WS-MANUAL-4', 'active', 'proxyfbflix', now(), now() + interval '30 days', '{"provider": "proxyfbflix", "city_name": "Sao Paulo", "proxy_address": "45.38.101.227", "fbflix_proxy_id": "d-17371142817", "port": 6160, "username": "fhvaccdh", "password": "19ao11w7oapk"}', false),

-- IPv6 Alta Demanda Units
('20a4bc36-bcd4-477d-89f5-b347b678417c', '2c6f6e5f-699c-43cb-a759-eecff70da854', 'WS-MANUAL-5', 'active', 'proxyfbflix', now(), now() + interval '30 days', '{"provider": "proxyfbflix", "city_name": "Fortaleza", "proxy_address": "108.165.197.25", "fbflix_proxy_id": "d-17371142815", "port": 6264, "username": "fhvaccdh", "password": "19ao11w7oapk"}', false),
('20a4bc36-bcd4-477d-89f5-b347b678417c', '2c6f6e5f-699c-43cb-a759-eecff70da854', 'WS-MANUAL-6', 'active', 'proxyfbflix', now(), now() + interval '30 days', '{"provider": "proxyfbflix", "city_name": "Sao Paulo", "proxy_address": "92.112.175.200", "fbflix_proxy_id": "d-17371142802", "port": 6473, "username": "fhvaccdh", "password": "19ao11w7oapk"}', false),
('20a4bc36-bcd4-477d-89f5-b347b678417c', '2c6f6e5f-699c-43cb-a759-eecff70da854', 'WS-MANUAL-7', 'active', 'proxyfbflix', now(), now() + interval '30 days', '{"provider": "proxyfbflix", "city_name": "Rio De Janeiro", "proxy_address": "108.165.63.54", "fbflix_proxy_id": "d-17371142799", "port": 5064, "username": "fhvaccdh", "password": "19ao11w7oapk"}', false),
('20a4bc36-bcd4-477d-89f5-b347b678417c', '2c6f6e5f-699c-43cb-a759-eecff70da854', 'WS-MANUAL-8', 'active', 'proxyfbflix', now(), now() + interval '30 days', '{"provider": "proxyfbflix", "city_name": "Sao Paulo", "proxy_address": "23.129.253.134", "fbflix_proxy_id": "d-17371142800", "port": 5464, "username": "fhvaccdh", "password": "19ao11w7oapk"}', false),

-- Web Scraping Unit
('20a4bc36-bcd4-477d-89f5-b347b678417c', 'e22acc24-d124-4cad-9b65-1095021d471f', 'WS-MANUAL-9', 'active', 'proxyfbflix', now(), now() + interval '30 days', '{"provider": "proxyfbflix", "city_name": "Sao Paulo", "proxy_address": "108.165.197.248", "fbflix_proxy_id": "d-17371142811", "port": 6734, "username": "fhvaccdh", "password": "19ao11w7oapk"}', false),

-- Extra Units from combined orders
('20a4bc36-bcd4-477d-89f5-b347b678417c', '2c6f6e5f-699c-43cb-a759-eecff70da854', 'WS-MANUAL-10', 'active', 'proxyfbflix', now(), now() + interval '30 days', '{"provider": "proxyfbflix", "city_name": "Sao Paulo", "proxy_address": "23.129.253.90", "fbflix_proxy_id": "d-17371142798", "port": 5086, "username": "fhvaccdh", "password": "19ao11w7oapk"}', false),
('20a4bc36-bcd4-477d-89f5-b347b678417c', '2c6f6e5f-699c-43cb-a759-eecff70da854', 'WS-MANUAL-11', 'active', 'proxyfbflix', now(), now() + interval '30 days', '{"provider": "proxyfbflix", "city_name": "Fortaleza", "proxy_address": "108.165.197.140", "fbflix_proxy_id": "d-17371142809", "port": 6379, "username": "fhvaccdh", "password": "19ao11w7oapk"}', false);

-- Update order_items to mark as delivered
UPDATE public.order_items 
SET delivery_data = jsonb_set(COALESCE(delivery_data, '{}'::jsonb), '{fulfilled}', 'true')
WHERE order_id IN (
    SELECT id FROM orders WHERE user_id = '20a4bc36-bcd4-477d-89f5-b347b678417c'
);