

## Corrigir mapeamento de status Vencido e Cancelado

### Causa raiz

A API da ProxyBR retorna o campo `status` como a string `"NOT ACTIVE"` para todas as assinaturas que nao estao ativas. O codigo atual nao reconhece esse valor, entao cai no fallback por data e classifica tudo como "expired" (Vencido), resultando em Vencido=2263 e Cancelado=0.

Na realidade, o painel da ProxyBR diferencia assim:
- **"NOT ACTIVE"** = Cancelado (2248 assinaturas)
- **"ACTIVE" com due_date no passado** = Vencido (17 assinaturas)
- **"ACTIVE" com due_date no futuro** = Ativo (192 assinaturas)

### Alteracoes necessarias

#### 1. Atualizar `mapStatus` em `src/pages/admin/AdminAssinaturas.tsx`

Adicionar `"not active"` ao array de status cancelados e ajustar a logica de fallback por data para que assinaturas "ACTIVE" com due_date passada sejam classificadas como "expired" (Vencido):

```typescript
function mapStatus(sub: { status: any; end_date: string }): MappedStatus {
  let raw = sub.status;
  if (raw && typeof raw === "object") {
    raw = raw.name || raw.label || raw.value || JSON.stringify(raw);
  }
  const s = (String(raw) || "").toLowerCase().trim();

  // "NOT ACTIVE" da API = Cancelado
  if (["cancelled", "cancelado", "canceled", "not active"].includes(s)) return "cancelled";
  if (["expired", "vencido", "expirado"].includes(s)) return "expired";
  if (["pending_renewal", "renovacao pendente", "renewal_pending", "pending", "pendente"].includes(s)) return "pending_renewal";

  // "ACTIVE" com due_date no passado = Vencido
  if (["active", "ativo", "enabled"].includes(s)) {
    const now = new Date();
    const endDate = parseISO(sub.end_date);
    const daysLeft = differenceInDays(endDate, now);
    if (daysLeft < 0) return "expired"; // Vencido
    return "active";
  }

  // Fallback generico por data
  const now = new Date();
  const endDate = parseISO(sub.end_date);
  const daysLeft = differenceInDays(endDate, now);
  if (daysLeft < 0) return "expired";
  return "active";
}
```

#### 2. Atualizar o mesmo mapeamento na Edge Function `proxybr-api/index.ts`

No action `sync-subscriptions`, aplicar a mesma logica para que os dados persistidos no banco local tambem estejam corretos:

```typescript
// Adicionar "not active" ao mapeamento de cancelados
if (["cancelled", "cancelado", "canceled", "not active"].includes(apiStatus)) mappedStatus = "cancelled";
else if (["expired", "vencido", "expirado"].includes(apiStatus)) mappedStatus = "expired";
else if (["pending_renewal", ...].includes(apiStatus)) mappedStatus = "pending_renewal";
else if (["active", "ativo", "enabled"].includes(apiStatus)) {
  // ACTIVE com due_date passada = vencido
  const endMs = new Date(endDateStr).getTime();
  if (endMs < Date.now()) mappedStatus = "expired";
  else mappedStatus = "active";
}
```

#### 3. Re-deploy da Edge Function

Fazer deploy da funcao atualizada para que futuras sincronizacoes persistam os status corretos.

### Arquivos modificados
- `src/pages/admin/AdminAssinaturas.tsx` - adicionar "not active" como cancelado no mapStatus
- `supabase/functions/proxybr-api/index.ts` - mesma correcao no sync

### Resultado esperado
- Cancelado: ~2248 (todas as "NOT ACTIVE")
- Vencido: ~17 (as "ACTIVE" com due_date no passado)
- Ativo: ~192 (as "ACTIVE" com due_date no futuro)
- Renovacao pendente: ~4
- Total: ~2461
