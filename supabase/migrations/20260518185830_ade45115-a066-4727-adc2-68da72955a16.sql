BEGIN;

UPDATE public.wallet_transactions
SET
  amount = -21.00,
  balance_after = 31.00
WHERE id = '3e41315d-0139-457a-9c33-6f7ecd16df5d'
  AND user_id = 'e1aff22a-9c96-4d99-a3e2-c7f4b398a686'
  AND title = 'Renovação Proxy FBFlix 2602121370#2';

UPDATE public.profiles
SET balance = 31.00
WHERE user_id = 'e1aff22a-9c96-4d99-a3e2-c7f4b398a686';

UPDATE public.subscriptions
SET
  raw_data = COALESCE(raw_data, '{}'::jsonb)
    || jsonb_build_object(
      'renewal_price', 21,
      'original_full_price', 21,
      'pricing_locked_reason', 'Correção manual: renovação do contrato 2602121370 deve ser R$21 por proxy'
    ),
  updated_at = now()
WHERE user_id = 'e1aff22a-9c96-4d99-a3e2-c7f4b398a686'
  AND name IN ('2602121370#1', '2602121370#2')
  AND type IN ('proxyfbflix', 'webshare');

COMMIT;