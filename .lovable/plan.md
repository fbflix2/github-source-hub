

## Diagnosis

There are **three problems** causing proxy purchases to not appear in the Subscriptions tab:

### Problem 1: `raw_data` not saved on contract (both flows)

In `proxybr-api/index.ts` (lines 536-544), when `contract-subscription` creates a new subscription in the DB, it does **not** include `raw_data: contractData`. The `useProxyBRSubscriptions` hook reads `raw_data` to extract proxy IP/port/credentials and product name. Without `raw_data`, the subscription either doesn't render properly or is missing key fields.

The same issue exists in the webhook (`mercadopago-webhook/index.ts`): when contracting server-side for PIX payments, the `raw_data` is saved, but only from the contract response which may not include `proxies.data` (the proxy details come from a separate GET call).

### Problem 2: Balance payment calls `contractProxyIfNeeded` client-side, which depends on `sessionStorage`

For balance payments (line 562 in Checkout.tsx), `contractProxyIfNeeded()` reads `sessionStorage("proxy_purchase")`. This works if the user stays on the page, but is fragile. More importantly, this duplicates contracting logic -- the `delivery_data` is also stored in `order_items` for webhook use, but the webhook path is only triggered for PIX payments.

### Problem 3: Redirect goes to `/orders` instead of `/subscriptions`

After successful balance payment (line 565), the user is redirected to `/orders`. Proxy purchases should redirect to `/subscriptions` instead.

---

## Plan

### 1. Fix `raw_data` storage in `proxybr-api/index.ts` contract-subscription handler

When saving the subscription (both insert and update), include `raw_data: contractData` so the Subscriptions page can read proxy details and product name.

**File:** `supabase/functions/proxybr-api/index.ts`
- Line 529-534 (update): add `raw_data: contractData`
- Line 536-544 (insert): add `raw_data: contractData`

### 2. Redirect proxy purchases to `/subscriptions` instead of `/orders`

**File:** `src/pages/Checkout.tsx`
- After balance payment success (line 562-565): check if this is a proxy purchase (`sessionStorage` has `proxy_purchase`) and redirect to `/subscriptions` instead of `/orders`
- After PIX confirmation (line 314-317): same logic -- redirect to `/subscriptions` for proxy purchases

### 3. Clean up `sessionStorage` after successful contract

Ensure `sessionStorage.removeItem("proxy_purchase")` is called after the redirect target is determined but before navigation.

### 4. No database changes needed

The `subscriptions` table already has the `raw_data` JSONB column. The fix is purely in the edge function and checkout page code.

---

## Summary of file changes

| File | Change |
|------|--------|
| `supabase/functions/proxybr-api/index.ts` | Add `raw_data: contractData` to both insert and update in `contract-subscription` handler |
| `src/pages/Checkout.tsx` | Redirect to `/subscriptions` instead of `/orders` for proxy purchases (both saldo and PIX flows) |

