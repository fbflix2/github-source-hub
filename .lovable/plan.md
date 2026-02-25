

## Plano: Corrigir calculo de custo real na Central Proxy

### Problema

Atualmente a Central Proxy usa `variant[].price` da API ProxyBR como custo. Porem esse valor (ex: R$ 15,00) e o **preco sugerido de venda**, nao o custo real de revenda. O custo real e o valor com o desconto de revendedor aplicado (no seu caso, 46% de desconto, resultando em R$ 8,10).

A API ProxyBR nao retorna o percentual de desconto do revendedor. Portanto, esse valor precisa ser configurado localmente.

### Solucao

Adicionar um campo editavel de **"Desconto de Revenda (%)"** na pagina Central Proxy, persistido na tabela `site_settings` (chave `proxybr_reseller_discount`). O calculo de custo passara a ser:

```text
custo_real = preco_api * (1 - desconto/100)

Exemplo: R$ 15,00 * (1 - 46/100) = R$ 8,10
```

### Alteracoes

**`src/pages/admin/AdminCentralProxy.tsx`**:
1. Buscar o valor de `proxybr_reseller_discount` da tabela `site_settings` ao carregar
2. Adicionar um input editavel no header para o percentual de desconto (com botao salvar)
3. Na tabela, mostrar 3 colunas de preco:
   - **Preco API** (valor original da API, em cinza/menor - informativo)
   - **Custo Real** (preco API com desconto aplicado - coluna principal)
   - **Venda** (preco local)
4. Recalcular margem como: `margem = preco_venda - custo_real`
5. O card de resumo "Margem Media" usara o custo real

### Detalhes tecnicos

- Leitura: `supabase.from("site_settings").select("value").eq("key", "proxybr_reseller_discount").single()`
- Escrita: `supabase.from("site_settings").upsert({ key: "proxybr_reseller_discount", value: "46" })`
- O desconto sera aplicado uniformemente a todas as variantes (conforme funciona no painel ProxyBR)
- Default: 0% se nao configurado (comportamento atual preservado)

### Interface

```text
+------------------------------------------------------------------+
| Central Proxy                          [Desconto Revenda: 46% ✏️] |
+------------------------------------------------------------------+
| [Produtos: 5] [Margem Media: 62%] [Estoque: 259]                |
+------------------------------------------------------------------+
| Produto      | Variante       | API   | Custo  | Venda | Margem | Estoque |
|--------------|----------------|-------|--------|-------|--------|---------|
| IPV6 HTTP    | SUDESTE/CENTRAL| R$15  | R$8,10 | R$21  | R$12,90 61%| 126 |
| IPV4 SOCKS5  | GERAL/OUTROS   | R$22  | R$11,88| R$30  | R$18,12 60%| 40  |
+------------------------------------------------------------------+
```

