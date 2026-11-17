-- Keep the full invitation URL (including its case-sensitive token) as the unique key.
-- Previously the token was stripped, making unrelated invitations look identical.
update public.bm_supplier_order_items set link_key=btrim(bm_link) where link_key is distinct from btrim(bm_link);

create or replace function public.bm_supplier_submit(p_lines jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid; oid uuid; rec record; n integer; 
begin
 pid:=public.bm_supplier_my_partner();
 if pid is null then raise exception 'Parceiro sem acesso'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<1 or jsonb_array_length(p_lines)>500 then raise exception 'Informe de 1 a 500 BMs'; end if;
 for rec in select value from jsonb_array_elements(p_lines) loop
   if (rec.value->>'id') !~ '^[0-9]{8,25}$' then raise exception 'ID inválido'; end if;
   if (rec.value->>'link') !~ '^https://[^[:space:]]+$' or length(rec.value->>'link')>2048 then raise exception 'Link inválido'; end if;
 end loop;
 insert into public.bm_supplier_orders(partner_id) values(pid) returning id into oid;
 insert into public.bm_supplier_order_items(order_id,bm_id,bm_link,link_key)
 select oid,value->>'id',value->>'link',btrim(value->>'link')
 from jsonb_array_elements(p_lines);
 get diagnostics n=row_count;
 return jsonb_build_object('order_id',oid,'count',n);
exception when unique_violation then
 raise exception 'ID ou link duplicado nesta ordem ou em ordens anteriores';
end;
$$;
