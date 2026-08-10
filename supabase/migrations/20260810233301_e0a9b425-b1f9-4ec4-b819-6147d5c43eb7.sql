CREATE OR REPLACE FUNCTION public.notify_order_sale(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _o record;
  _items text;
begin
  select * into _o from public.orders where id = _order_id for update;
  if not found then return; end if;
  if _o.push_notified_at is not null then return; end if;
  if _o.status not in ('paid','completed','delivered') then return; end if;

  select string_agg(x.name, ' + ') into _items
  from (
    select coalesce(oi.name,'Item') as name
    from public.order_items oi
    where oi.order_id = _order_id
    order by oi.created_at
    limit 3
  ) x;

  if _items is null or _items = '' then
    return;
  end if;

  update public.orders set push_notified_at = now() where id = _order_id;

  perform public.notify_admins_push(
    '💰 Você vendeu: ' || _items,
    'R$ ' || to_char(coalesce(_o.total,0), 'FM999999990.00') || ' • ' || public.pay_method_label(_o.payment_method),
    '/admin/pedidos',
    'order-' || _order_id::text
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.trg_push_order_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status in ('paid','completed','delivered') then
    perform public.notify_order_sale(new.id);
  end if;
  return new;
end;
$function$;

-- Libera pedidos que foram marcados como notificados sem terem sido pagos
UPDATE public.orders
SET push_notified_at = NULL
WHERE push_notified_at IS NOT NULL
  AND status NOT IN ('paid','completed','delivered');