
-- Close the current cash register
UPDATE cash_register SET 
  status = 'closed',
  closed_at = '2026-03-19T23:59:59+00:00',
  notes = 'Fechado para resetar - correção de lógica (vendas por saldo não são entrada bancária)',
  updated_at = now()
WHERE id = '49e0b93e-72f1-48e4-8fa0-70185a80d9a1';

-- Delete all automatic movements that were incorrectly created for this register
-- (they included "saldo" payments which don't enter the bank)
DELETE FROM cash_movements 
WHERE cash_register_id = '49e0b93e-72f1-48e4-8fa0-70185a80d9a1'
AND source = 'automatic';
