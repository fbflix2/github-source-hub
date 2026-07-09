## Objetivo
Cada plano Scale Pro entrega **1 proxy por perfil incluso** (usar `ct_plans.profiles_qty` como quantidade padrão de proxies). Proxies vinculados à assinatura Scale Pro não geram cobrança individual — a assinatura mãe cobre tudo.

## Mudanças no banco

**1. Nova tabela `ct_client_proxies`** — vínculo N:1 entre proxies e assinatura Scale Pro:
- `ct_client_id` → assinatura Scale Pro
- `subscription_id` → linha em `subscriptions` (proxy existente do tipo `proxyfbflix`/`webshare`)
- `assigned_at`, `released_at`
- Unique em `subscription_id` (um proxy só pode estar em uma assinatura Scale Pro)

**2. Coluna nova em `subscriptions`**:
- `included_in_ct_client_id uuid` — quando preenchido, indica que o proxy é incluso e **não deve ser cobrado/renovado individualmente**

**3. Ajuste em `ct_lifecycle`**:
- Ao cancelar/expirar um Scale Pro: liberar todos os proxies vinculados (set `included_in_ct_client_id=null`, marcar `released_at`, deixar o proxy voltando ao pool interno com `user_id=null` e `status='available'`)

## Fluxo de atribuição automática

Ao ativar Scale Pro (tanto em `ct-subscribe` saldo quanto no webhook PIX):
1. Ler `plan.profiles_qty` — quantos proxies vincular
2. Buscar N proxies internos disponíveis: `subscriptions WHERE type='proxyfbflix' AND user_id IS NULL AND status='available' AND included_in_ct_client_id IS NULL LIMIT N`
3. Para cada proxy: 
   - `UPDATE subscriptions SET user_id=<client>, included_in_ct_client_id=<ct_client_id>, auto_renew=false, status='active'`
   - `INSERT INTO ct_client_proxies`
4. Se pool insuficiente: criar `admin_notifications` alertando falta de proxy e prosseguir com os que tem
5. Notificar cliente via WhatsApp com os proxies atribuídos

## Pool de proxies disponíveis

Como hoje não há um "pool" explícito, adaptar admin para marcar proxies como pool interno:
- Nova tela **Admin > Scale Pro > Pool de Proxies**: lista proxies com `user_id=null` prontos para atribuir a Scale Pro
- Botão em cada proxy do estoque interno: **"Adicionar ao Pool Scale Pro"** (só seta `status='available'` sem `user_id`)

## UI

**Admin (`AdminContingencia`)**: 
- Card na assinatura mostrando proxies vinculados (IP:porta, país)
- Botão "Atribuir proxy manualmente" (caso auto falhe)
- Botão "Liberar proxy" (volta ao pool)

**Cliente (`/contingencia`)**:
- Aba **"Meus Proxies"** listando os vinculados com credenciais (mesmo componente já usado em `/subscriptions`)

## Regras críticas
- Proxies com `included_in_ct_client_id != null` **nunca** entram no fluxo de cobrança/renovação individual
- Ao cancelar Scale Pro: proxy volta ao pool **imediatamente** (user_id=null, included=null)
- Renovação mensal do Scale Pro **não cobra** proxies (eles seguem ativos enquanto a assinatura mãe estiver)
- Manter `auto_renew_active=false` durante a vinculação (respeitar memory Proxy Sync)

## Arquivos a alterar
- migration: criar `ct_client_proxies`, adicionar `included_in_ct_client_id` em `subscriptions`
- `supabase/functions/ct-subscribe/index.ts` — auto-atribuir proxies após ativar
- `supabase/functions/openpix-webhook/index.ts` — auto-atribuir proxies após confirmar PIX
- `supabase/functions/ct-lifecycle/index.ts` — liberar proxies ao expirar/cancelar
- `src/pages/admin/AdminContingencia.tsx` — UI de proxies vinculados + botões
- `src/pages/ClientContingencia.tsx` — aba "Meus Proxies"
- novo: `src/pages/admin/AdminScaleProPool.tsx` — gestão do pool

Confirma que posso seguir com essa estrutura?