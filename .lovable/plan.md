

## Root Cause Analysis

The dashboard loading spinner persists because of two interacting issues:

1. **ProxyBRLowBalanceAlert calls `refreshSession()` on every query**, which triggers `TOKEN_REFRESHED` events in `useAdminAuth`, causing re-verification of admin role. This creates a cascade of auth state changes during dashboard load.

2. **The session keep-alive in `client.ts`** also calls `refreshSession()`, which triggers additional `TOKEN_REFRESHED` events, compounding the issue.

3. **The `page_requests` query using `as any`** can throw runtime errors if the Supabase types don't include the table, potentially crashing the component tree.

## Implementation Plan

### 1. Fix ProxyBRLowBalanceAlert - Remove redundant refreshSession()
- Remove the manual `await supabase.auth.refreshSession()` call from the queryFn since the client.ts keep-alive already handles this
- The `retry: false` and error handling already cover 401 errors adequately

### 2. Fix useAdminAuth - Don't re-verify on TOKEN_REFRESHED
- Remove or simplify the `TOKEN_REFRESHED` handler in `onAuthStateChange` to avoid re-running `verifyRole` on every token refresh
- Once the role is verified on mount, trust it until SIGNED_OUT

### 3. Harden PageRequestNotification
- Wrap the `from("page_requests" as any)` query more defensively
- Ensure runtime errors don't propagate and crash the admin layout

