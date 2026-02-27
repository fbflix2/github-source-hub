

## Problem

ProxyBR treats a subscription as a "package" that can contain 1 or more proxies. Currently, the code only reads `proxies.data[0]` — ignoring any additional proxies in the same subscription. Users who purchased multiple proxies in one subscription can only see/manage the first one.

## Approach: "Explode" multi-proxy subscriptions into individual virtual cards

Each proxy within a subscription becomes its own card/entry in the UI. They share the same subscription metadata (dates, status, auto-renew) but each has its own proxy credentials and individual exchange capability.

## Implementation Steps

### 1. Update `useProxyBRSubscriptions` hook (`src/hooks/useProxyBR.ts`)
- Instead of mapping each subscription to 1 entry with `proxies.data[0]`, iterate over ALL proxies in `raw.proxies.data`
- For subscriptions with N proxies, emit N entries
- Each entry gets a unique display code: `{sub.name}` for single-proxy subs, `{sub.name} #1`, `{sub.name} #2`, etc. for multi-proxy subs
- Each entry carries its specific `proxy.id` for targeted exchange
- Add a `proxyIndex` and `totalProxies` field so the UI can show "Proxy 2 de 5"

### 2. Update `ProxySubscription` interface (`src/pages/Subscriptions.tsx`)
- Add optional fields: `proxyIndex?: number`, `totalProxies?: number`, `proxyLabel?: string`

### 3. Update `SubscriptionCard` (`src/components/subscriptions/SubscriptionCard.tsx`)
- Show a small badge like "Proxy 2/5" when `totalProxies > 1` to indicate it's part of a multi-proxy package

### 4. Update `SubscriptionManage` page (`src/pages/SubscriptionManage.tsx`)
- Find the subscription by code AND proxy index (use query param or encode in URL)
- Pass `proxy_id` to `exchangeMutation.mutate()` so the exchange targets the specific proxy, not a random one

### 5. Update exchange mutation routing
- The `useExchangeProxy` hook already accepts `proxy_id` as an optional param — just ensure the management page passes it correctly from the exploded entry

### Technical Detail
The key change in the hook:
```typescript
// Before: returns 1 entry per subscription
const proxy = raw.proxies?.data?.[0] || null;

// After: returns N entries per subscription (1 per proxy)
const proxies = raw.proxies?.data || [];
if (proxies.length <= 1) {
  // single proxy — same as before
} else {
  // emit one entry per proxy with proxyIndex
}
```

URL scheme for multi-proxy management: `/subscriptions/{code}?proxy={proxyId}` — the proxy ID from the API uniquely identifies which proxy to show/exchange.

