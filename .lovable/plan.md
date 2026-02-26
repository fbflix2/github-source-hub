

## Diagnosis: Sync Incomplete — ProxyBR has 2458 records, local DB only has 1160

### Root Cause

The ProxyBR API returns **10 items per page** (fixed). With 2458 subscriptions, that's **~246 pages**. The sync function uses a **1 second delay** between pages, meaning a full sync requires ~246 seconds minimum. However, Supabase Edge Functions have a **~150 second wall clock limit** (even with `waitUntil`), so the sync **consistently times out around page 100-120** (~1000-1200 records), never reaching the remaining ~1300 records.

The logs confirm this: the function boots, processes through page 100+, then shuts down without reaching completion or writing the "done" status — leaving the lock stuck at `in_progress`.

### Solution: Resumable Chunked Sync

Modify `sync-subscriptions-cron` to **resume from where it left off** instead of restarting from page 1 each time:

1. **Persist progress** — Save the last successfully processed page number in `site_settings` (key: `sync_progress`) after each batch of pages
2. **Resume on next run** — On startup, read the last page and continue from there instead of page 1
3. **Reduce delay** — Drop inter-page delay from 1000ms to 400ms (the API allows this based on rate limit behavior)
4. **Process in chunks of ~80 pages per run** (~80 seconds) — well within the timeout limit
5. **Mark "done" only when API returns empty** — then reset progress to page 1 for next full cycle
6. **Fix stuck lock** — Reset `sync_result` to idle when resuming, so cron runs aren't blocked

### Changes

**File: `supabase/functions/sync-subscriptions-cron/index.ts`**
- Read `sync_progress` from `site_settings` to get `lastPage` (default: 1)
- Change `let page = 1` to `let page = lastPage`
- Reduce `DELAY` from 1000 to 400
- Add `MAX_PAGES_PER_RUN = 80` limit per execution
- After processing each batch of 10 pages, persist current page to `sync_progress`
- When API returns empty (all pages done), reset `sync_progress` to 1 and mark status "done"
- When hitting `MAX_PAGES_PER_RUN`, save progress and mark status "partial_done" so next cron picks up

This means a full sync of 246 pages will complete across **3 cron runs** (~3 minutes total with 10-minute cron interval = ~30 minutes for full sync), but each run stays safely within timeout limits.

