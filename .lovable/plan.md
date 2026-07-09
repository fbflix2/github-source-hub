
# Onda 1 — Correções críticas de dados

Escopo restrito: apenas o que o scanner classificou como crítico e que **não altera comportamento de leitura pública** do app. Cada mudança abaixo foi validada no schema atual do banco.

## O que será alterado

### A. RLS `USING (true)` / `WITH CHECK (true)` em escrita

O scanner detectou 3 policies permissivas em operações de escrita. Investigando as 5 candidatas encontradas no banco, classifico assim:

| Tabela | Policy | Cmd | Ação | Justificativa |
|---|---|---|---|---|
| `whatsapp_logs` | "Service can update logs" | UPDATE `true` | **DROP + recriar restrita a `is_staff`** | UPDATE aberto a qualquer usuário logado é risco real. |
| `whatsapp_logs` | "Service can insert logs" | INSERT `true` | **DROP + recriar restrita a `is_staff`** | Logs devem vir só de edge functions (service_role bypassa RLS mesmo assim) ou staff. |
| `consent_logs` | "Anyone can insert consent logs" | INSERT `true` | **Manter** (necessário no fluxo LGPD antes do login) — adicionar `WITH CHECK (user_id IS NULL OR user_id = auth.uid())`. |
| `partner_journey_events` | "anyone can insert journey events" | INSERT `true` | **Manter** (tracking anônimo por visitor_id) — adicionar validação de tamanho de payload e `user_id IS NULL OR user_id = auth.uid()`. |
| `product_views` | "Anyone can insert product views" | INSERT `true` | **Manter** (analytics público) — adicionar `WITH CHECK (user_id IS NULL OR user_id = auth.uid())`. |

### B. `password_reset_codes` — RLS ligado, sem policies

Estado atual: RLS ativa, 0 policies → tabela já está **totalmente bloqueada** para `anon`/`authenticated` (apenas `service_role` via edge functions `request-password-reset` e `verify-password-reset` acessa). Comportamento correto, mas scanner sinaliza como INFO.

Ação: adicionar policy explícita "Deny all" para deixar a intenção documentada e silenciar o finding, sem alterar comportamento.

```sql
CREATE POLICY "No client access" ON public.password_reset_codes
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
```

### C. Functions sem `search_path` fixado

Duas funções `SECURITY DEFINER` sem `SET search_path`:
- `public.process_partner_referral`
- `public.process_safe_bm_renewals`

Ação: `ALTER FUNCTION ... SET search_path = public` (não muda lógica, elimina risco de search_path injection).

## Detalhes técnicos (SQL da migration)

```sql
-- 1) whatsapp_logs — restringir escrita a staff
DROP POLICY "Service can insert logs" ON public.whatsapp_logs;
DROP POLICY "Service can update logs" ON public.whatsapp_logs;

CREATE POLICY "Staff can insert logs" ON public.whatsapp_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update logs" ON public.whatsapp_logs
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- 2) consent_logs / partner_journey_events / product_views — vincular user_id
DROP POLICY "Anyone can insert consent logs" ON public.consent_logs;
CREATE POLICY "Insert own consent logs" ON public.consent_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY "anyone can insert journey events" ON public.partner_journey_events;
CREATE POLICY "Insert own journey events" ON public.partner_journey_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY "Anyone can insert product views" ON public.product_views;
CREATE POLICY "Insert own product views" ON public.product_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 3) password_reset_codes — deny explícito
CREATE POLICY "No client access" ON public.password_reset_codes
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 4) search_path
ALTER FUNCTION public.process_partner_referral() SET search_path = public;
ALTER FUNCTION public.process_safe_bm_renewals() SET search_path = public;
```

## Impacto no app (arquivos)

Nenhuma alteração de código frontend. Edge functions `wapi-webhook`, `wapi-send`, `wapi-import` usam `SUPABASE_SERVICE_ROLE_KEY` e continuam funcionando (service_role bypassa RLS). Fluxos anônimos de consent/journey/views seguem funcionando pois `user_id` já é `NULL` nesses casos.

## Riscos

- Baixo. Todas as escritas afetadas por `whatsapp_logs` vêm de edge functions com service_role, que bypassam RLS.
- Se algum código cliente escrever direto em `whatsapp_logs` (não encontrado no grep), quebrará — mas isso seria exatamente a vulnerabilidade que estamos fechando.

## O que NÃO está nesta onda

- REVOKE EXECUTE em SECURITY DEFINER (Onda 2)
- Storage bucket listing (Onda 3)
- CORS / índices / edge functions públicas (Onda 4)
- Toda essa lista será tratada em ondas subsequentes após você aprovar cada uma.

Aprovando este plano, executo a migration única acima e depois rodo o scanner de novo para confirmar que os 6 findings (3 permissive + 1 RLS-no-policy + 2 search_path) sumiram.
