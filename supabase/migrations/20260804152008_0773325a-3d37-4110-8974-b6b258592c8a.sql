
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS push_notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.notify_admins_push(_title text, _body text DEFAULT NULL, _url text DEFAULT NULL, _tag text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  perform net.http_post(
    url := 'https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1/send-admin-push',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-internal-secret','d1e4b1dd84d78e4ff67040fad2c2ee3d571e031d14bb3776',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bmxlcmtleWdmdmRuem5veGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDQ1NTAsImV4cCI6MjA4NzAyMDU1MH0.CTNgMcfo3AdbiiKIONkE0svroKgekXQ4x71bDpqwEV8'
    ),
    body := jsonb_build_object('title', _title, 'body', coalesce(_body,''), 'url', coalesce(_url,'/admin'), 'tag', coalesce(_tag,'fbflix-admin'), 'icon', '/favicon.png')
  );
exception when others then
  null;
end;
$$;

CREATE OR REPLACE FUNCTION public.pay_method_label(_m text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  select case
    when _m is null then 'Pix'
    when lower(_m) like '%pix%' then 'Pix'
    when lower(_m) in ('wallet','balance','saldo') then 'Saldo'
    when lower(_m) like '%card%' or lower(_m) like '%cart%' then 'Cartão'
    else initcap(_m)
  end
$$;

CREATE OR REPLACE FUNCTION public.notify_order_sale(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  _o record;
  _items text;
begin
  select * into _o from public.orders where id = _order_id for update;
  if not found then return; end if;
  if _o.push_notified_at is not null then return; end if;
  if _o.status not in ('paid','completed','processing') then return; end if;

  select string_agg(x.name, ' + ') into _items
  from (
    select coalesce(oi.name,'Item') as name
    from public.order_items oi
    where oi.order_id = _order_id
    order by oi.created_at
    limit 3
  ) x;

  if _items is null or _items = '' then
    return; -- wait until items exist
  end if;

  update public.orders set push_notified_at = now() where id = _order_id;

  perform public.notify_admins_push(
    '💰 Você vendeu: ' || _items,
    'R$ ' || to_char(coalesce(_o.total,0), 'FM999999990.00') || ' • ' || public.pay_method_label(_o.payment_method),
    '/admin/pedidos',
    'order-' || _order_id::text
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.trg_push_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if new.status in ('paid','completed','processing') then
    perform public.notify_order_sale(new.id);
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS push_order_paid ON public.orders;
CREATE TRIGGER push_order_paid
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_push_order_paid();

CREATE OR REPLACE FUNCTION public.trg_push_order_items_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  perform public.notify_order_sale(new.order_id);
  return new;
end;
$$;

DROP TRIGGER IF EXISTS push_order_items_sale ON public.order_items;
CREATE TRIGGER push_order_items_sale
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.trg_push_order_items_sale();

UPDATE public.orders SET push_notified_at = now()
WHERE status IN ('paid','completed','processing') AND push_notified_at IS NULL;
