-- Update the renewal record that matches the completed order timestamp
UPDATE public.safe_bm_renewals 
SET status = 'paid', updated_at = now()
WHERE id = '1fa4388d-384c-4f79-ac86-975d241ed198';

-- Update the vault expiry date
UPDATE public.safe_bm_vaults
SET next_billing_at = next_billing_at + INTERVAL '30 days',
    updated_at = now(),
    status = 'active'
WHERE id = '7b5b51f8-7419-4573-9cac-4b7909181f4d';