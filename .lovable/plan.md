## Novo modelo de revenda

Eliminar os dois modelos atuais (comissão % e crédito com R$10 fixo) e adotar **um único modelo**: revendedor recarrega saldo → cada venda/renovação **debita o custo do proxy** (definido por nós, FBFlix, por produto) do saldo. A margem do revendedor é a diferença entre o preço que ele cobra e o custo FBFlix.

---

### 1. Banco de dados

**Novo campo em `products`:**
- `reseller_cost` (numeric, default 0) — custo FBFlix cobrado do revendedor quando o produto é vendido/renovado. Editável apenas por admin.

**Trigger `process_reseller_commission` reescrito** (renomeado logicamente para "process_reseller_debit"):
- Ao concluir uma order com `reseller_id`, para cada `order_item` que seja proxy:
  - Somar `products.reseller_cost × quantity` = **débito total**.
  - Se `resellers.balance_credits >= débito`: debita, registra em `reseller_credit_ledger` (type `debit`, description "Custo FBFlix - {produto}") e atualiza `total_gmv`.
  - Se saldo insuficiente: **não bloqueia a venda** (o cliente já pagou o revendedor), mas gera saldo negativo e cria alerta.
- Remove a lógica atual de comissão percentual e a criação de linha em `reseller_commissions`.

**Coluna `resellers.model`** é ignorada (mantida por retrocompatibilidade, default passa a `'prepaid'`). Colunas `commission_rate` e `proxy_unit_cost` deixam de ser usadas para novos revendedores mas são preservadas pra histórico.

---

### 2. Renovação de proxy

No fluxo de renovação automática (edge function `proxy-auto-renew` / `proxy-renew`):

```text
antes de renovar o proxy do cliente final:
  ├─ SELECT products.reseller_cost do plano
  ├─ SELECT resellers.balance_credits
  ├─ se saldo >= custo:
  │     debita saldo, registra ledger, prossegue renovação
  └─ se saldo < custo:
        ├─ NÃO renova (proxy entra em D+5 grace normal)
        ├─ NÃO avisa o cliente final
        ├─ dispara WhatsApp ao revendedor:
        │    "⚠️ Saldo insuficiente para renovar proxy do cliente X.
        │     Custo: R$ Y • Saldo atual: R$ Z • Recarregue no painel."
        └─ registra em admin_notifications para o revendedor
```

WhatsApp é enviado via edge function `wapi-send` usando o `support_whatsapp` do revendedor (ou telefone do dono no `profiles`).

---

### 3. Painel Admin — nova aba "Revenda / Proxy"

Novo menu no admin dentro da seção Revenda:
- Lista todos os produtos de proxy (filtro por `icon_type = 'proxy'`).
- Para cada linha: nome do proxy, país, preço público, **campo editável "Custo revenda (R$)"** salvando em `products.reseller_cost`.
- Botão inline "Salvar" por linha ou save global.
- Busca por nome/país.

---

### 4. Painel do Revendedor

- Card de saldo já existe — só precisa ficar em destaque.
- Aba/página "Extrato" já lê `reseller_credit_ledger`; os débitos automáticos aparecem lá com descrição "Custo FBFlix – {produto}".
- Remover qualquer UI restante que mostre "comissão %" ou "R$10 fixo" — trocar por "Custo por proxy: definido pela FBFlix" e mostrar o custo ao lado de cada assinatura do cliente.
- Banner de alerta amarelo/vermelho quando `balance_credits < X` (X = maior `reseller_cost` × 3, para dar buffer).

---

### 5. Detalhes técnicos

- Migration:
  - `ALTER TABLE products ADD COLUMN reseller_cost numeric NOT NULL DEFAULT 0;`
  - `CREATE OR REPLACE FUNCTION process_reseller_commission()` — reescrever conforme item 1.
  - `ALTER TABLE resellers ALTER COLUMN model SET DEFAULT 'prepaid';`
- Edge function `proxy-auto-renew`: adicionar pré-check de saldo + chamada ao `wapi-send`.
- Frontend admin: nova rota `/admin/revenda/proxy-costs` com tabela editável.
- Frontend revendedor: ajustar `ResellerAssinaturas.tsx` e cards do `RevendaPortal.tsx` para não citar comissão.

---

### Fora de escopo

- Não vou mexer em revendedores antigos que ainda tenham `reseller_commissions` pendentes (ficam no histórico; a partir de agora não geram mais linhas novas).
- Não vou criar recarga automática — o revendedor continua recarregando manualmente via PIX/painel como já é hoje.
- Não vou mudar o preço público dos proxies — o revendedor decide quanto cobra do cliente final.

Confirma que posso implementar assim?
