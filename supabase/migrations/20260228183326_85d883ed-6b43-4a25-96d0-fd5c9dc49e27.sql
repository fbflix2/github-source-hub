-- Debit R$ 25 from Radir's balance for proxy renewal that wasn't charged
UPDATE profiles SET balance = balance - 25 WHERE user_id = '2d811ea5-ed52-4b62-ad1c-9757653817f3';

-- Record the debit transaction
INSERT INTO wallet_transactions (user_id, type, title, amount, balance_after, reference_id)
SELECT '2d811ea5-ed52-4b62-ad1c-9757653817f3', 'purchase', 'Renovação Proxy - 2511284139', -25, p.balance - 25, '5ce8add8-ebde-4829-b71b-37d6aa40a25c'
FROM profiles p WHERE p.user_id = '2d811ea5-ed52-4b62-ad1c-9757653817f3';