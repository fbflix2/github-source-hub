

# Corrigir Vinculacao Automatica de Assinaturas ProxyBR

## Problema Identificado
A API ProxyBR **nao retorna** campos `customer` nem `client` nas assinaturas. Os campos disponiveis sao: `id, code, type, due_date, price_per_unit, discount, total_price, status, notes, auto_renew_active, exchange_quota_free, exchange_quota_pay, proxies, product, product_variant, created_at`.

O codigo atual tenta acessar `sub.customer?.email` e `sub.client?.email`, que sao sempre `undefined`, resultando em 0 vinculacoes.

## Solucao

### 1. Adicionar logging do campo `notes` na Edge Function
Antes de corrigir o matching, precisamos saber o que o campo `notes` contem para cada assinatura. Vamos adicionar um log detalhado na funcao `fetchAllSubscriptions` para capturar os valores de `notes` de todas as assinaturas.

### 2. Atualizar a logica de matching
Remover as referencias a `sub.customer` e `sub.client` (que nao existem) e usar o campo `notes` como fonte primaria de identificacao. A estrategia sera:

- Comparar `notes` (lowercase, trimmed) com emails dos usuarios (`emailToUserId`)
- Comparar `notes` (lowercase, trimmed) com nomes completos dos perfis (`nameToUserId`)
- Adicionar matching parcial: se `notes` **contem** um email ou nome conhecido, tambem vincular

### 3. Logging detalhado durante o sync
Adicionar logs que mostrem:
- O valor de `notes` de cada assinatura
- Se houve match e com qual criterio (email exato, nome exato, match parcial)
- Quantos usuarios e perfis foram carregados para comparacao

## Alteracoes Tecnicas

### Edge Function (`proxybr-api/index.ts`)

**Na funcao `fetchAllSubscriptions`** (apos o loop):
- Adicionar log do campo `notes` do primeiro item para debug

**Na action `sync-subscriptions`** (linhas 160-170):
- Trocar `sub.customer?.email` e `sub.client?.email` por `sub.notes`
- Implementar matching por: email exato em notes, nome exato em notes, e match parcial (notes contem email ou nome)
- Adicionar logs de debug mostrando cada tentativa de match

```text
Antes (nao funciona):
  customerEmail = sub.customer?.email   -> sempre undefined
  customerName = sub.client?.name       -> sempre undefined

Depois (correto):
  notes = sub.notes || ""
  1. Tentar match exato: emailToUserId.get(notes)
  2. Tentar match exato nome: nameToUserId.get(notes)
  3. Tentar match parcial: percorrer emails e verificar se notes contem algum
  4. Tentar match parcial nome: percorrer nomes e verificar se notes contem algum
```

### Arquivos modificados
- `supabase/functions/proxybr-api/index.ts` — corrigir logica de matching e adicionar logs
