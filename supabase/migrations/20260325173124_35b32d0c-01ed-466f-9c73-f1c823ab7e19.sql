-- Fix Eduardo's subscription: cap end_date to 30 days from now (2026-04-24)
UPDATE subscriptions 
SET end_date = (NOW() + INTERVAL '30 days')::timestamptz,
    updated_at = NOW()
WHERE id = '80a93691-a893-416a-9dce-3132ab813080' 
  AND user_id = '0ad80dbc-a786-4c83-94c4-b5f5acf46851';

-- Debit the missing R$225 (9 proxies × R$25 each that weren't charged)
UPDATE profiles 
SET balance = balance - 225 
WHERE user_id = '0ad80dbc-a786-4c83-94c4-b5f5acf46851';

-- Record the corrective wallet transaction
INSERT INTO wallet_transactions (user_id, type, title, amount, balance_after, reference_id)
VALUES (
  '0ad80dbc-a786-4c83-94c4-b5f5acf46851',
  'purchase',
  'Correção Renovação Proxy - 2602263210 (9 proxies restantes)',
  -225,
  50, -- 275 - 225 = 50
  '80a93691-a893-416a-9dce-3132ab813080'
);