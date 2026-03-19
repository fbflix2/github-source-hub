
-- Delete cash movements for this register first
DELETE FROM cash_movements WHERE cash_register_id = 'afc638c5-69a4-4dd6-89e2-6a9dd545de04';
-- Delete the cash register
DELETE FROM cash_register WHERE id = 'afc638c5-69a4-4dd6-89e2-6a9dd545de04';
