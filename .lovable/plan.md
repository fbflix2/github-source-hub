

## Problem Analysis

The error "O campo proxy id selecionado é inválido" persists because the `proxy_id` stored locally (518923) is stale/invalid in the ProxyBR API. The local database has an outdated proxy ID that no longer matches what ProxyBR expects.

## Root Cause

The proxy_id cached in the local `subscriptions` table's `raw_data` does not match the current proxy_id on the ProxyBR side. This can happen after syncs or when the API reassigns internal IDs.

## Solution

Modify the `exchange-proxy` action in the edge function to **first fetch the subscription's current data from ProxyBR** to get the real/current `proxy_id`, then use that for the exchange request. This makes the exchange self-correcting regardless of local cache state.

### Changes

1. **`supabase/functions/proxybr-api/index.ts`** -- In the `exchange-proxy` case:
   - Before calling the exchange endpoint, fetch `GET /subscriptions/{code}` from ProxyBR
   - Extract the current proxy_id from the response (from `proxies.data[0].id` for single-proxy subs, or use the provided proxy_id to match for multi-proxy)
   - Use that fresh proxy_id in the PUT request body
   - Log the fresh vs stale proxy_id for debugging

2. **No frontend changes needed** -- The fix is entirely server-side.

### Technical Detail

```text
Current flow:
  Client sends proxy_id=518923 → Edge Function forwards to ProxyBR → 422 "inválido"

New flow:
  Client sends proxy_id (or not) → Edge Function fetches GET /subscriptions/{code}
  → Extracts real proxy_id from response → Uses real proxy_id in PUT exchange → Success
```

