UPDATE operator_earnings 
SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW() 
WHERE profile_id IN ('cf8300fe-610e-4cbe-b5f0-df6366be50cb', 'acedd049-f505-483c-a350-1b8527838a1c') 
AND status != 'cancelled';