-- Debit R$25 from ALAN's wallet
UPDATE profiles SET balance = balance - 25 WHERE user_id = 'b9feb3f9-7a24-4451-9252-dfada51f1e1a';

-- Record wallet transaction
INSERT INTO wallet_transactions (user_id, type, title, amount, balance_after)
SELECT 'b9feb3f9-7a24-4451-9252-dfada51f1e1a', 'purchase', 'Renovação Proxy 2512296940#2', -25, p.balance - 25
FROM profiles p WHERE p.user_id = 'b9feb3f9-7a24-4451-9252-dfada51f1e1a';