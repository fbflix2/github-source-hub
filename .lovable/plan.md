## Painel de Manutenção do Revendedor

Substitui o item **Comissões** do menu (modelo percentage) e **Extrato** (modelo crédito) por um novo item **Manutenção**, onde o revendedor gerencia proxies dos clientes dele com débito automático do próprio saldo.

### O que o revendedor verá

Lista das **assinaturas de proxy dos clientes vinculados ao revendedor** (`subscriptions.reseller_id = reseller.id`, tipo proxy, status ativo), com filtros por cliente/status e busca. Para cada linha, dois botões de ação:

1. **Trocar IP** — mantém país e plano; chama fluxo existente de replace do provedor (Webshare/ProxyFbflix conforme o tipo da sub).
2. **+ Dias extras** — modal para escolher 7 / 15 / 30 dias; estende `subscriptions.end_date`.

### Regras de cobrança

- Débito automático de `resellers.balance_credits`.
- Se saldo insuficiente → bloqueia a ação e mostra "Recarregue seu saldo".
- Cada operação gera 1 linha em `reseller_credit_ledger` (type `debit`, description clara: "Troca de IP · sub XYZ" / "+15 dias · sub XYZ").

### Preços (placeholder — usuário definirá depois)

Novos campos em `resellers` para o admin ajustar por revendedor:
- `maintenance_swap_price` numeric default **2.00** (custo por troca de IP)
- `maintenance_day_price` numeric default **0.50** (custo por dia extra)

Enquanto o usuário não definir valores finais, esses defaults valem. O admin poderá editar no painel de revendedores.

### Backend

Um único edge function `reseller-maintenance` (server-side, valida JWT, verifica que o sub pertence ao revendedor, debita saldo, executa ação):

- `action: "swap-ip"` → chama replace do provedor + registra ledger
- `action: "extend-days"` → soma dias em `end_date` + registra ledger

Todo o débito e a ação ficam em uma transação lógica: se a chamada ao provedor falhar, o débito é revertido.

### Menu e rota

- Sidebar: **Comissões** → **Manutenção** (ícone `Wrench`), id `manutencao`.
- Nova seção `activeSection === "manutencao"` no `RevendaPortal.tsx`.
- Componente `ResellerMaintenance.tsx` em `src/components/revenda/`.
- O histórico de comissões (tabela atual) fica acessível dentro da tela **Visão Geral** como um card colapsável menor, para não perder o dado — ou movido para dentro do próprio painel de Manutenção como aba secundária "Histórico de comissões". Vou usar **abas** dentro de Manutenção: `Ações` | `Histórico de comissões` | `Extrato de créditos`.

### Arquivos

- `supabase/migrations/*` — adiciona `maintenance_swap_price` e `maintenance_day_price` em `resellers`.
- `supabase/functions/reseller-maintenance/index.ts` — nova edge function.
- `src/components/revenda/ResellerMaintenance.tsx` — nova UI (lista + modais).
- `src/pages/revenda/RevendaPortal.tsx` — troca item de menu e roteamento da seção.

### Fora de escopo (para depois)

- Preços finais das operações (usuário definirá).
- Troca de país, reset de credenciais, banda extra, trocas extras — não pedidos.
- Fatura mensal consolidada — não escolhido.
