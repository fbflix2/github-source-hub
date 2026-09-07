-- Trava o preço de renovação de proxy em R$ 21 para clientes que pagaram
-- originalmente R$ 21, evitando que renovações cobrem o preço atual de
-- tabela (R$ 40) em vez do valor efetivamente pago na contratação.
--
-- Clientes: Leandro Henrique Targino do Nascimento, Felipe Ribeiro.
-- Idempotente: só grava se ainda não houver renewal_price definido,
-- para nunca sobrescrever uma trava manual futura.

UPDATE subscriptions
SET raw_data = raw_data || jsonb_build_object(
  'renewal_price', 21,
  'pricing_locked_reason', 'Preço original pago pelo cliente (R$21), mantido após reajuste de tabela'
)
WHERE user_id IN (
  SELECT user_id FROM profiles
  WHERE full_name ILIKE '%leandro henrique targino%'
     OR full_name ILIKE '%felipe ribeiro%'
)
AND type IN ('proxyfbflix', 'webshare', 'proxybr', 'webshare_rotating', 'proxyfbflix_rotating')
AND status IN ('active', 'expiring', 'expired', 'cancelled')
AND (raw_data->>'renewal_price') IS NULL;
