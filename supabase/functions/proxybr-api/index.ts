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
  const DELAY_BETWEEN_PAGES = 2000;
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
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 3000 * Math.pow(2, attempt - 1);
        console.warn(`Rate limited on page ${page}, attempt ${attempt}/${MAX_RETRIES}. Waiting ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }
      success = true;
      break;
    }

    if (!success || !response || !response.ok) {
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

    await sleep(DELAY_BETWEEN_PAGES);
  }

  console.log(`Total subscriptions fetched: ${allSubs.length}`);

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
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      console.error("proxybr-api error:", authError?.message || "No user");
      return new Response(JSON.stringify({ error: "Token inválido ou expirado. Faça login novamente." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const user = { id: authUser.id, email: authUser.email || "" };

    const { action, ...params } = await req.json();

    // =============================================
    // NEW: Purchase proxy with balance (server-side)
    // =============================================
    if (action === "purchase-proxy-with-balance") {
      const { order_id, product_variant_id, quantity, interval, total } = params as {
        order_id: string;
        product_variant_id: number;
        quantity: number;
        interval: string;
        total: number;
      };

      if (!order_id || !product_variant_id || !total) {
        throw new Error("Parâmetros obrigatórios: order_id, product_variant_id, total");
      }

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // 1. Check balance
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile) throw new Error("Perfil não encontrado");
      if (profile.balance < total) {
        throw new Error(`Saldo insuficiente. Você tem R$ ${profile.balance.toFixed(2)} e precisa de R$ ${total.toFixed(2)}`);
      }

      // 2. Contract proxy via ProxyBR API
      console.log(`[purchase-proxy-with-balance] Contracting proxy: variant=${product_variant_id}, qty=${quantity || 1}, interval=${interval || "monthly"}`);
      const contractUrl = `${PROXYBR_BASE}/subscriptions/contract`;
      const contractResp = await proxyFetch(contractUrl, PROXYBR_API_KEY, "POST", JSON.stringify({
        quantity: quantity || 1,
        interval: interval || "monthly",
        product_variant_id,
      }));
      const contractText = await contractResp.text();
      console.log(`[purchase-proxy-with-balance] ProxyBR response [${contractResp.status}]: ${contractText.substring(0, 500)}`);

      if (!contractResp.ok) {
        let errDetails: any;
        try { errDetails = JSON.parse(contractText); } catch { errDetails = contractText; }
        throw new Error(`Erro ao contratar proxy: ${JSON.stringify(errDetails)}`);
      }

      let contractData: any;
      try { contractData = JSON.parse(contractText); } catch { contractData = {}; }

      const subCode = contractData.subscription?.code || contractData.code || contractData.data?.code;
      let endDate = contractData.subscription?.due_date || contractData.due_date || contractData.end_date || null;

      // Always fetch subscription details to get due_date, product info, and proxy data
      if (subCode) {
        try {
          console.log(`[purchase-proxy-with-balance] Fetching subscription details for ${subCode}`);
          const detailResp = await proxyFetch(`${PROXYBR_BASE}/subscriptions/${subCode}`, PROXYBR_API_KEY);
          if (detailResp.ok) {
            const detailText = await detailResp.text();
            const detailData = JSON.parse(detailText);
            console.log(`[purchase-proxy-with-balance] Detail response: ${detailText.substring(0, 800)}`);
            if (!endDate) {
              endDate = detailData.due_date || detailData.end_date || null;
            }
            // Parse proxy codes
            if (detailData.proxies?.data && Array.isArray(detailData.proxies.data)) {
              detailData.proxies.data = detailData.proxies.data.map((p: any) => {
                if (p.code && typeof p.code === "string") {
                  const parts = p.code.split(":");
                  if (parts.length >= 4) {
                    p.parsed = { ip: parts[0], port: parseInt(parts[1], 10), username: parts[2], password: parts[3] };
                  }
                }
                return p;
              });
            }
            // Merge full details into contractData for raw_data storage
            if (detailData) {
              contractData = { ...contractData, subscription: { ...contractData.subscription, ...detailData } };
            }
          }
        } catch (e) {
          console.error(`[purchase-proxy-with-balance] Failed to fetch sub details: ${e}`);
        }
        // Fallback: calculate end_date if still missing
        if (!endDate) {
          const now = new Date();
          if ((interval || "monthly") === "quarterly") {
            now.setMonth(now.getMonth() + 3);
          } else {
            now.setMonth(now.getMonth() + 1);
          }
          endDate = now.toISOString();
        }
      }

      // 3. Debit balance
      const newBalance = profile.balance - total;
      await supabaseAdmin.from("profiles").update({ balance: newBalance }).eq("user_id", user.id);

      // 4. Create wallet transaction
      await supabaseAdmin.from("wallet_transactions").insert({
        user_id: user.id,
        type: "purchase",
        title: `Compra Proxy #${subCode || order_id.slice(0, 8)}`,
        amount: -total,
        balance_after: newBalance,
        reference_id: order_id,
      });

      // 5. Update order status to completed
      await supabaseAdmin.from("orders").update({
        status: "completed",
        payment_method: "saldo",
      }).eq("id", order_id);

      // 6. Save subscription locally
      if (subCode) {
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
            auto_renew: contractData.subscription?.auto_renew_active ?? contractData.auto_renew_active ?? false,
            raw_data: contractData.subscription || contractData,
          }).eq("id", existingSub.id);
        } else {
          await supabaseAdmin.from("subscriptions").insert({
            name: subCode,
            type: "proxybr",
            status: "active",
            user_id: user.id,
            start_date: new Date().toISOString(),
            end_date: endDate || null,
            auto_renew: contractData.subscription?.auto_renew_active ?? contractData.auto_renew_active ?? false,
            raw_data: contractData.subscription || contractData,
          });
        }
        console.log(`[purchase-proxy-with-balance] Saved subscription ${subCode} for user ${user.id}`);

        // 7. Set ProxyBR notes to user email
        try {
          const notesUrl = `${PROXYBR_BASE}/subscriptions/${subCode}`;
          await proxyFetch(notesUrl, PROXYBR_API_KEY, "PUT", JSON.stringify({ notes: user.email }));
          console.log(`[purchase-proxy-with-balance] Set notes for ${subCode} to ${user.email}`);
        } catch (e) {
          console.error(`Failed to set ProxyBR notes: ${e}`);
        }
      }

      // 8. Update order_item delivery_data
      const { data: orderItems } = await supabaseAdmin
        .from("order_items")
        .select("id")
        .eq("order_id", order_id);

      if (orderItems && orderItems.length > 0) {
        await supabaseAdmin.from("order_items").update({
          delivery_data: {
            type: "proxy_contract",
            fulfilled: true,
            subscription_code: subCode || null,
            product_variant_id,
            quantity: quantity || 1,
            interval: interval || "monthly",
          },
        }).eq("id", orderItems[0].id);
      }

      console.log(`[purchase-proxy-with-balance] Complete for order ${order_id}`);

      return new Response(
        JSON.stringify({ success: true, subscription_code: subCode, contract_data: contractData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Toggle auto-renew on a subscription (local only - ProxyBR API doesn't support PUT on subscriptions)
    if (action === "toggle-auto-renew") {
      const { subscriptionCode, auto_renew } = params as { subscriptionCode: string; auto_renew: boolean };
      if (!subscriptionCode) throw new Error("subscriptionCode é obrigatório");

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({ auto_renew })
        .eq("name", subscriptionCode)
        .eq("type", "proxybr");

      if (error) throw new Error(`Erro ao atualizar: ${error.message}`);

      console.log(`Auto-renew for ${subscriptionCode} set to ${auto_renew} (local)`);

      return new Response(
        JSON.stringify({ success: true, auto_renew }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      const maxPages = 1;

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
          console.warn(`Stopping at page ${page} due to error ${response?.status}. Returning ${subs.length} subs.`);
          hitEnd = true;
          break;
        }

        let parsed: any;
        try { parsed = JSON.parse(text); } catch { hitEnd = true; break; }

        if (Array.isArray(parsed)) {
          if (parsed.length === 0) { hitEnd = true; break; }
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

      const doSync = async () => {
        try {
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
                raw_data: sub,
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

      await supabaseAdmin.from("site_settings").upsert({
        key: "sync_result",
        value: JSON.stringify({ status: "in_progress", timestamp: Date.now() }),
      }, { onConflict: "key" });

      (globalThis as any).EdgeRuntime.waitUntil(doSync());

      return new Response(
        JSON.stringify({ status: "started", message: "Sincronização iniciada em segundo plano" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Quick count check
    if (action === "check-subscription-count") {
      const url = `${PROXYBR_BASE}/subscriptions?page=1`;
      const resp = await proxyFetch(url, PROXYBR_API_KEY);
      const text = await resp.text();
      if (!resp.ok) throw new Error(`ProxyBR API error [${resp.status}]`);
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { throw new Error("Invalid JSON from ProxyBR"); }
      
      let apiTotal = 0;
      if (parsed?.total) apiTotal = parsed.total;
      else if (parsed?.meta?.total) apiTotal = parsed.meta.total;
      else if (Array.isArray(parsed)) {
        apiTotal = parsed.length;
      } else if (parsed?.data) {
        apiTotal = parsed.total || parsed.meta?.total || parsed.data.length;
      }

      return new Response(
        JSON.stringify({ apiTotal }),
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
              raw_data: contractData,
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
              raw_data: contractData,
            });
          }
          console.log(`Saved subscription ${subCode} linked to user ${user.id}`);

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
        url = `${PROXYBR_BASE}/subscriptions/${params.subscriptionCode}/exchange-proxy`;
        method = "PUT";
        body = params.proxy_id ? JSON.stringify({ proxy_id: params.proxy_id }) : undefined;
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
