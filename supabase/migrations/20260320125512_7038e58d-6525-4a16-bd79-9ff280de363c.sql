
-- Fix previous register's bank_balance to match real bank
UPDATE cash_register SET bank_balance = 11264.05, difference = 11264.05 - (opening_balance + system_balance + deposits - withdrawals) WHERE id = '85a7048e-ced2-4b5a-b6fb-781b0df6c80a';

-- Fix current register's opening_balance to match real bank
UPDATE cash_register SET opening_balance = 11264.05 WHERE id = '49e0b93e-72f1-48e4-8fa0-70185a80d9a1';
