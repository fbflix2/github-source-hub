alter table public.bm_order_partners add column if not exists username text;
create unique index if not exists bm_order_partners_username_unique on public.bm_order_partners(lower(username)) where username is not null;
alter table public.bm_order_partners add constraint bm_partner_username_format check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,39}$');