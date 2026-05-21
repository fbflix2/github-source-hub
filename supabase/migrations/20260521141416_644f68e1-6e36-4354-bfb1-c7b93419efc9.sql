UPDATE public.subscriptions 
SET raw_data = raw_data - 'fix_repeated_done'
WHERE id = '67a02a94-a972-4238-a5d1-86e1fb9624ea';