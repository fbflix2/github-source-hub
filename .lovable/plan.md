

## Plano: Central Proxy -- Painel de Gestao de Custos e Margens

### Contexto

A API ProxyBR (`GET /products`) ja retorna os produtos com variantes contendo o **preco de custo** (`variant[].price`), estoque (`stocks`) e localizacao. Os screenshots mostram que no painel ProxyBR tambem ha dados como custo de troca, cotas de trocas gratis e pagas -- porem esses dados podem nao estar disponiveis na API de revenda (precisam ser investigados). O preco de venda ja esta configurado localmente na tabela `products`.

### O que sera criado

Uma nova pagina admin **Central Proxy** (`/admin/central-proxy`) que centraliza a gestao financeira e operacional dos proxies, mostrando:

1. **Tabela de Produtos e Variantes** com colunas:
   - Produto (nome + tipo)
   - Variante (localizacao)
   - Preco de Custo (da API ProxyBR)
   - Preco de Venda (do banco local `products`)
   - Margem de Lucro (calculada: venda - custo, em R$ e %)
   - Estoque disponivel (da API)

2. **Cards de resumo no topo**:
   - Total de produtos
   - Margem media
   - Estoque total

3. **Acao "get-products-with-variants"** na edge function -- nova action que retorna os produtos da API com dados detalhados de cada variante (ou reutilizar `get-products` que ja retorna tudo)

### Arquivos a criar/editar

1. **`src/pages/admin/AdminCentralProxy.tsx`** -- Nova pagina com a tabela de produtos/variantes, cards de resumo, e calculo de margens cruzando dados da API (custo) com dados locais (preco de venda)

2. **`src/components/admin/AdminSidebar.tsx`** -- Adicionar item "Central Proxy" no menu com icone `Globe` ou `Server`, posicionado proximo a "Assinaturas"

3. **`src/App.tsx`** -- Adicionar rota `/admin/central-proxy`

4. **`supabase/functions/proxybr-api/index.ts`** -- Possivelmente adicionar action `get-product-details` que busca dados detalhados de um produto especifico (incluindo custo de troca, cotas, etc.) se a API suportar. Caso contrario, usar `get-products` existente

### Detalhes tecnicos

- A pagina fara duas chamadas paralelas: `get-products` (API ProxyBR) + query local `products` com `external_id`
- O cruzamento sera feito via `external_id` (produto local) com `product.id` (API)
- Para cada variante da API, calcula: `margem = precoVendaLocal - custoPorVariante`
- Os dados da API ProxyBR ja estao sendo retornados no formato:
```text
product.variant[].price  = custo do revendedor
product.variant[].stocks = estoque
product.variant[].location = localizacao
```
- O preco de venda vem de `products.price` no banco local

### Fluxo da interface

```text
+--------------------------------------------------+
|  Central Proxy                                    |
+--------------------------------------------------+
| [Total Produtos: 5] [Margem Media: 40%] [Estoque: 259] |
+--------------------------------------------------+
| Produto          | Variante      | Custo | Venda | Margem | Estoque |
|------------------|---------------|-------|-------|--------|---------|
| IPV6 HTTP        | SUDESTE/CENTRAL| R$15  | R$21  | R$6 40%| 140     |
| IPV6 HTTP        | NORTE/NORDESTE | R$15  | R$21  | R$6 40%| 30      |
| IPV4 SOCKS5      | GERAL/OUTROS  | R$22  | R$30  | R$8 36%| 44      |
+--------------------------------------------------+
```

