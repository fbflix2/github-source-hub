

## Diagnosis

I queried the database directly and found the root causes:

### Finding 1: `delivery_data` is NULL for every single proxy order
```
order_id: 81f66f08... | delivery_data: NULL | status: completed (PIX)
order_id: 4ad6050b... | delivery_data: NULL | status: processing (Balance)
order_id: b510c32c... | delivery_data: NULL | status: processing (Balance)
... all 10 recent proxy orders have NULL delivery_data
```

The client-side code that saves `delivery_data` during draft order creation appears correct, but the data never reaches the database. This means the webhook cannot detect proxy orders and never calls the ProxyBR API.

### Finding 2: RLS blocks users from updating their own orders
The `orders` table has NO UPDATE policy for regular users — only admins can update. When the balance flow calls `supabase.from("orders").update({status: "completed"})`, it silently fails due to RLS. That is why balance purchases stay as "Pendente" (status "processing").

The same is true for `order_items` — no user UPDATE policy.

### Finding 3: Webhook skips proxy contracting
The webhook for the PIX order `81f66f08` called `fulfill_order_item` (regular stock fulfillment) instead of the ProxyBR contract path, because `delivery_data.type` was not `"proxy_contract"` — it was NULL.

---

## Plan

The fix has two pillars: (A) move proxy purchasing to server-side edge functions so it bypasses RLS and sessionStorage issues entirely, and (B) add missing RLS policies as a general fix.

### 1. Add RLS UPDATE policy on `orders` table

**Migration file.** Allow users to update their own orders:
```sql
CREATE POLICY "Users can update own orders" ON orders
FOR UPDATE USING (auth.uid() = user_id);
```

This fixes balance payments silently failing to mark orders as "completed."

### 2. New action in `proxybr-api`: `purchase-proxy-with-balance`

**File:** `supabase/functions/proxybr-api/index.ts`

Add a new action that handles the ENTIRE balance payment flow server-side:

1. Verify user auth
2. Receive: `order_id`, `product_variant_id`, `quantity`, `interval`, `total`
3. Check user balance >= total (using service_role)
4. Debit balance
5. Call ProxyBR API `POST /subscriptions/contract`
6. Save subscription in `subscriptions` table with `raw_data`
7. Update order status to "completed"
8. Create `wallet_transactions` record
9. Update order_item `delivery_data` with `{type: "proxy_contract", fulfilled: true, subscription_code: ...}`
10. Set ProxyBR notes to user email
11. Return the subscription data

This bypasses all RLS and sessionStorage issues since it runs with service_role.

### 3. Modify `create-pix-payment` to persist proxy data server-side

**File:** `supabase/functions/create-pix-payment/index.ts`

Accept optional `proxy_data` in the request body (containing `product_variant_id`, `quantity`, `interval`). When present, use service_role to UPDATE the order_item's `delivery_data` with `{type: "proxy_contract", product_variant_id, quantity, interval}`.

This ensures the webhook can detect and contract proxy orders for PIX payments, regardless of what happened client-side.

### 4. Update `Checkout.tsx` payment flows

**File:** `src/pages/Checkout.tsx`

**Balance flow:**
- At the start of `handlePay`, read `proxy_purchase` from sessionStorage
- If proxy product AND balance payment: call the new `purchase-proxy-with-balance` action via `supabase.functions.invoke("proxybr-api", ...)` passing `order_id`, `product_variant_id`, `quantity`, `interval`, `total`
- Skip all client-side balance debit, fulfillment, and `contractProxyIfNeeded`
- On success, clear sessionStorage and redirect to `/subscriptions`

**PIX flow:**
- Pass `proxy_data` to `create-pix-payment` so the server stores it in delivery_data
- When PIX is confirmed (poll detects "completed"), redirect to `/subscriptions` if proxy purchase, `/orders` otherwise

**Remove `contractProxyIfNeeded`** entirely — all proxy contracting is now server-side.

### 5. Filter proxy orders from the Orders page

**File:** `src/pages/Orders.tsx`

After fetching orders, filter out orders where all items are proxy products. Check by joining with the `products` table and checking `icon_type = 'proxy'`:

```typescript
// In the fetch query, get product icon_type
const { data: itemsData } = await supabase
  .from("order_items")
  .select("*, products:product_id(icon_type)")
  .in("order_id", orderIds);

// Filter: exclude orders where ALL items are proxy type
const nonProxyOrders = ordersData.filter(order => {
  const items = (itemsData || []).filter(i => i.order_id === order.id);
  const allProxy = items.length > 0 && items.every(i => i.products?.icon_type === 'proxy');
  return !allProxy;
});
```

### 6. Deploy edge functions

Deploy `proxybr-api` and `create-pix-payment` after changes.

---

## Summary of changes

| File | Change |
|------|--------|
| **Migration (new)** | Add RLS UPDATE policy on `orders` for users |
| `supabase/functions/proxybr-api/index.ts` | Add `purchase-proxy-with-balance` action (server-side balance debit + proxy contract) |
| `supabase/functions/create-pix-payment/index.ts` | Accept `proxy_data` param and save to `order_items.delivery_data` using service_role |
| `src/pages/Checkout.tsx` | Balance: call new server-side action. PIX: pass proxy_data. Remove `contractProxyIfNeeded`. Both: redirect to `/subscriptions` for proxy |
| `src/pages/Orders.tsx` | Filter out orders where all items are proxy products |

