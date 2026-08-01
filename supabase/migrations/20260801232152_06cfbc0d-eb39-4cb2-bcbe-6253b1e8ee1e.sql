CREATE OR REPLACE FUNCTION public.trg_push_order_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _items text;
begin
  if new.status in ('paid','completed','processing') and coalesce(old.status,'') is distinct from new.status
     and coalesce(old.status,'') not in ('paid','completed','processing') then

    select string_agg(x.name, ' + ') into _items
    from (
      select coalesce(oi.name,'Item') as name
      from public.order_items oi
      where oi.order_id = new.id
      order by oi.created_at
      limit 3
    ) x;

    if _items is null or _items = '' then
      _items := 'Produto';
    end if;

    perform public.notify_admins_push(
      '💰 Você vendeu: ' || _items,
      'R$ ' || to_char(coalesce(new.total,0), 'FM999999990.00') || ' • ' || coalesce(new.payment_method,'—'),
      '/admin/pedidos',
      'order-' || new.id::text
    );
  end if;
  return new;
end;
$function$;