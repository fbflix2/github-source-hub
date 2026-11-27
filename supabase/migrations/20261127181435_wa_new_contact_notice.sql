create table public.wa_new_contact_notice_settings (
 id smallint primary key check(id=1),
 enabled boolean not null default false,
 message text not null check(char_length(btrim(message)) between 1 and 3000),
 activated_at timestamptz,
 webhook_secret text not null default (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
 bootstrap_key text,
 bootstrap_expires_at timestamptz,
 updated_at timestamptz not null default now()
);
create table public.wa_new_contact_notice_attempts (
 phone text primary key check(phone ~ '^[0-9]{8,15}$'),
 source_message_id text not null unique,
 status text not null default 'pending' check(status in ('pending','sent','failed','unknown')),
 claimed_at timestamptz not null default now(),
 completed_at timestamptz,
 provider_message_id text,
 error text
);
alter table public.wa_new_contact_notice_settings enable row level security;
alter table public.wa_new_contact_notice_attempts enable row level security;
revoke all on public.wa_new_contact_notice_settings, public.wa_new_contact_notice_attempts from public, anon, authenticated;
grant select,insert,update,delete on public.wa_new_contact_notice_settings, public.wa_new_contact_notice_attempts to service_role;
insert into public.wa_new_contact_notice_settings(id,message) values(1,$notice$⚠️ AVISO IMPORTANTE

Estamos passando por instabilidade e sobrecarga no sistema de atendimento.

Isso ocorre devido a uma mudança e logística para a ampliação do nosso novo escritório.

Por conta disso, nosso sistema está atendendo de forma reduzida temporariamente.

Agradecemos a compreensão e informamos que em breve tudo estará normalizado, com ainda mais estrutura e agilidade no atendimento.$notice$);
create function public.wa_claim_new_contact_notice(p_phone text,p_message_id text,p_event_at timestamptz,p_secret text)
returns text language plpgsql security invoker set search_path='' as $$
declare
  cfg public.wa_new_contact_notice_settings%rowtype;
  claimed text;
  local_phone text;
begin
  if p_phone !~ '^[0-9]{8,15}$' or p_message_id is null or char_length(p_message_id) not between 1 and 200 then return null; end if;
  select * into cfg from public.wa_new_contact_notice_settings where id=1 and enabled and webhook_secret=p_secret;
  if not found or cfg.activated_at is null or p_event_at is null or p_event_at < cfg.activated_at or p_event_at < now()-interval '15 minutes' or p_event_at > now()+interval '30 seconds' then return null; end if;
  local_phone := case when p_phone like '55%' and length(p_phone) in (12,13) then substring(p_phone from 3) else p_phone end;
  if exists(select 1 from public.whatsapp_conversations c where c.phone in (p_phone,local_phone))
     or exists(select 1 from public.whatsapp_messages m where m.phone in (p_phone,local_phone))
     or exists(select 1 from public.whatsapp_logs l where l.phone in (p_phone,local_phone))
     or exists(select 1 from public.profiles p where p.reseller_id is not null and regexp_replace(coalesce(p.phone,''),'[^0-9]','','g') in (p_phone,local_phone))
  then return null; end if;
  insert into public.wa_new_contact_notice_attempts(phone,source_message_id) values(p_phone,p_message_id) on conflict do nothing returning phone into claimed;
  if claimed is null then return null; end if;
  return cfg.message;
end;
$$;
revoke all on function public.wa_claim_new_contact_notice(text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.wa_claim_new_contact_notice(text,text,timestamptz,text) to service_role;
