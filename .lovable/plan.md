## Objetivo

Permitir que o admin **cadastre itens (perfil, BM, página, ad account)** com antecedência num pool ligado a cada plano Scale Pro. Quando o cliente ativar o plano, o sistema pega automaticamente os itens do pool e vincula ao cliente — ou o admin pode reservar itens específicos para um cliente antes da ativação (modelo híbrido).

Proxies continuam usando o pool próprio já implementado (`subscriptions` type=proxyfbflix). Este pool é para os **outros itens** do combo.

## Banco de dados

**Nova tabela `ct_pool_items`** — estoque pré-cadastrado por plano:
- `plan_id uuid` → `ct_plans` (a qual plano este item serve)
- `type text` → `perfil` | `bm` | `pagina` | `ad_account`
- `identifier text` → id/link/nome do item (ex: link BM, id perfil FB)
- `metadata jsonb` → credenciais, notas, dados extras (senha, 2FA, etc)
- `status text` → `available` | `reserved` | `assigned`
- `reserved_for_user_id uuid` (nullable) → cliente com reserva manual
- `assigned_ct_client_id uuid` (nullable) → assinatura que consumiu o item
- `assigned_at`, `released_at`, `created_at`, `updated_at`

RLS: admin gerencia tudo, cliente não lê (itens só aparecem via `ct_items` após vinculação).

**Regras de composição do combo por plano** — adicionar em `ct_plans`:
- `combo_config jsonb` → ex: `{"perfil": 1, "bm": 1, "pagina": 1, "ad_account": 0}` (quantos itens de cada tipo entregar; `profiles_qty` continua sendo a quantidade de perfis/proxies)

## Fluxo de ativação (atualiza `ct-subscribe` e `openpix-webhook`)

Após ativar Scale Pro:
1. Ler `plan.combo_config` (fallback: `{perfil: profiles_qty}`)
2. Para cada tipo, buscar N itens no pool priorizando:
   - **1º**: `status='reserved' AND reserved_for_user_id = <user>` (reservas manuais)
   - **2º**: `status='available' AND plan_id = <plan>`
3. Para cada item selecionado:
   - `UPDATE ct_pool_items SET status='assigned', assigned_ct_client_id=<ct_client>, assigned_at=now()`
   - `INSERT INTO ct_items (ct_client_id, type, identifier, metadata, status='ativo')`
4. Se pool insuficiente → notificação admin (igual ao fluxo de proxies)
5. Proxies seguem via `assignPoolProxies` já existente

## Fluxo de liberação (atualiza `ct-lifecycle` + trigger)

Ao cancelar/suspender/expirar Scale Pro:
- Trigger `release_scale_pro_proxies_on_status_change` estendido para também:
  - `UPDATE ct_pool_items SET status='available', assigned_ct_client_id=null, released_at=now() WHERE assigned_ct_client_id = <ct_client>`
- Admin decide se os `ct_items` do cliente ficam arquivados ou removidos (mantém histórico)

## UI Admin

**Nova aba em `/admin/contingencia` → "Pool de Combos"** (ou rota separada `/admin/scale-pro-combos`):

Layout:
```
[Selector: Plano ▼]  [Botão: + Adicionar item ao pool]

Tabs por tipo: [Perfis] [BMs] [Páginas] [Ad Accounts]

Tabela:
| Identificador | Metadata | Status | Reservado para | Ações |
|---------------|----------|--------|----------------|-------|
| link/id       | senha... | avail  | —              | Reservar / Editar / Remover |
| ...           | ...      | reserv | joão@x.com     | Liberar / Editar |
| ...           | ...      | assign | cliente ativo  | Ver assinatura |
```

Modal "Adicionar item": tipo, identificador, metadata (form dinâmico por tipo), plano, opção "reservar para cliente X".

**No modal de "Estrutura" do cliente (já existente)**: adicionar seção mostrando itens do pool vinculados (já aparecem via `ct_items`), com botão "Trocar item do pool" para admin substituir manualmente.

## UI Cliente (`/contingencia`)

Sem mudanças — os itens já aparecem na aba "Estrutura" via `ct_items`. Só ganha visibilidade automática dos itens pré-cadastrados após ativação.

## Arquivos a criar/alterar

- migration: `ct_pool_items` + coluna `combo_config` em `ct_plans` + extensão do trigger
- novo: `src/pages/admin/AdminScaleProCombos.tsx` (aba/rota nova)
- novo: `src/components/scale-pro/PoolItemForm.tsx` (modal add/edit item)
- edit: `src/App.tsx` + `AdminSidebar.tsx` (rota + menu)
- edit: `supabase/functions/ct-subscribe/index.ts` — função `assignPoolComboItems`
- edit: `supabase/functions/openpix-webhook/index.ts` — mesmo helper
- edit: `supabase/functions/ct-lifecycle/index.ts` — liberar itens do pool ao expirar

## Perguntas antes de implementar

1. **Quantidades por plano**: quero usar `combo_config jsonb` (flexível por plano) ou colunas fixas em `ct_plans` (`bms_qty`, `pages_qty`, `ad_accounts_qty`)? Recomendo `combo_config` (mais fácil de evoluir).
2. **Reserva manual**: um item reservado para cliente A que ainda não ativou o plano — se A nunca ativar, admin pode liberar manualmente? (sim por padrão)
3. **Cliente pode ver credenciais do item?** (senha da BM, 2FA do perfil) — mostrar no portal do cliente ou só o identificador?

Confirma este desenho e responde as 3 perguntas para eu seguir com a migration.