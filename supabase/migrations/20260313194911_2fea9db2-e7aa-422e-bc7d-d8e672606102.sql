-- Fix accumulated end_dates: cap to 30 days from now for monthly proxybr subs
UPDATE subscriptions 
SET end_date = now() + interval '30 days',
    updated_at = now()
WHERE type = 'proxybr' 
  AND status = 'active' 
  AND end_date > now() + interval '35 days';