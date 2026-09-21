create or replace function public.get_partner_by_slug(_slug text)
returns table(id uuid, slug text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.slug
  from public.partners p
  where lower(p.slug) = lower(_slug)
    and p.status = 'active'
  limit 1
$$;

grant execute on function public.get_partner_by_slug(text) to anon, authenticated;