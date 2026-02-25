

## Investigacao: Vinculacao de Proxies aos Clientes via API ProxyBR

### O que ja existe

O sistema de sincronizacao **ja possui** logica de vinculacao automatica baseada no campo `notes` da API ProxyBR. Quando uma assinatura e comprada pela plataforma, o email do cliente e gravado no campo `notes` da assinatura na ProxyBR (linha 305 do `proxybr-api/index.ts`). Na sincronizacao (cron ou manual), o sistema compara esse `notes` com os emails e nomes dos usuarios locais para fazer o match.

### Por que nao esta funcionando para proxies antigos

O problema e que **proxies comprados diretamente no painel ProxyBR** (antes da plataforma) podem ter o campo `notes` vazio ou com informacao diferente do email cadastrado na plataforma. O sync so re-vincula quando `existing.user_id === fallbackUserId` (admin), entao se ja foi vinculado ao admin, a logica tenta fazer match -- mas sem `notes` populado, nao encontra o usuario correto.

### O que os screenshots mostram

Nos screenshots do painel ProxyBR, cada assinatura mostra nome, email e dominio do cliente. Esses dados podem estar em campos da API como `user`, `client`, `customer` ou similar -- **nao apenas no campo `notes`**.

### Plano de acao

1. **Investigar a estrutura completa da resposta da API ProxyBR** -- adicionar logging temporario na edge function para capturar todos os campos retornados em uma assinatura (especialmente campos como `user`, `client`, `customer`, `owner`, etc.)

2. **Melhorar a logica de matching no sync** para usar todos os campos disponiveis de identificacao do cliente:
   - `notes` (ja usado)
   - `user.email` ou `client.email` (se existir)
   - `user.name` ou `client.name` (se existir)
   
3. **Remover a restricao de re-link apenas para fallback** -- atualmente, se a assinatura ja esta vinculada ao admin, ela tenta re-vincular. Mas se o `notes` estiver vazio e houver outro campo com o email, o sistema nao usa. O plano e expandir o matching.

4. **Criar uma acao admin de "re-vincular tudo"** que force a re-vinculacao de TODAS as assinaturas que estao no admin, usando todos os campos disponiveis.

### Proximo passo imediato

Preciso investigar a resposta real da API ProxyBR para ver quais campos de usuario estao disponiveis. Posso fazer isso de duas formas:
- Consultar os dados ja salvos no `raw_data` de assinaturas existentes no banco
- Adicionar logging na edge function e rodar um teste

### Detalhes tecnicos

Arquivos afetados:
- `supabase/functions/sync-subscriptions-cron/index.ts` -- melhorar logica de matching
- `supabase/functions/proxybr-api/index.ts` -- mesma melhoria na sync manual

A mudanca principal e no bloco de matching (linhas 175-184 do cron):

```text
Atual:
  notes -> email match -> name match -> partial email match

Proposto:
  notes -> email match -> name match -> partial email match
  + sub.user?.email -> match
  + sub.client?.email -> match  
  + sub.customer?.email -> match
  (campos reais a confirmar apos investigacao)
```

