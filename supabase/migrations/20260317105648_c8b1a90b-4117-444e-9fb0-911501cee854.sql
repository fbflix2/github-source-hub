-- Fix the auto-close record: close it properly with correct bank_balance
UPDATE cash_register 
SET status = 'closed', 
    bank_balance = 11522.06, 
    closed_at = '2026-03-17T03:00:00.000Z',
    difference = 11522.06 - 10734,
    notes = 'Fechamento automático à meia-noite',
    updated_at = now()
WHERE id = '0aafc7e7-c239-4aa4-a019-112e0f7408ee';

-- Fix the current open cash register: update opening_balance to match
UPDATE cash_register
SET opening_balance = 11522.06,
    bank_balance = NULL,
    difference = 0,
    notes = NULL,
    updated_at = now()
WHERE id = '6430132a-6efb-4cc3-a6fa-71c2547989bb';