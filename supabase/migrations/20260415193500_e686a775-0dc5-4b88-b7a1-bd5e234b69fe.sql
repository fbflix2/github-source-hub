
-- Cancel the old ProxyBR subscription for Guilherme Girardi (will be replaced by Webshare BR proxies)
UPDATE public.subscriptions 
SET status = 'cancelled', cancelled_at = now()
WHERE id = '9d9d271f-00a8-4bf6-8ea6-61df4087ef1f';
