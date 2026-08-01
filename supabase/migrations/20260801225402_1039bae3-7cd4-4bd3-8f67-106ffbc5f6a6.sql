create or replace function public.notify_admins_push(_title text, _body text default null, _url text default null, _tag text default null)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform net.http_post(
    url := 'https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1/send-admin-push',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-internal-secret','d1e4b1dd84d78e4ff67040fad2c2ee3d571e031d14bb3776',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bmxlcmtleWdmdmRuem5veGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDQ1NTAsImV4cCI6MjA4NzAyMDU1MH0.CTNgMcfo3AdbiiKIONkE0svroKgekXQ4x71bDpqwEV8'
    ),
    body := jsonb_build_object('title', _title, 'body', coalesce(_body,''), 'url', coalesce(_url,'/admin'), 'tag', coalesce(_tag,'fbflix-admin'))
  );
exception when others then
  null;
end;
$fn$;

revoke all on function public.notify_admins_push(text,text,text,text) from public, anon, authenticated;