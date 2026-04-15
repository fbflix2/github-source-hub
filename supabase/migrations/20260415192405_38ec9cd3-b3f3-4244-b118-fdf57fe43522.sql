
-- 1. Cancel the two new webshare subscriptions (bought by mistake)
UPDATE public.subscriptions 
SET status = 'cancelled', cancelled_at = now()
WHERE id IN (
  'd4b302cd-ffb7-439f-9932-ab4bdd58aec0',
  '40c7d179-ad85-4022-85c2-af1964bc7c06'
);

-- 2. Reactivate the old proxybr subscription with +30 days from today
UPDATE public.subscriptions 
SET status = 'active', 
    end_date = (now() + interval '30 days'),
    grace_notifications = '{}'::jsonb
WHERE id = '9d9d271f-00a8-4bf6-8ea6-61df4087ef1f';
