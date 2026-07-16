# Estorno com devolução ao estoque (todos os tipos, opção A)

## Objetivo

Permitir que um admin, ao aprovar o estorno de um pedido, devolva automaticamente ao estoque os itens vendidos (BM, perfil, proxy, combos, páginas, etc.) e faça com que esse pedido **suma das telas de gestão** (BMs, Perfis, Central Proxy), sem apagar o histórico financeiro.

## Fluxo

1. Admin abre um pedido em **Pedidos** e clica em **"Estornar e devolver ao estoque"**.
2. Modal de confirmação lista os itens que voltarão ao estoque.
3. Ao confirmar, a operação faz tudo em uma transação:
   - Solta cada `stock_item` do pedido: `order_item_id = NULL`, `status = 'revisado'` (pai + filhos de combo).
   - Reseta `bm_tracking` correspondente para `em_estoque`, limpando `client_user_id`, `order_id`, `order_item_id`, `sold_at`, `sale_price`, `expires_at` distante.
   - Libera `subscriptions` de proxy vinculadas àquele pedido (volta ao pool).
   - Libera `ct_pool_items` (combos ScalePro) que estavam atribuídos.
   - Marca `orders.status = 'refunded'` — os triggers já existentes cuidam de comissões de parceiros/revendedores.
   - Credita o valor do pedido na **carteira** do cliente (`profiles.balance` + `wallet_transactions`), conforme conversado. Se preferir estorno externo (PIX), o admin cancela sem creditar via checkbox.
4. `sync_product_stock` recalcula `products.stock` automaticamente → itens reaparecem na loja.

## Telas de gestão — filtro por status

Adiciono filtro `orders.status NOT IN ('refunded','cancelled')` (ou pela flag do pedido) nas consultas de:

- Gestão de BMs (`AdminGestaoBMs`)
- Gestão de Perfis / rastreamento
- Central Proxy (`AdminCentralProxy`) — itens de pedidos estornados somem da lista de "vendidos"

Isso não apaga registros: o histórico continua acessível em Pedidos com o status `refunded`.

## Detalhes técnicos

- **Migration**: função `public.admin_refund_and_restock_order(_order_id uuid, _credit_wallet boolean)` `SECURITY DEFINER`, restrita a `has_role(auth.uid(), 'admin')`. Percorre `order_items`, chama a lógica descrita, retorna JSON com contagem por tipo.
- **RPC**: chamada do frontend via `supabase.rpc('admin_refund_and_restock_order', ...)`.
- **UI**: novo botão em `AdminPedidos.tsx` (linha de ação do pedido) + modal de confirmação com preview dos itens e checkbox "Creditar na carteira do cliente" (default: marcado).
- **Guardas**: se o pedido já estiver `refunded`, botão fica desabilitado. Se algum `stock_item` já estiver reciclado/deletado, ignora com aviso não-fatal.
- **Telas de gestão**: ajuste no `.select(...)` para trazer `orders.status` e filtrar em SQL/cliente.

## Fora do escopo

- Retorno de dinheiro real via PIX/MercadoPago (fica manual — o crédito na carteira cobre o caso comum).
- Reversão de aquecimento/tarefas do operador (permanecem no histórico).
