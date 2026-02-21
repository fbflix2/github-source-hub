

## Carregar dados do banco local + sincronizacao inteligente

### Problema atual
Toda vez que a pagina de assinaturas e acessada, o sistema busca **todas as 2441+ assinaturas** da API ProxyBR do zero (pagina por pagina), o que e lento e desnecessario. Os dados ja foram sincronizados para o banco local mas nao estao sendo usados como fonte primaria.

### Solucao proposta

#### Estrategia: Banco local como fonte primaria + sync sob demanda

```text
+------------------+     +-------------------+     +----------------+
|  Pagina carrega   | --> | Le do banco local | --> | Exibe dados    |
|                   |     | (instantaneo)     |     | imediatamente  |
+------------------+     +-------------------+     +----------------+
                                                           |
                                                    +------v-------+
                                                    | Verifica     |
                                                    | ultima sync  |
                                                    | e total API  |
                                                    +--------------+
                                                           |
                                                    +------v-------+
                                                    | Se diferente:|
                                                    | mostra aviso |
                                                    | "Sincronizar"|
                                                    +--------------+
```

#### 1. Adicionar coluna `raw_data` na tabela subscriptions

Armazenar o JSON completo da API (proxy IP, produto, credenciais) para nao perder informacoes na exibicao.

```sql
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS raw_data jsonb;
```

#### 2. Atualizar o sync na Edge Function para salvar `raw_data`

No `sync-subscriptions`, adicionar o campo `raw_data` ao upsert com todos os dados da API (proxy, produto, etc).

#### 3. Mudar a fonte de dados da pagina AdminAssinaturas

**Antes**: `useProxyBRAllSubscriptions()` (busca tudo da API a cada visita)

**Depois**: Query do banco local `subscriptions` com `raw_data`, que carrega instantaneamente.

```typescript
// Nova query - carrega do banco local
const { data: localSubs, isLoading } = useQuery({
  queryKey: ["admin-subscriptions-cached"],
  queryFn: async () => {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("type", "proxybr");
    return data || [];
  },
});
```

#### 4. Verificacao rapida de mudancas

Ao carregar a pagina, fazer uma unica chamada leve a API (apenas pagina 1) para comparar o total. Se o total for diferente do banco local, exibir um banner:

```text
"Foram detectadas mudancas na ProxyBR. Clique para sincronizar."
```

#### 5. Adaptar o `enrichSub` para usar dados do `raw_data`

O `enrichSub` vai reconstruir as informacoes de proxy, produto e status a partir do `raw_data` JSONB salvo no banco, em vez de depender de uma chamada API.

#### 6. Exibir "Ultima sincronizacao"

Mostrar a data/hora da ultima sync bem-sucedida (lida do `site_settings.sync_result.timestamp`).

### Arquivos a modificar

1. **Nova migracao SQL** - adicionar coluna `raw_data jsonb` na tabela `subscriptions`
2. **`supabase/functions/proxybr-api/index.ts`** - salvar `raw_data` no sync; adicionar action `check-subscription-count` para verificacao rapida
3. **`src/pages/admin/AdminAssinaturas.tsx`** - trocar fonte de dados para banco local; adicionar banner de mudancas detectadas; exibir ultima sync
4. **`src/hooks/useProxyBR.ts`** - adicionar hook para verificacao rapida de contagem

### Resultado esperado

- Pagina carrega **instantaneamente** com dados do banco local
- Mostra data da ultima sincronizacao
- Verifica automaticamente se ha mudancas e avisa o admin
- Sync so acontece quando o admin clica no botao (ou quando mudancas sao detectadas)
- Dados completos (proxy, produto, credenciais) preservados no `raw_data`

