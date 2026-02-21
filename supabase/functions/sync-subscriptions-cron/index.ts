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

async function proxyFetch(url: string, apiKey: string, method = "GET", body?: string) {
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "X-API-Key": apiKey,
  };
  if (body) headers["Content-Type"] = "application/json";
  return fetch(url, { method, headers, body: body || undefined });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PROXYBR_API_KEY = Deno.env.get("PROXYBR_API_KEY");
    if (!PROXYBR_API_KEY) throw new Error("PROXYBR_API_KEY not configured");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if a sync is already in progress
    const { data: currentStatus } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", "sync_result")
      .maybeSingle();

    if (currentStatus?.value) {
      try {
        const parsed = JSON.parse(currentStatus.value);
        if (parsed.status === "in_progress") {
          // If in_progress for more than 15 minutes, consider it stale
          const elapsed = Date.now() - (parsed.timestamp || 0);
          if (elapsed < 15 * 60 * 1000) {
            console.log("Sync already in progress, skipping cron run");
            return new Response(
              JSON.stringify({ status: "skipped", reason: "sync already in progress" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch { }
    }

    // Mark as in_progress
    await supabaseAdmin.from("site_settings").upsert({
      key: "sync_result",
      value: JSON.stringify({ status: "in_progress", timestamp: Date.now(), source: "cron" }),
    }, { onConflict: "key" });

    // Run sync in background
    const doSync = async () => {
      try {
        // Build email -> user_id map
        const emailToUserId = new Map<string, string>();
        let pg = 1;
        const perPage = 1000;
        while (true) {
          const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page: pg, perPage });
          if (error || !users?.length) break;
          for (const u of users) {
            if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id);
          }
          if (users.length < perPage) break;
          pg++;
        }

        const nameToUserId = new Map<string, string>();
        const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, full_name");
        if (profiles) {
          for (const p of profiles) {
            if (p.full_name) nameToUserId.set(p.full_name.toLowerCase().trim(), p.user_id);
          }
        }

        // We need a fallback admin user_id for unlinked subs
        const { data: adminRoles } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin")
          .limit(1);
        const fallbackUserId = adminRoles?.[0]?.user_id || "00000000-0000-0000-0000-000000000000";

        console.log(`Cron sync: ${emailToUserId.size} emails, ${nameToUserId.size} names loaded`);

        let synced = 0, linked = 0, page = 1;
        const DELAY = 500;
        const MAX_RETRIES = 5;

        while (true) {
          const url = `${PROXYBR_BASE}/subscriptions?page=${page}`;
          let response: Response | null = null;
          let text = "";
          let success = false;

          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            response = await proxyFetch(url, PROXYBR_API_KEY);
            text = await response.text();
            if (response.status === 429) {
              const waitMs = 3000 * Math.pow(2, attempt - 1);
              console.warn(`Cron rate limited page ${page}, attempt ${attempt}. Waiting ${waitMs}ms`);
              await sleep(waitMs);
              continue;
            }
            success = true;
            break;
          }

          if (!success || !response || !response.ok) {
            console.warn(`Cron sync stopping at page ${page}. Synced: ${synced}`);
            break;
          }

          let parsed: any;
          try { parsed = JSON.parse(text); } catch { break; }

          const items = Array.isArray(parsed) ? parsed : parsed?.data;
          if (!items?.length) break;

          if (page % 25 === 0 || page === 1) {
            console.log(`Cron sync page ${page}, total synced: ${synced}`);
          }

          // Parse proxy codes
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

            const notes = (sub.notes || "").toLowerCase().trim();
            let matchedUserId: string | undefined;

            if (notes && emailToUserId.has(notes)) matchedUserId = emailToUserId.get(notes);
            if (!matchedUserId && notes && nameToUserId.has(notes)) matchedUserId = nameToUserId.get(notes);
            if (!matchedUserId && notes) {
              for (const [email, uid] of emailToUserId.entries()) {
                if (notes.includes(email)) { matchedUserId = uid; break; }
              }
            }

            const endDateStr = sub.due_date || sub.end_date || new Date().toISOString();
            const startDateStr = sub.created_at || sub.start_date || new Date().toISOString();
            const rawStatus = typeof sub.status === "object" && sub.status !== null
              ? (sub.status.name || sub.status.label || JSON.stringify(sub.status))
              : String(sub.status || "UNKNOWN");
            const apiStatus = rawStatus.toLowerCase().trim();

            let mappedStatus = "active";
            if (["cancelled", "cancelado", "canceled", "not active"].includes(apiStatus)) mappedStatus = "cancelled";
            else if (["expired", "vencido", "expirado"].includes(apiStatus)) mappedStatus = "expired";
            else if (["pending_renewal", "renovação pendente", "renewal_pending", "pending", "pendente"].includes(apiStatus)) mappedStatus = "pending_renewal";
            else if (["active", "ativo", "enabled"].includes(apiStatus)) {
              const endMs = new Date(endDateStr).getTime();
              if (endMs < Date.now()) mappedStatus = "expired";
            }

            const record: Record<string, any> = {
              name: code, type: "proxybr", status: mappedStatus,
              start_date: startDateStr, end_date: endDateStr,
              auto_renew: sub.auto_renew_active ?? false,
              raw_data: sub,
            };

            const { data: existing } = await supabaseAdmin
              .from("subscriptions").select("id, user_id").eq("name", code).eq("type", "proxybr").maybeSingle();

            if (existing) {
              // Keep existing user_id, only update if we found a match and current is fallback
              if (matchedUserId && existing.user_id === fallbackUserId) {
                record.user_id = matchedUserId;
                linked++;
              }
              await supabaseAdmin.from("subscriptions").update(record).eq("id", existing.id);
            } else {
              record.user_id = matchedUserId || fallbackUserId;
              if (matchedUserId) linked++;
              await supabaseAdmin.from("subscriptions").insert(record);
            }
            synced++;
          }

          const lastPage = parsed?.last_page || parsed?.meta?.last_page;
          if (lastPage && page >= lastPage) break;
          if (Array.isArray(parsed) && parsed.length === 0) break;
          page++;
          await sleep(DELAY);
        }

        console.log(`Cron sync complete: ${synced} synced, ${linked} linked`);

        await supabaseAdmin.from("site_settings").upsert({
          key: "sync_result",
          value: JSON.stringify({ synced, linked, total: synced, status: "done", timestamp: Date.now(), source: "cron" }),
        }, { onConflict: "key" });

      } catch (err: any) {
        console.error("Cron sync error:", err.message);
        const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await sb.from("site_settings").upsert({
          key: "sync_result",
          value: JSON.stringify({ status: "error", error: err.message, timestamp: Date.now(), source: "cron" }),
        }, { onConflict: "key" });
      }
    };

    (globalThis as any).EdgeRuntime.waitUntil(doSync());

    return new Response(
      JSON.stringify({ status: "started", message: "Cron sync iniciado em segundo plano" }),
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

