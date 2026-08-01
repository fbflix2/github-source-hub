CREATE OR REPLACE FUNCTION public.notify_user_push(_user_id uuid, _title text, _body text, _url text default '/', _tag text default null)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if _user_id is null then return; end if;
  perform net.http_post(
    url := 'https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1/send-user-push',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-internal-secret','d1e4b1dd84d78e4ff67040fad2c2ee3d571e031d14bb3776',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bmxlcmtleWdmdmRuem5veGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDQ1NTAsImV4cCI6MjA4NzAyMDU1MH0.CTNgMcfo3AdbiiKIONkE0svroKgekXQ4x71bDpqwEV8'
    ),
    body := jsonb_build_object('user_id', _user_id, 'title', _title, 'body', coalesce(_body,''), 'url', coalesce(_url,'/'), 'tag', coalesce(_tag,'fbflix-cliente'))
  );
exception when others then null;
end; $$;

REVOKE EXECUTE ON FUNCTION public.notify_user_push(uuid,text,text,text,text) FROM anon, authenticated;

-- Pedido liberado
CREATE OR REPLACE FUNCTION public.trg_client_push_order_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _items text;
begin
  if new.status = 'completed' and coalesce(old.status,'') is distinct from 'completed' then
    select string_agg(x.name, ' + ') into _items from (
      select coalesce(oi.name,'Item') as name from public.order_items oi where oi.order_id = new.id order by oi.created_at limit 3
    ) x;
    perform public.notify_user_push(
      new.user_id,
      '✅ Pedido liberado: ' || coalesce(_items, coalesce(new.code,'')),
      'Seu pedido ' || coalesce(new.code,'') || ' já está disponível no painel.',
      '/orders',
      'order-done-' || new.id::text
    );
  end if;
  return new;
end; $$;
DROP TRIGGER IF EXISTS client_push_order_completed ON public.orders;
CREATE TRIGGER client_push_order_completed AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_client_push_order_completed();

-- Entrega de página
CREATE OR REPLACE FUNCTION public.trg_client_push_page_delivered()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _destino text;
begin
  if new.status in ('delivered','confirmed','completed') and coalesce(old.status,'') is distinct from new.status then
    _destino := coalesce(array_to_string(new.profile_links, ', '), '');
    perform public.notify_user_push(
      new.user_id,
      '📄 Página entregue: ' || coalesce(new.product_name,'Página'),
      case when _destino <> '' then 'Enviada para o perfil: ' || _destino else 'Sua página já foi enviada.' end,
      '/orders',
      'page-' || new.id::text
    );
  end if;
  return new;
end; $$;
DROP TRIGGER IF EXISTS client_push_page_delivered ON public.page_requests;
CREATE TRIGGER client_push_page_delivered AFTER UPDATE ON public.page_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_client_push_page_delivered();

-- Resposta do suporte
CREATE OR REPLACE FUNCTION public.trg_client_push_ticket_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _uid uuid; _code text;
begin
  if coalesce(new.sender,'') in ('client','user','cliente') then return new; end if;
  select t.user_id, t.code into _uid, _code from public.tickets t where t.id = new.ticket_id;
  perform public.notify_user_push(
    _uid,
    '💬 Suporte respondeu seu ticket',
    coalesce(_code,'') || ' • ' || left(coalesce(new.content,''), 120),
    '/tickets',
    'ticket-reply-' || new.id::text
  );
  return new;
end; $$;
DROP TRIGGER IF EXISTS client_push_ticket_reply ON public.ticket_messages;
CREATE TRIGGER client_push_ticket_reply AFTER INSERT ON public.ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.trg_client_push_ticket_reply();

-- Promoções, novidades e avisos de vencimento (qualquer notificação criada para o cliente)
CREATE OR REPLACE FUNCTION public.trg_client_push_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.user_id is not null then
    perform public.notify_user_push(
      new.user_id,
      coalesce(new.title,'FBFlix'),
      left(coalesce(new.message,''), 200),
      coalesce(new.link,'/'),
      'notif-' || new.id::text
    );
  end if;
  return new;
end; $$;
DROP TRIGGER IF EXISTS client_push_notification ON public.notifications;
CREATE TRIGGER client_push_notification AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.trg_client_push_notification();