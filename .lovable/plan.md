

## Corrigir contagem de status Vencido e Cancelado

### Problema
O painel ProxyBR mostra Vencido=17 e Cancelado=2248, mas o app mostra Vencido=2263 e Cancelado=0. Isso significa que as 2248 assinaturas canceladas estao caindo no fallback por data (linha 78 do `mapStatus`) e sendo contadas como "expired" em vez de "cancelled". O campo `status` retornado pela API ProxyBR provavelmente tem um formato diferente do esperado (pode ser um objeto, um campo aninhado, ou um valor inesperado).

### Plano

#### 1. Adicionar log de debug na Edge Function para capturar os status reais da API

No action `get-all-subscriptions` do `supabase/functions/proxybr-api/index.ts`, adicionar um log na primeira pagina que mostra os valores unicos de status retornados pela API:

```typescript
// Apos parsear os items da primeira pagina:
if (page === startPage) {
  const statusSamples = items.slice(0, 20).map((s: any) => ({
    code: s.code,
    status: s.status,
    statusType: typeof s.status,
  }));
  console.log("STATUS SAMPLES:", JSON.stringify(statusSamples));
}
```

#### 2. Corrigir o `mapStatus` no frontend para tratar o status como objeto

O campo `status` da API ProxyBR provavelmente retorna um objeto (ex: `{id: 3, name: "Cancelado"}`) em vez de uma string simples. Atualizar a funcao `mapStatus` em `src/pages/admin/AdminAssinaturas.tsx`:

```typescript
function mapStatus(sub: { status: any; end_date: string }): MappedStatus {
  // Handle status as object (e.g. {id: X, name: "Cancelado"}) or string
  let raw = sub.status;
  if (raw && typeof raw === "object") {
    raw = raw.name || raw.label || raw.value || JSON.stringify(raw);
  }
  const s = (String(raw) || "").toLowerCase().trim();

  if (["cancelled","cancelado","canceled"].includes(s)) return "cancelled";
  if (["expired","vencido","expirado"].includes(s)) return "expired";
  if (["pending_renewal","renovação pendente","renewal_pending","pending","pendente"].includes(s)) return "pending_renewal";
  if (["active","ativo","enabled"].includes(s)) return "active";

  // Fallback by date
  const now = new Date();
  const endDate = parseISO(sub.end_date);
  const daysLeft = differenceInDays(endDate, now);
  if (daysLeft < 0) return "expired";
  return "active";
}
```

#### 3. Aplicar a mesma correcao no enrichSub

Garantir que `rawApiStatus` tambem extraia o nome correto do status para exibicao:

```typescript
const rawApiStatus = typeof sub.status === "object" && sub.status !== null
  ? (sub.status as any).name || JSON.stringify(sub.status)
  : String(sub.status || "UNKNOWN");
```

#### 4. Corrigir o mesmo mapeamento na Edge Function (sync)

O mapeamento de status na action `sync-subscriptions` da Edge Function tambem precisa tratar `sub.status` como possivel objeto, para que os dados salvos no banco local estejam corretos:

```typescript
const rawStatus = typeof sub.status === "object" && sub.status !== null
  ? (sub.status.name || sub.status.label || JSON.stringify(sub.status))
  : String(sub.status || "UNKNOWN");
const apiStatus = rawStatus.toLowerCase().trim();
```

#### 5. Re-deploy da Edge Function

Fazer deploy da edge function atualizada e verificar os logs para confirmar os status reais.

### Arquivos modificados
- `src/pages/admin/AdminAssinaturas.tsx` - corrigir `mapStatus` e `enrichSub` para tratar status como objeto
- `supabase/functions/proxybr-api/index.ts` - adicionar debug log e corrigir mapeamento no sync

### Resultado esperado
Apos as correcoes, os numeros de Vencido e Cancelado devem corresponder aos do painel ProxyBR (Vencido=17, Cancelado=2248).
