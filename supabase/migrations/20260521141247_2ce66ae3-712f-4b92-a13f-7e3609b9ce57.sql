UPDATE public.subscriptions 
SET raw_data = raw_data || jsonb_build_object('exchange_quota_free', 4)
WHERE id = '67a02a94-a972-4238-a5d1-86e1fb9624ea';