

## Sincronizacao automatica com Cron Job

### Como funciona hoje
A sincronizacao so acontece quando voce acessa a pagina de assinaturas e clica em "Sincronizar". Se voce sair da pagina, nada mais e atualizado.

### Solucao: Edge Function agendada (Cron)

Uma funcao que roda automaticamente a cada intervalo definido (ex: 10 minutos), sem precisar estar na pagina.

```text
A cada 10 min:
  Cron Job --> Edge Function "sync-subscriptions-cron"
                  |
                  +--> Busca assinaturas da API ProxyBR
                  +--> Compara com banco local
                  +--> Atualiza apenas o que mudou
                  +--> Salva timestamp da ultima sync
```

### Arquivos a criar/modificar

#### 1. Nova Edge Function `supabase/functions/sync-subscriptions-cron/index.ts`
- Funcao dedicada ao cron que chama a logica de sync existente no `proxybr-api`
- Usa service role key para acessar o banco diretamente
- Roda a mesma logica do action `sync-subscriptions` ja existente

#### 2. Configurar o Cron no Supabase
- Usar `pg_cron` (extensao do Postgres) para agendar a chamada da edge function a cada 10 minutos
- Migracao SQL:

```sql
-- Habilitar pg_cron e agendar sync automatico
SELECT cron.schedule(
  'sync-proxybr-subscriptions',
  '*/10 * * * *',  -- a cada 10 minutos
  $$
  SELECT net.http_post(
    url := '<SUPABASE_URL>/functions/v1/proxybr-api',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{"action": "sync-subscriptions"}'::jsonb
  );
  $$
);
```

#### 3. Atualizar `AdminAssinaturas.tsx`
- Remover o botao manual de "Sincronizar" (ou manter como opcao de sync forcado)
- Exibir "Ultima sincronizacao: X minutos atras" com auto-refresh
- A pagina so le do banco local, os dados ja estarao sempre atualizados

### Intervalo configuravel
O intervalo pode ser ajustado (5 min, 10 min, 30 min) conforme necessidade. Quanto menor o intervalo, mais chamadas a API ProxyBR serao feitas.

### Vantagens
- Dados sempre atualizados, mesmo sem acessar a pagina
- Pagina carrega instantaneamente do banco local
- Nenhuma acao manual necessaria
- Se a API ProxyBR estiver fora, o banco local mantem os ultimos dados validos

### Consideracao importante
A API ProxyBR tem limite de requisicoes? Se sim, um intervalo de 10 minutos faz ~144 syncs/dia. Se o limite for baixo, podemos aumentar o intervalo para 30 minutos (~48 syncs/dia).

