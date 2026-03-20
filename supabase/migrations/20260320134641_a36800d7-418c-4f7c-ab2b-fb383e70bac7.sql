-- Update new BR subscription with same dates as the old US one
UPDATE subscriptions 
SET start_date = '2026-03-19 21:22:38.458+00',
    end_date = '2026-04-18 21:22:38.458+00',
    updated_at = now()
WHERE id = 'fd264394-8f9c-496a-987c-7702094a40d7';

-- Cancel the old US subscription
UPDATE subscriptions 
SET status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
WHERE id = 'ee5f999d-ecc2-4b1f-99c5-03709574fe86';