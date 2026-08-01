CREATE OR REPLACE FUNCTION public.trg_push_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  _items text;
  _count int;
begin
  if new.status in ('paid','completed','processing') and coalesce(old.status,'') is distinct from new.status
     and coalesce(old.status,'') not in ('paid','completed','processing') then

    select string_agg(x.name, ' + '), count(*) into _items, _count
    from (
      select coalesce(oi.name,'Item') as name
      from public.order_items oi
      where oi.order_id = new.id
      order by oi.created_at
      limit 3
    ) x;

    if _items is null or _items = '' then
      _items := 'Pedido ' || coalesce(new.code,'');
    end if;

    perform public.notify_admins_push(
      '💰 Você vendeu: ' || _items,
      'R$ ' || to_char(coalesce(new.total,0), 'FM999999990.00') || ' • ' || coalesce(new.code,'') || ' • ' || coalesce(new.payment_method,'—'),
      '/admin/pedidos',
      'order-' || new.id::text
    );
  end if;
  return new;
end;
$$;