

## Diagnosis: Sync Updates Failing Due to Missing `user_id`

The edge function logs show the root cause clearly:

```
Upsert batch error at 0: null value in column "user_id" violates not-null constraint
Upsert batch error at 50: null value in column "user_id" violates not-null constraint
... (repeating for every batch)
```

**What's happening:** When updating existing subscriptions (line 264), the `record` object only gets `user_id` set if a new user match is found AND the current user is the fallback admin. Otherwise, `user_id` is omitted. But the upsert operation (line 311) requires `user_id` since the column is `NOT NULL`. This means **every single update batch is failing** -- status changes, end dates, and raw_data are never being updated for existing records.

New subscriptions insert fine (they always get a `user_id`), but existing ones never get their status updated. That's why your local DB shows fewer active/expired -- records that changed status on ProxyBR aren't being reflected locally.

## Fix

**File: `supabase/functions/sync-subscriptions-cron/index.ts`**

On line 258-264, when an existing subscription is found, always carry over the existing `user_id` into the record so the upsert doesn't fail:

```typescript
const existing = existingMap.get(code);
if (existing) {
  // Always include user_id for updates (required NOT NULL column)
  record.user_id = existing.user_id;
  // Override with matched user only if currently assigned to fallback
  if (matchedUserId && existing.user_id === fallbackUserId) {
    record.user_id = matchedUserId;
    linked++;
  }
  toUpdate.push({ id: existing.id, record });
}
```

This is a one-line addition (`record.user_id = existing.user_id;`) that ensures the NOT NULL constraint is satisfied. After deploying, the next cron run will successfully update all existing subscriptions, syncing the status counts to match ProxyBR.

