-- Atualizar a assinatura para incluir 1 cota de troca gratuita
UPDATE public.subscriptions 
SET raw_data = raw_data || '{"exchange_quota_free": 1}'::jsonb
WHERE name = 'WS-MOOAD3ZW-USA' AND user_id = 'fedd9f7c-0c2f-4987-a2a6-c04b831569e4';