UPDATE public.subscriptions 
SET raw_data = raw_data || jsonb_build_object('used_ips', jsonb_build_array('23.129.253.84', '92.112.200.193'))
WHERE id = '67a02a94-a972-4238-a5d1-86e1fb9624ea';