
UPDATE subscriptions 
SET end_date = start_date + interval '30 days'
WHERE name = '2603027561' AND end_date IS NULL;
