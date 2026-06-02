SELECT cron.schedule(
  'proxy-renewal-followup',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1/proxy-renewal-followup',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bmxlcmtleWdmdmRuem5veGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDQ1NTAsImV4cCI6MjA4NzAyMDU1MH0.CTNgMcfo3AdbiiKIONkE0svroKgekXQ4x71bDpqwEV8"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);