# Pipeline de checkout revendedor

Tornar a venda de proxies (e demais produtos) totalmente funcional no domínio do revendedor, com:
- Cobrança feita no gateway OpenPix do revendedor
- Débito automático do custo FBFlix do `balance_credits`
- Rastreio via `reseller_id` em pedidos e comissões

## 1. Detecção do revendedor no checkout

- Novo hook `useResellerContext()` que resolve o `reseller_id` a partir do hostname (via RPC `get_reseller_slug_by_domain` já existente) ou do slug em `/r/:slug`.
- Persistir `reseller_id` no `localStorage` (`fbflix_reseller_id`) durante a sessão de compra.
- Injetar `reseller_id` no payload de `Checkout.tsx` e nas chamadas `supabase.functions.invoke("create-pix-payment", ...)`.

## 2. Botão "Comprar" da loja pública

- Na loja pública (quando `reseller_id` presente), o botão principal do card de produto vira "Comprar agora" → navega direto para `/checkout?product=<id>&reseller=<id>`.
- Mantém carrinho como opção secundária.

## 3. Edge functions de pagamento

Atualizar `create-pix-payment` e `create-card-payment` (Appmax quando pronto):

- Aceitar `reseller_id` no body.
- Se `reseller_id` presente e revendedor `active/warning`:
  - Buscar credenciais OpenPix do próprio revendedor (`resellers.openpix_app_id`).
  - Criar cobrança nesse gateway.
- Se ausente ou revendedor inativo → cair no gateway FBFlix (comportamento atual).
- Persistir `reseller_id` em `orders` e `payments`.

## 4. Débito do custo FBFlix

Já existe o trigger `process_reseller_commission()` que debita `reseller_cost` do `balance_credits` quando `orders.status='completed'`. Vamos:

- Garantir que o webhook OpenPix marca `orders.status='completed'` após confirmação (já faz).
- Adicionar guarda: se `balance_credits < custo` no momento do débito → registrar débito negativo + criar `admin_notifications` avisando saldo negativo (não bloqueia entrega — cliente já pagou).
- Exibir aviso no painel do revendedor quando `balance_credits < 0`.

## 5. UI do revendedor

- Card "Saldo de créditos" no `RevendaPortal` com alerta vermelho quando negativo e botão "Recarregar via PIX" (fluxo existente).
- Aba "Vendas" já lista `reseller_commissions` — validar que aparece após o pagamento.

## 6. Testes manuais

1. Comprar 1 proxy pelo domínio `painel.activecontingencia.com` → PIX gerado no OpenPix do revendedor.
2. Confirmar pagamento → pedido `completed`, proxy entregue, `balance_credits` do revendedor reduzido pelo `reseller_cost`, `reseller_commissions` criado.
3. Recomprar com saldo insuficiente → entrega ocorre, saldo fica negativo, notificação para admin.

## Detalhes técnicos

- **Arquivos alterados:**
  - `src/hooks/useResellerContext.ts` (novo)
  - `src/pages/Checkout.tsx`
  - `src/pages/PublicStore.tsx` (ou equivalente do card de produto público)
  - `src/pages/revenda/RevendaPortal.tsx` (card saldo)
  - `supabase/functions/create-pix-payment/index.ts`
  - `supabase/functions/openpix-webhook/index.ts` (garantir set de `reseller_id`)
- **Migração:** garantir `orders.reseller_id`, `payments.reseller_id` (já existem — confirmar), e trigger `autofill_order_reseller_id` (já existe).
- Appmax fica para uma segunda etapa (quando a conta estiver criada).

Depois da aprovação, começo pela detecção + edge function e sigo até o débito automático.
