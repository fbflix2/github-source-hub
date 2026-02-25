

## Diagnosis

After tracing the entire purchase flow, I found **two bugs** preventing proxy subscriptions from appearing:

### Bug 1: `sessionStorage` already cleared before redirect check (critical)

In `Checkout.tsx`, the `contractProxyIfNeeded()` function (line 294) calls `sessionStorage.removeItem("proxy_purchase")` upon success. Then on line 566, the code checks `sessionStorage.getItem("proxy_purchase")` again — but it's already been removed. This means `isProxyPurchase` is **always `false`**, and the user **always** gets redirected to `/orders` instead of `/subscriptions`.

The same issue exists in the PIX flow (line 311 calls `contractProxyIfNeeded` which removes it, then line 314 checks it again).

### Bug 2: Edge function contract never executes (no logs)

The ProxyBR edge function logs show **zero** contract-subscription calls. This means the `supabase.functions.invoke("proxybr-api", ...)` call is either:
- Failing silently (the error toast appears but the user may not notice it among other toasts)
- Or the `sessionStorage` data is missing by the time `contractProxyIfNeeded` is called

Looking at the flow: the draft order is created in a `useEffect` (line 253). This effect reads `sessionStorage.getItem("proxy_purchase")` to store `delivery_data`. The `contractProxyIfNeeded` function also reads from the same sessionStorage. However, there's a timing issue — if the product state isn't set correctly (e.g., proxy product from cart without a DB product ID), the useEffect may not fire, and `delivery_data` may be null.

More critically: looking at the edge function auth, it uses `supabase.auth.getUser(token)` which should work. But the **real issue** is likely that when paying with balance, the function invoke happens but returns an error that gets swallowed. The user sees "Pedido realizado com sucesso!" and gets redirected to `/orders` before they notice the proxy activation error.

---

## Plan

### 1. Fix `sessionStorage` race condition in both flows

**File:** `src/pages/Checkout.tsx`

Save `isProxyPurchase` **before** calling `contractProxyIfNeeded()`, since that function removes the sessionStorage item.

**Balance flow (lines 563-569):**
```typescript
const isProxyPurchase = !!sessionStorage.getItem("proxy_purchase");
await contractProxyIfNeeded();
sessionStorage.removeItem("proxy_purchase");
toast.success("Pedido realizado com sucesso!");
navigate(isProxyPurchase ? "/subscriptions" : "/orders");
```

**PIX flow (lines 310-319):**
```typescript
const isProxyPurchase = !!sessionStorage.getItem("proxy_purchase");
await contractProxyIfNeeded();
sessionStorage.removeItem("proxy_purchase");
toast.success("Pagamento confirmado! Pedido criado.");
setTimeout(() => {
  setPixModal(false);
  navigate(isProxyPurchase ? "/subscriptions" : "/orders");
}, 3000);
```

### 2. Add better error visibility in `contractProxyIfNeeded`

Add a `console.error` with the full response when the invoke fails, and ensure the toast message is prominent enough. Also log the full invoke result to help debug:

```typescript
const { data: contractResult, error: contractError } = await supabase.functions.invoke("proxybr-api", { ... });
console.log("[Checkout] contract invoke result:", { contractResult, contractError });
```

### 3. Ensure proxy purchases don't duplicate the `removeItem` call

Remove the `sessionStorage.removeItem("proxy_purchase")` from inside `contractProxyIfNeeded()` (line 294) and only do it in the caller after the redirect target is determined. This prevents the race condition entirely.

---

## Summary of changes

| File | Change |
|------|--------|
| `src/pages/Checkout.tsx` | (1) Save `isProxyPurchase` flag before calling `contractProxyIfNeeded()` in both balance and PIX flows. (2) Remove `sessionStorage.removeItem` from inside `contractProxyIfNeeded` — only clean up in the caller. (3) Add better logging for debugging contract failures. |

