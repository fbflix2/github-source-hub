
# Plano: Puxar Todas as Assinaturas da ProxyBR e Vincular aos Clientes

## Resumo
Atualizar o sistema para buscar **todas** as assinaturas da API ProxyBR (todos os status), corrigir o mapeamento dos campos da API (que usa `due_date` em vez de `end_date`, e `proxies.data[]` com formato `ip:port:user:pass`), e criar um mecanismo de vinculacao automatica entre assinaturas ProxyBR e clientes importados usando a tabela `subscriptions` do Supabase.

## O que sera feito

### 1. Corrigir mapeamento dos campos da API ProxyBR

A API retorna campos diferentes do que o codigo espera atualmente:

```text
API retorna:                    Codigo espera:
due_date                   ->   end_date
proxies.data[].code        ->   proxy.ip / proxy.port / proxy.username / proxy.password
  (formato: "ip:port:user:pass")
status: "ACTIVE"           ->   status: "active" (uppercase vs lowercase)
auto_renew_active          ->   auto_renew
```

O `enrichSub` sera atualizado para normalizar esses campos antes de processar.

### 2. Edge Function: Suporte a paginacao e todos os status

Atualizar a Edge Function `proxybr-api` para:
- Adicionar suporte ao parametro `status` na chamada de subscriptions (ex: `?status=all` ou sem filtro)
- Adicionar suporte a paginacao caso a API ProxyBR pagine resultados (buscar todas as paginas)

### 3. Vincular assinaturas aos clientes importados

Usar a tabela `subscriptions` existente no Supabase como tabela de vinculacao:
- Quando o admin acessar a pagina de assinaturas, o sistema cruza os dados da ProxyBR com a tabela `subscriptions` local usando o campo `name` (codigo ProxyBR)
- Criar uma acao na interface admin para vincular manualmente uma assinatura a um cliente (selecionar cliente de uma lista)
- Tambem implementar vinculacao automatica: um botao "Sincronizar" que cria registros na tabela `subscriptions` para cada assinatura da ProxyBR, permitindo que o admin vincule clientes depois

### 4. Interface Admin atualizada

- Mostrar o status real vindo da API (ACTIVE, EXPIRED, CANCELLED, etc.)
- Coluna "Cliente" mostra o nome do cliente vinculado ou "Nao vinculado" com botao para vincular
- Modal de vinculacao com busca de clientes por nome/email
- Exibir proxy completo (IP, porta, usuario, senha) parseado do campo `code`

## Detalhes Tecnicos

### Edge Function (`proxybr-api/index.ts`)
- Nova action `get-all-subscriptions` que faz loop de paginacao se necessario
- Parsing do campo `proxies.data[].code` no formato `ip:port:user:pass` para objeto estruturado

### Hook (`useProxyBR.ts`)
- Novo hook `useProxyBRAllSubscriptions` para buscar todas as assinaturas sem filtro de status

### Pagina Admin (`AdminAssinaturas.tsx`)
- Normalizar campos da API no `enrichSub`: `due_date` -> `end_date`, parse de `proxies.data[].code`
- Cruzar com tabela `subscriptions` local para identificar cliente vinculado
- Botao "Vincular Cliente" que abre modal com busca
- Botao "Sincronizar com ProxyBR" que cria/atualiza registros na tabela `subscriptions`

### Banco de Dados
- A tabela `subscriptions` ja existe com os campos necessarios (`user_id`, `name`, `status`, `start_date`, `end_date`, `type`)
- O campo `name` sera usado para guardar o codigo da assinatura ProxyBR (ex: "2602202123")
- O campo `type` guardara "proxybr" para identificar a origem

### Fluxo de vinculacao
1. Admin clica "Sincronizar" -> sistema busca todas as assinaturas da ProxyBR
2. Para cada assinatura, cria/atualiza registro na tabela `subscriptions` com `name = codigo_proxybr`, `type = "proxybr"`, `status`, `start_date`, `end_date`
3. Admin pode clicar "Vincular" em cada assinatura para associar a um `user_id` de um cliente importado
4. Na proxima carga, o sistema cruza ProxyBR code com `subscriptions.name` e mostra o cliente vinculado
