import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PROXYBR_BASE = "https://painel.proxybr.com.br/api";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Tries to match a ProxyBR subscription to a local user using all available fields */
function matchUserFromSub(
  sub: any,
  emailToUserId: Map<string, string>,
  nameToUserId: Map<string, string>,
): string | undefined {
  const notes = (sub.notes || "").toLowerCase().trim();

  // 1. Exact email match on notes
  if (notes && emailToUserId.has(notes)) return emailToUserId.get(notes);

  // 2. Exact name match on notes
  if (notes && nameToUserId.has(notes)) return nameToUserId.get(notes);

  // 3. Partial email match in notes
  if (notes) {
    for (const [email, uid] of emailToUserId.entries()) {
      if (notes.includes(email)) return uid;
    }
  }

  // 4. Partial name match in notes
  if (notes) {
    for (const [name, uid] of nameToUserId.entries()) {
      if (name.length >= 4 && notes.includes(name)) return uid;
    }
  }

  return undefined;
}

async function proxyFetch(url: string, apiKey: string) {
  return fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json", "X-API-Key": apiKey },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for cleanup action
    let bodyAction = "";
    try {
      const body = await req.json();
      bodyAction = body?.action || "";
    } catch { }

    const PROXYBR_API_KEY = Deno.env.get("PROXYBR_API_KEY");
    if (!PROXYBR_API_KEY && bodyAction !== "cleanup-cancelled") throw new Error("PROXYBR_API_KEY not configured");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Cleanup cancelled subscriptions
    if (bodyAction === "cleanup-cancelled") {
      const { count, error } = await supabaseAdmin
        .from("subscriptions")
        .delete({ count: "exact" })
        .eq("type", "proxybr")
        .eq("status", "cancelled");
      if (error) throw new Error(`Cleanup error: ${error.message}`);
      return new Response(
        JSON.stringify({ deleted: count, message: `Removed ${count} cancelled subscriptions` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // Read sync_progress to know where to resume
    const { data: progressRow } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", "sync_progress")
      .maybeSingle();

    let startPage = 1;
    if (progressRow?.value) {
      try {
        const prog = JSON.parse(progressRow.value);
        if (prog.lastPage && typeof prog.lastPage === "number" && prog.lastPage > 1) {
          startPage = prog.lastPage;
        }
      } catch { }
    }

    // Check if a sync is already in progress (but allow resume if stuck)
    const { data: currentStatus } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", "sync_result")
      .maybeSingle();

    if (currentStatus?.value) {
      try {
        const parsed = JSON.parse(currentStatus.value);
        if (parsed.status === "in_progress") {
          const elapsed = Date.now() - (parsed.timestamp || 0);
          // Only skip if less than 3 minutes old (reduced from 5 to handle stuck locks faster)
          if (elapsed < 3 * 60 * 1000) {
            console.log("Sync already in progress, skipping cron run");
            return new Response(
              JSON.stringify({ status: "skipped", reason: "sync already in progress" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          // If older than 3 min, it's stuck — proceed and reset
          console.log(`Stuck lock detected (${Math.round(elapsed / 1000)}s old), forcing resume from page ${startPage}`);
        }
      } catch { }
    }

    // Mark as in_progress
    await supabaseAdmin.from("site_settings").upsert({
      key: "sync_result",
      value: JSON.stringify({ status: "in_progress", timestamp: Date.now(), source: "cron", startPage }),
    }, { onConflict: "key" });

    // Run sync in background
    const doSync = async () => {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      try {
        // 1. Build email -> user_id map
        const emailToUserId = new Map<string, string>();
        let pg = 1;
        const perPage = 1000;
        while (true) {
          const { data: { users }, error } = await sb.auth.admin.listUsers({ page: pg, perPage });
          if (error || !users?.length) break;
          for (const u of users) {
            if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id);
          }
          if (users.length < perPage) break;
          pg++;
        }

        const nameToUserId = new Map<string, string>();
        const { data: profiles } = await sb.from("profiles").select("user_id, full_name");
        if (profiles) {
          for (const p of profiles) {
            if (p.full_name) nameToUserId.set(p.full_name.toLowerCase().trim(), p.user_id);
          }
        }

        const { data: adminRoles } = await sb.from("user_roles").select("user_id").eq("role", "admin").limit(1);
        const fallbackUserId = adminRoles?.[0]?.user_id || "00000000-0000-0000-0000-000000000000";

        // 2. Load ALL existing subscriptions from DB at once
        const existingMap = new Map<string, { id: string; user_id: string; status: string; cancelled_at: string | null; raw_data: any }>();
        let offset = 0;
        while (true) {
          const { data: batch } = await sb
            .from("subscriptions")
            .select("id, name, user_id, status, cancelled_at, raw_data")
            .eq("type", "proxybr")
            .range(offset, offset + 999);
          if (!batch?.length) break;
          for (const s of batch) {
            existingMap.set(s.name, { id: s.id, user_id: s.user_id, status: s.status, cancelled_at: s.cancelled_at, raw_data: s.raw_data });
          }
          if (batch.length < 1000) break;
          offset += 1000;
        }

        console.log(`Cron sync: ${emailToUserId.size} emails, ${nameToUserId.size} names, ${existingMap.size} existing subs, resuming from page ${startPage}`);

        // 3. Fetch API pages starting from startPage with chunked limit
        let synced = 0, linked = 0, page = startPage;
        const DELAY = 400;
        const MAX_RETRIES = 5;
        const BATCH_SIZE = 50;
        const MAX_PAGES_PER_RUN = 80;
        const SAVE_PROGRESS_EVERY = 10;
        const toInsert: any[] = [];
        const toUpdate: { id: string; record: Record<string, any> }[] = [];
        const toDelete: string[] = [];
        let pagesProcessed = 0;
        let reachedEnd = false;

        while (pagesProcessed < MAX_PAGES_PER_RUN) {
          const url = `${PROXYBR_BASE}/subscriptions?page=${page}`;
          let response: Response | null = null;
          let text = "";
          let success = false;

          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            response = await proxyFetch(url, PROXYBR_API_KEY);
            text = await response.text();
            if (response.status === 429) {
              const waitMs = 3000 * Math.pow(2, attempt - 1);
              console.warn(`Rate limited page ${page}, attempt ${attempt}. Waiting ${waitMs}ms`);
              await sleep(waitMs);
              continue;
            }
            success = true;
            break;
          }

          if (!success || !response || !response.ok) {
            console.warn(`Stopping at page ${page}. Synced so far: ${synced}`);
            break;
          }

          let parsed: any;
          try { parsed = JSON.parse(text); } catch { break; }

          const items = Array.isArray(parsed) ? parsed : parsed?.data;
          if (!items?.length) {
            reachedEnd = true;
            break;
          }

          if (pagesProcessed % 25 === 0 || pagesProcessed === 0) {
            console.log(`Cron sync page ${page}, items: ${items.length}, pagesProcessed: ${pagesProcessed}`);
          }

          // Parse proxy codes in-place
          for (const sub of items) {
            if (sub.proxies?.data && Array.isArray(sub.proxies.data)) {
              sub.proxies.data = sub.proxies.data.map((p: any) => {
                if (p.code && typeof p.code === "string") {
                  const parts = p.code.split(":");
                  if (parts.length >= 4) {
                    p.parsed = { ip: parts[0], port: parseInt(parts[1], 10), username: parts[2], password: parts[3] };
                  }
                }
                return p;
              });
            }
          }

          for (const sub of items) {
            const code = sub.code;
            if (!code) continue;

            const matchedUserId = matchUserFromSub(sub, emailToUserId, nameToUserId);

            const endDateStr = sub.due_date || sub.end_date || new Date().toISOString();
            const startDateStr = sub.created_at || sub.start_date || new Date().toISOString();
            const rawStatus = typeof sub.status === "object" && sub.status !== null
              ? (sub.status.name || sub.status.label || JSON.stringify(sub.status))
              : String(sub.status || "UNKNOWN");
            const apiStatus = rawStatus.toLowerCase().trim();

            let mappedStatus = "active";
            const isCancelled = ["cancelled", "cancelado", "canceled", "not active"].includes(apiStatus);
            
            if (isCancelled) {
              const existing = existingMap.get(code);
              if (existing) {
                // Mark as cancelled with timestamp if not already cancelled
                if (existing.status !== "cancelled") {
                  const existingRawCancelled = (existing.raw_data || {}) as Record<string, any>;
                  const cancelProfileTags = Object.fromEntries(Object.entries(existingRawCancelled).filter(([k]) => k.startsWith("profile_tag")));
                  const cancelledRaw = { ...sub, ...cancelProfileTags };
                  toUpdate.push({ id: existing.id, record: { 
                    name: code, type: "proxybr", status: "cancelled", 
                    cancelled_at: new Date().toISOString(),
                    user_id: existing.user_id, raw_data: cancelledRaw 
                  }});
                }
                // If already cancelled for 10+ days, mark for deletion
                else if (existing.cancelled_at) {
                  const cancelledMs = new Date(existing.cancelled_at).getTime();
                  const daysSinceCancelled = (Date.now() - cancelledMs) / (1000 * 60 * 60 * 24);
                  if (daysSinceCancelled >= 10) {
                    toDelete.push(existing.id);
                  }
                }
              }
              continue;
            }
            else if (["expired", "vencido", "expirado"].includes(apiStatus)) mappedStatus = "expired";
            else if (["pending_renewal", "renovação pendente", "renewal_pending", "pending", "pendente"].includes(apiStatus)) mappedStatus = "pending_renewal";
            else if (["active", "ativo", "enabled"].includes(apiStatus)) {
              const endMs = new Date(endDateStr).getTime();
              if (endMs < Date.now()) mappedStatus = "expired";
            }

            // For MONTHLY subs, cap end_date to ~35 days from start to prevent accumulated renewals
            const subType = (sub.type || "").toUpperCase();
            let finalEndDate = endDateStr;
            if (subType === "MONTHLY") {
              const apiEnd = new Date(endDateStr).getTime();
              const apiStart = new Date(startDateStr).getTime();
              const daysDuration = (apiEnd - apiStart) / (1000 * 60 * 60 * 24);
              if (daysDuration > 35) {
                const existing = existingMap.get(code);
                if (existing) {
                  // Preserve local end_date instead of API's accumulated one
                  finalEndDate = "__PRESERVE_LOCAL__";
                } else {
                  // New insert: cap to 30 days from now
                  const cappedEnd = new Date();
                  cappedEnd.setDate(cappedEnd.getDate() + 30);
                  finalEndDate = cappedEnd.toISOString();
                }
              }
            }

            // Preserve user-set fields (like profile_tag*) from existing raw_data
            const existingForRaw = existingMap.get(code);
            const existingRaw = (existingForRaw?.raw_data || {}) as Record<string, any>;
            const preservedTags = Object.fromEntries(Object.entries(existingRaw).filter(([k]) => k.startsWith("profile_tag")));
            const mergedRawData = { ...sub, ...preservedTags };

            const record: Record<string, any> = {
              name: code, type: "proxybr", status: mappedStatus,
              start_date: startDateStr, end_date: finalEndDate === "__PRESERVE_LOCAL__" ? undefined : finalEndDate,
              auto_renew: sub.auto_renew_active ?? false,
              raw_data: mergedRawData,
            };

            // Remove end_date from record if preserving local value
            if (finalEndDate === "__PRESERVE_LOCAL__") {
              delete record.end_date;
            }

            const existing = existingMap.get(code);
            if (existing) {
              record.user_id = existing.user_id;
              if (matchedUserId && existing.user_id === fallbackUserId) {
                record.user_id = matchedUserId;
                linked++;
              }
            } else {
              record.user_id = matchedUserId || fallbackUserId;
              if (matchedUserId) linked++;
              toInsert.push(record);
            }
            synced++;
          }

          const lastPage = parsed?.last_page || parsed?.meta?.last_page;
          if (lastPage && page >= lastPage) {
            reachedEnd = true;
            break;
          }
          if (Array.isArray(parsed) && parsed.length === 0) {
            reachedEnd = true;
            break;
          }

          page++;
          pagesProcessed++;

          // Save progress every N pages
          if (pagesProcessed % SAVE_PROGRESS_EVERY === 0) {
            await sb.from("site_settings").upsert({
              key: "sync_progress",
              value: JSON.stringify({ lastPage: page, timestamp: Date.now() }),
            }, { onConflict: "key" });
          }

          await sleep(DELAY);
        }

        // 4. Batch inserts
        if (toInsert.length > 0) {
          for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
            const batch = toInsert.slice(i, i + BATCH_SIZE);
            const { error } = await sb.from("subscriptions").insert(batch);
            if (error) console.error(`Insert batch error at ${i}:`, error.message);
          }
          console.log(`Inserted ${toInsert.length} new subscriptions`);
        }

        // 5. Batch updates (upsert by id)
        if (toUpdate.length > 0) {
          for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
            const batch = toUpdate.slice(i, i + BATCH_SIZE).map(u => ({ id: u.id, ...u.record }));
            const { error } = await sb.from("subscriptions").upsert(batch, { onConflict: "id" });
            if (error) console.error(`Upsert batch error at ${i}:`, error.message);
          }
          console.log(`Updated ${toUpdate.length} existing subscriptions`);
        }

        // 6. Batch deletes (cancelled subs older than 10 days)
        if (toDelete.length > 0) {
          for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
            const batch = toDelete.slice(i, i + BATCH_SIZE);
            const { error } = await sb.from("subscriptions").delete().in("id", batch);
            if (error) console.error(`Delete batch error at ${i}:`, error.message);
          }
          console.log(`Deleted ${toDelete.length} cancelled subscriptions (10+ days old)`);
        }

        if (reachedEnd) {
          // Full sync complete — reset progress to page 1
          console.log(`Cron sync COMPLETE: ${synced} synced, ${linked} linked (started from page ${startPage})`);
          await sb.from("site_settings").upsert({
            key: "sync_progress",
            value: JSON.stringify({ lastPage: 1, timestamp: Date.now(), completed: true }),
          }, { onConflict: "key" });
          await sb.from("site_settings").upsert({
            key: "sync_result",
            value: JSON.stringify({ synced, linked, total: synced, status: "done", timestamp: Date.now(), source: "cron", startPage }),
          }, { onConflict: "key" });
        } else {
          // Partial sync — save where we stopped so next run continues
          console.log(`Cron sync PARTIAL: ${synced} synced, ${linked} linked, stopped at page ${page} (started from ${startPage})`);
          await sb.from("site_settings").upsert({
            key: "sync_progress",
            value: JSON.stringify({ lastPage: page, timestamp: Date.now() }),
          }, { onConflict: "key" });
          await sb.from("site_settings").upsert({
            key: "sync_result",
            value: JSON.stringify({ synced, linked, status: "partial_done", timestamp: Date.now(), source: "cron", startPage, stoppedAt: page }),
          }, { onConflict: "key" });
        }

      } catch (err: any) {
        console.error("Cron sync error:", err.message);
        // Save progress even on error so we can resume
        await sb.from("site_settings").upsert({
          key: "sync_result",
          value: JSON.stringify({ status: "error", error: err.message, timestamp: Date.now(), source: "cron" }),
        }, { onConflict: "key" });
      }
    };

    (globalThis as any).EdgeRuntime.waitUntil(doSync());

    return new Response(
      JSON.stringify({ status: "started", message: `Cron sync iniciado em segundo plano (página ${startPage})` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("sync-subscriptions-cron error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
