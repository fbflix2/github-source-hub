select cron.schedule(
  'backup-orders-sync-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1/backup-orders-sync',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-internal-secret','d1e4b1dd84d78e4ff67040fad2c2ee3d571e031d14bb3776'
    ),
    body := jsonb_build_object('limit', 300)
  );
  $$
);