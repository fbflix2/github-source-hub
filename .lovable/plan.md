

# Auto-Linking ProxyBR Subscriptions to Clients

## The Problem

The ProxyBR API does not return any customer/client information in subscription data. All subscriptions appear under your reseller account. The `notes` field (the only custom field available) is currently empty for all 10 existing subscriptions.

## What Already Works

New purchases made through your site via the `contract-subscription` action **already auto-link** the subscription to the buyer's `user_id` in the local `subscriptions` table. This was implemented in the previous update.

## What Doesn't Work

The 10 **existing** subscriptions were created before this linking code existed, and the ProxyBR API has no client data to match against.

## Solution: Two-Part Approach

### Part 1 - Set Notes on Contract (Prevents Future Gaps)

When a client purchases a proxy through your site, the edge function will also **update the `notes` field** in the ProxyBR API with the client's email. This way, if sync is ever needed in the future, the notes field will contain the client's email for automatic matching.

- Modify `contract-subscription` action to call `PUT /subscriptions/{code}` with `notes = user.email` after a successful contract
- This ensures the ProxyBR dashboard also shows the client info

### Part 2 - Batch Update Notes for Existing Subscriptions

Add a new edge function action `update-subscription-notes` that allows the admin to set the `notes` field on an existing ProxyBR subscription. Then add UI in the admin panel to:

1. When manually linking a client to a subscription (existing flow), also **push the client's email to ProxyBR's notes field**
2. This syncs the data back to ProxyBR so the matching works in both directions

### Part 3 - Improved Sync with Notes Matching (Already Working)

The sync logic already matches by email in notes. Once notes are populated (via Part 1 for new subs, Part 2 for existing), automatic linking will work seamlessly.

## Technical Details

### Edge Function Changes (`proxybr-api/index.ts`)

1. **New action `update-subscription-notes`**: Calls `PUT /subscriptions/{code}` on the ProxyBR API to set the notes field
2. **Modified `contract-subscription`**: After successful contract, call the ProxyBR API to set `notes` to the buyer's email
3. **Modified `handleLinkClient` flow**: When admin links a client, also push their email to ProxyBR notes

### Frontend Changes (`AdminAssinaturas.tsx`)

1. Modify `handleLinkClient` to also call the new `update-subscription-notes` action after linking locally
2. This ensures both local DB and ProxyBR are synced

### Flow for Existing 10 Subscriptions

Since the ProxyBR API has no client data, you will need to manually link each of the 10 existing subscriptions using the existing link button in the admin panel. When you do, the system will now also update the ProxyBR notes field, so future syncs will auto-match.

### Flow for All Future Subscriptions

```text
Client buys proxy on your site
  --> contract-subscription called
    --> ProxyBR creates subscription (returns code)
    --> Local DB saves subscription with user_id (auto-linked)
    --> ProxyBR notes updated with client email (for future sync matching)
```

## Summary

| Scenario | Auto-linked? | Action needed |
|----------|-------------|---------------|
| New purchases (future) | Yes, automatically | None |
| Existing 10 subscriptions | No (no API data) | Manual link once via admin panel |
| After manual link | Yes on future syncs | Notes pushed to ProxyBR |

