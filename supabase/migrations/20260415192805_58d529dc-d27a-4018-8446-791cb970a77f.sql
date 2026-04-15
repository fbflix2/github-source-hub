
-- Remove the two accidentally purchased and cancelled Webshare subscriptions for Guilherme Girardi
DELETE FROM public.subscriptions 
WHERE id IN (
  'd4b302cd-ffb7-439f-9932-ab4bdd58aec0',
  '40c7d179-ad85-4022-85c2-af1964bc7c06'
);
