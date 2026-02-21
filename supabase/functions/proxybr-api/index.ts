import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROXYBR_BASE = "https://painel.proxybr.com.br/api";

async function proxyFetch(url: string, apiKey: string, method = "GET", body?: string) {
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "X-API-Key": apiKey,
  };
  if (body) headers["Content-Type"] = "application/json";
  return fetch(url, { method, headers, body: body || undefined });
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllSubscriptions(apiKey: string, statusFilter?: string) {
  let allSubs: any[] = [];
  let page = 1;
  const maxPages = 300;
  const DELAY_BETWEEN_PAGES = 2000; // 2s between requests
  const MAX_RETRIES = 5;

  while (page <= maxPages) {
    let url = `${PROXYBR_BASE}/subscriptions?page=${page}`;
    if (statusFilter) url += `&status=${statusFilter}`;
    if (page === 1 || page % 25 === 0) console.log(`Fetching page ${page}. Total so far: ${allSubs.length}`);

    let response: Response | null = null;
    let text = "";
    let success = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      response = await proxyFetch(url, apiKey);
      text = await response.text();

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        // Exponential backoff: 3s, 6s, 12s, 24s, 48s
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 3000 * Math.pow(2, attempt - 1);
        console.warn(`Rate limited on page ${page}, attempt ${attempt}/${MAX_RETRIES}. Waiting ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }
      success = true;
      break;
    }

    if (!success || !response || !response.ok) {
      // If rate limited after all retries, return what we have instead of crashing
      if (response?.status === 429) {
        console.warn(`Persistent rate limit after ${MAX_RETRIES} retries on page ${page}. Returning ${allSubs.length} subs fetched so far.`);
        break;
      }
      console.error(`ProxyBR error [${response?.status}]: ${text.substring(0, 300)}`);
      throw new Error(`ProxyBR API error [${response?.status}]`);
    }

    let parsed: any;
    try { parsed = JSON.parse(text); } catch { throw new Error("Invalid JSON from ProxyBR"); }

    if (Array.isArray(parsed)) {
      if (parsed.length === 0) break;
      if (page === 1) {
        console.log(`First sub keys: ${Object.keys(parsed[0]).join(', ')}`);
        const statusSamples = parsed.slice(0, 5).map((s: any) => ({ code: s.code, status: s.status, statusType: typeof s.status }));
        console.log("STATUS SAMPLES:", JSON.stringify(statusSamples));
      }
      allSubs = [...allSubs, ...parsed];
      page++;
    } else if (parsed?.data && Array.isArray(parsed.data)) {
      if (parsed.data.length === 0) break;
      allSubs = [...allSubs, ...parsed.data];
      const lastPage = parsed.last_page || parsed.meta?.last_page || 1;
      if (page >= lastPage) break;
      page++;
    } else {
      allSubs = [parsed];
      break;
    }

    // Delay between pages to respect rate limits
    await sleep(DELAY_BETWEEN_PAGES);
  }

  console.log(`Total subscriptions fetched: ${allSubs.length}`);

  // Parse proxy codes into structured objects
  return allSubs.map((sub: any) => {
    if (sub.proxies?.data && Array.isArray(sub.proxies.data)) {
      sub.proxies.data = sub.proxies.data.map((p: any) => {
        if (p.code && typeof p.code === "string") {
          const parts = p.code.split(":");
          if (parts.length >= 4) {
            p.parsed = {
              ip: parts[0],
              port: parseInt(parts[1], 10),
              username: parts[2],
              password: parts[3],
            };
          }
        }
        return p;
      });
    }
    return sub;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PROXYBR_API_KEY = Deno.env.get("PROXYBR_API_KEY");
    if (!PROXYBR_API_KEY) {
      throw new Error("PROXYBR_API_KEY is not configured");
    }

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Auth error:", claimsError?.message);
      return new Response(JSON.stringify({ error: "Token inválido ou expirado. Faça login novamente." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const user = { id: claimsData.claims.sub as string, email: claimsData.claims.email as string };

    const { action, ...params } = await req.json();

    // Update notes on a ProxyBR subscription
    if (action === "update-subscription-notes") {
      const { subscriptionCode, notes } = params as { subscriptionCode: string; notes: string };
      if (!subscriptionCode) throw new Error("subscriptionCode é obrigatório");
      if (typeof notes !== "string") throw new Error("notes é obrigatório");

      const updateUrl = `${PROXYBR_BASE}/subscriptions/${subscriptionCode}`;
      console.log(`Updating ProxyBR notes for ${subscriptionCode}: "${notes}"`);
      const updateResp = await proxyFetch(updateUrl, PROXYBR_API_KEY, "PUT", JSON.stringify({ notes }));
      const updateText = await updateResp.text();
      console.log(`ProxyBR update-notes response [${updateResp.status}]: ${updateText.substring(0, 300)}`);

      if (!updateResp.ok) {
        return new Response(
          JSON.stringify({ error: `ProxyBR API error [${updateResp.status}]`, details: updateText }),
          { status: updateResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let updateData;
      try { updateData = JSON.parse(updateText); } catch { updateData = { raw: updateText }; }
      return new Response(
        JSON.stringify(updateData),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle paginated get-all-subscriptions (fetches a batch of API pages per call)
    if (action === "get-all-subscriptions") {
      const statusFilter = (params as any).status || undefined;
      const startPage = (params as any).startPage || 1;
      const maxPages = 1; // single page per call to stay within compute limits

      let subs: any[] = [];
      let page = startPage;
      const endPage = startPage + maxPages - 1;
      const DELAY = 500;
      const MAX_RETRIES = 3;
      let hitEnd = false;

      while (page <= endPage) {
        let url = `${PROXYBR_BASE}/subscriptions?page=${page}`;
        if (statusFilter) url += `&status=${statusFilter}`;

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
          // Return what we have so far
          console.warn(`Stopping at page ${page} due to error ${response?.status}. Returning ${subs.length} subs.`);
          hitEnd = true;
          break;
        }

        let parsed: any;
        try { parsed = JSON.parse(text); } catch { hitEnd = true; break; }

        if (Array.isArray(parsed)) {
          if (parsed.length === 0) { hitEnd = true; break; }
          // Parse proxy codes
          for (const sub of parsed) {
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
          subs = [...subs, ...parsed];
        } else if (parsed?.data && Array.isArray(parsed.data)) {
          if (parsed.data.length === 0) { hitEnd = true; break; }
          subs = [...subs, ...parsed.data];
          const lastPage = parsed.last_page || parsed.meta?.last_page || 1;
          if (page >= lastPage) { hitEnd = true; break; }
        } else {
          subs = [parsed];
          hitEnd = true;
          break;
        }

        page++;
        if (page <= endPage) await sleep(DELAY);
      }

      return new Response(
        JSON.stringify({ data: subs, nextPage: hitEnd ? null : page, fetched: subs.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sync subscriptions to local DB with auto-linking by email (background processing)
    if (action === "sync-subscriptions") {
      // Verify admin
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) throw new Error("Sem permissão de administrador");

      // Background sync: fetch pages one at a time and upsert
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

          console.log(`Sync: ${emailToUserId.size} emails, ${nameToUserId.size} names loaded`);

          let synced = 0, linked = 0, page = 1;
          const DELAY = 500;
          const MAX_RETRIES = 3;

          while (true) {
            let url = `${PROXYBR_BASE}/subscriptions?page=${page}`;
            let response: Response | null = null;
            let text = "";
            let success = false;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
              response = await proxyFetch(url, PROXYBR_API_KEY);
              text = await response.text();
              if (response.status === 429) {
                const waitMs = 3000 * Math.pow(2, attempt - 1);
                console.warn(`Sync rate limited page ${page}, attempt ${attempt}. Waiting ${waitMs}ms`);
                await sleep(waitMs);
                continue;
              }
              success = true;
              break;
            }

            if (!success || !response || !response.ok) {
              console.warn(`Sync stopping at page ${page}. Synced so far: ${synced}`);
              break;
            }

            let parsed: any;
            try { parsed = JSON.parse(text); } catch { break; }

            const items = Array.isArray(parsed) ? parsed : parsed?.data;
            if (!items?.length) break;

            if (page % 25 === 0 || page === 1) {
              const statusSample = items.slice(0, 3).map((s: any) => s.status);
              console.log(`Sync page ${page}, total synced: ${synced}, sample statuses: ${JSON.stringify(statusSample)}`);
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
                else mappedStatus = "active";
              } else {
                console.warn(`Unknown ProxyBR status: "${sub.status}" (normalized: "${apiStatus}")`);
                mappedStatus = "active";
              }

              const record: Record<string, any> = {
                name: code, type: "proxybr", status: mappedStatus,
                start_date: startDateStr, end_date: endDateStr,
                auto_renew: sub.auto_renew_active ?? false,
              };

              const { data: existing } = await supabaseAdmin
                .from("subscriptions").select("id, user_id").eq("name", code).eq("type", "proxybr").maybeSingle();

              if (existing) {
                const keepUserId = existing.user_id !== user.id ? existing.user_id : (matchedUserId || existing.user_id);
                if (matchedUserId && existing.user_id === user.id) { record.user_id = matchedUserId; linked++; }
                else { record.user_id = keepUserId; if (keepUserId !== user.id) linked++; }
                await supabaseAdmin.from("subscriptions").update(record).eq("id", existing.id);
              } else {
                record.user_id = matchedUserId || user.id;
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

          console.log(`Sync complete: ${synced} synced, ${linked} linked`);

          // Store result in site_settings for frontend polling
          await supabaseAdmin.from("site_settings").upsert({
            key: "sync_result",
            value: JSON.stringify({ synced, linked, total: synced, status: "done", timestamp: Date.now() }),
          }, { onConflict: "key" });

        } catch (err: any) {
          console.error("Background sync error:", err.message);
          const supabaseAdmin2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
          await supabaseAdmin2.from("site_settings").upsert({
            key: "sync_result",
            value: JSON.stringify({ status: "error", error: err.message, timestamp: Date.now() }),
          }, { onConflict: "key" });
        }
      };

      // Store "in_progress" status
      await supabaseAdmin.from("site_settings").upsert({
        key: "sync_result",
        value: JSON.stringify({ status: "in_progress", timestamp: Date.now() }),
      }, { onConflict: "key" });

      // Run in background
      (globalThis as any).EdgeRuntime.waitUntil(doSync());

      return new Response(
        JSON.stringify({ status: "started", message: "Sincronização iniciada em segundo plano" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let url: string;
    let method = "GET";
    let body: string | undefined;

    switch (action) {
      case "get-me":
        url = `${PROXYBR_BASE}/me`;
        break;

      case "get-products":
        url = `${PROXYBR_BASE}/products`;
        break;

      case "get-subscriptions":
        url = `${PROXYBR_BASE}/subscriptions`;
        break;

      case "get-subscription":
        if (!params.subscriptionCode) throw new Error("subscriptionCode é obrigatório");
        url = `${PROXYBR_BASE}/subscriptions/${params.subscriptionCode}`;
        break;

      case "contract-subscription": {
        url = `${PROXYBR_BASE}/subscriptions/contract`;
        method = "POST";
        body = JSON.stringify({
          quantity: params.quantity,
          interval: params.interval,
          product_variant_id: params.product_variant_id,
          discount_coupon: params.discount_coupon || null,
        });

        // Make the API call here to save locally with user_id
        console.log(`ProxyBR API call: POST ${url}`);
        const contractResponse = await proxyFetch(url, PROXYBR_API_KEY, "POST", body);
        const contractText = await contractResponse.text();
        console.log(`ProxyBR contract response [${contractResponse.status}]: ${contractText.substring(0, 500)}`);

        let contractData: any;
        try { contractData = JSON.parse(contractText); } catch { contractData = { raw: contractText }; }

        if (!contractResponse.ok) {
          return new Response(
            JSON.stringify({ error: `ProxyBR API error [${contractResponse.status}]`, details: contractData }),
            { status: contractResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Save subscription locally with the buyer's user_id
        const subCode = contractData.code || contractData.data?.code;
        const endDate = contractData.due_date || contractData.end_date || null;
        if (subCode) {
          const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );
          const { data: existingSub } = await supabaseAdmin
            .from("subscriptions")
            .select("id")
            .eq("name", subCode)
            .eq("type", "proxybr")
            .maybeSingle();

          if (existingSub) {
            await supabaseAdmin.from("subscriptions").update({
              user_id: user.id,
              status: "active",
              end_date: endDate || null,
              auto_renew: contractData.auto_renew_active ?? false,
            }).eq("id", existingSub.id);
          } else {
            await supabaseAdmin.from("subscriptions").insert({
              name: subCode,
              type: "proxybr",
              status: "active",
              user_id: user.id,
              start_date: new Date().toISOString(),
              end_date: endDate || null,
              auto_renew: contractData.auto_renew_active ?? false,
            });
          }
          console.log(`Saved subscription ${subCode} linked to user ${user.id}`);

          // Push buyer's email to ProxyBR notes for future sync matching
          try {
            const notesUrl = `${PROXYBR_BASE}/subscriptions/${subCode}`;
            console.log(`Setting ProxyBR notes for ${subCode} to "${user.email}"`);
            const notesResp = await proxyFetch(notesUrl, PROXYBR_API_KEY, "PUT", JSON.stringify({ notes: user.email }));
            console.log(`ProxyBR notes update [${notesResp.status}]`);
          } catch (e) {
            console.error(`Failed to update ProxyBR notes: ${e}`);
          }
        }

        return new Response(
          JSON.stringify(contractData),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "renew-subscription":
        if (!params.subscriptionCode) throw new Error("subscriptionCode é obrigatório");
        url = `${PROXYBR_BASE}/subscriptions/${params.subscriptionCode}/renew`;
        method = "POST";
        break;

      case "exchange-proxy":
        if (!params.subscriptionCode) throw new Error("subscriptionCode é obrigatório");
        if (!params.proxy_id) throw new Error("proxy_id é obrigatório");
        url = `${PROXYBR_BASE}/subscriptions/${params.subscriptionCode}/exchange-proxy`;
        method = "PUT";
        body = JSON.stringify({ proxy_id: params.proxy_id });
        break;

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    console.log(`ProxyBR API call: ${method} ${url}`);

    const response = await proxyFetch(url, PROXYBR_API_KEY, method, body);
    const responseText = await response.text();
    console.log(`ProxyBR response [${response.status}]: ${responseText.substring(0, 500)}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `ProxyBR API error [${response.status}]`, details: data }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("proxybr-api error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
