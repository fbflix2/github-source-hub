-- Update the status of the 7 duplicate subscriptions to 'cancelled'
UPDATE public.subscriptions 
SET status = 'cancelled', updated_at = now() 
WHERE id IN (
  '90bd1ced-4ca6-452c-8c9a-20d913e98bdd', 
  'd941012f-9f2b-4332-93e1-144a4c265f5f', 
  'a26fd756-145e-468b-95b8-8446006e88d5', 
  '9e8b85d6-caea-4162-9cab-4f94b7270ea3', 
  '690a38e6-0494-4f1e-bb2a-900af500811d', 
  '5524d91b-4f55-4177-a964-98bfbb4e94df', 
  'd2ff9b44-a369-4cbd-9f31-3f09e1aebed3'
);

-- I will not touch the balance yet as I need to confirm the exact unit price charged for these automatic renewals to be precise.
