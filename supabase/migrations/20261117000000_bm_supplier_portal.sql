-- Independent BM supplier orders. No changes to existing supplier purchases.
create table if not exists public.bm_order_partners (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 name text not null,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create sequence if not exists public.bm_supplier_order_number_seq;
create table if not exists public.bm_supplier_orders (
 id uuid primary key default gen_random_uuid(),
 number bigint not null unique default nextval('public.bm_supplier_order_number_seq'),
 partner_id uuid not null references public.bm_order_partners(id),
 status text not null default 'enviada' check (status in ('enviada','recebida')),
 created_at timestamptz not null default now()
);
create table if not exists public.bm_supplier_order_items (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.bm_supplier_orders(id) on delete cascade,
 bm_id text not null unique check (bm_id ~ '^[0-9]{8,25}$'),
 bm_link text not null,
 link_key text not null unique,
 profile text not null default '',
 status text not null default 'recebida',
 notes text not null default '',
 amount numeric(12,2),
 created_at timestamptz not null default now(),
 check (amount is null or amount >= 0)
);
create index if not exists bm_supplier_order_items_order_idx on public.bm_supplier_order_items(order_id);
create index if not exists bm_supplier_orders_partner_idx on public.bm_supplier_orders(partner_id);
alter table public.bm_order_partners enable row level security;
alter table public.bm_supplier_orders enable row level security;
alter table public.bm_supplier_order_items enable row level security;
revoke all on public.bm_order_partners,public.bm_supplier_orders,public.bm_supplier_order_items from anon,authenticated;
create or replace function public.bm_supplier_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)
$$;
revoke all on function public.bm_supplier_is_admin() from public;
grant execute on function public.bm_supplier_is_admin() to authenticated,service_role;
create or replace function public.bm_supplier_my_partner() returns uuid language sql stable security definer set search_path='' as $$
 select id from public.bm_order_partners where user_id=auth.uid() and active=true limit 1
$$;
revoke all on function public.bm_supplier_my_partner() from public;
grant execute on function public.bm_supplier_my_partner() to authenticated;
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
 select oid,value->>'id',value->>'link',lower(regexp_replace(trim(trailing '/' from (value->>'link')),'[?#].*$',''))
 from jsonb_array_elements(p_lines);
 get diagnostics n=row_count;
 return jsonb_build_object('order_id',oid,'count',n);
exception when unique_violation then
 raise exception 'ID ou link duplicado nesta ordem ou em ordens anteriores';
end;
$$;
revoke all on function public.bm_supplier_submit(jsonb) from public;
grant execute on function public.bm_supplier_submit(jsonb) to authenticated;
create or replace function public.bm_supplier_admin_update(p_item uuid,p_profile text,p_status text,p_notes text,p_amount numeric)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.bm_supplier_is_admin() then raise exception 'Somente administrador'; end if;
 if p_amount < 0 then raise exception 'Valor inválido'; end if;
 update public.bm_supplier_order_items set profile=left(coalesce(p_profile,''),200),status=left(coalesce(p_status,'recebida'),80),notes=left(coalesce(p_notes,''),2000),amount=p_amount where id=p_item;
 if not found then raise exception 'BM não encontrada'; end if;
end;
$$;
revoke all on function public.bm_supplier_admin_update(uuid,text,text,text,numeric) from public;
grant execute on function public.bm_supplier_admin_update(uuid,text,text,text,numeric) to authenticated;
create policy bm_partner_self on public.bm_order_partners for select to authenticated using (user_id=auth.uid() or public.bm_supplier_is_admin());
create policy bm_orders_view on public.bm_supplier_orders for select to authenticated using (partner_id=public.bm_supplier_my_partner() or public.bm_supplier_is_admin());
create policy bm_items_view on public.bm_supplier_order_items for select to authenticated using (exists(select 1 from public.bm_supplier_orders o where o.id=order_id and (o.partner_id=public.bm_supplier_my_partner() or public.bm_supplier_is_admin())));
grant select on public.bm_order_partners,public.bm_supplier_orders,public.bm_supplier_order_items to authenticated;
