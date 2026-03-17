import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBSHARE_BASE = "https://proxy.webshare.io/api/v2";

/** Detect target country from product tags and name */
function detectCountryFromProduct(product: { name: string; tags: string[] | null }): string | null {
  const tags = (product.tags || []) as string[];
  const name = (product.name || "").toLowerCase();

  // Direct country code tags
  const countryTags = ["br", "us", "uk", "de", "fr", "ca", "au", "jp"];
  for (const tag of tags) {
    const lowerTag = tag.toLowerCase().trim();
    if (countryTags.includes(lowerTag)) return lowerTag.toUpperCase();
  }

  // Country name tags (e.g. "Brasil", "Brazil")
  for (const tag of tags) {
    const lt = tag.toLowerCase().trim();
    if (lt === "brasil" || lt === "brazil") return "BR";
    if (lt === "usa" || lt === "estados unidos") return "US";
  }

  // Fallback: check product name
  if (name.includes("brasil") || name.includes("brazil") || name.includes(" br")) return "BR";
  if (name.includes("usa") || name.includes("estados unidos") || name.includes(" us")) return "US";

  return null;
}

async function webFetch(path: string, apiKey: string, method = "GET", body?: string) {
  const url = path.startsWith("http") ? path : `${WEBSHARE_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Token ${apiKey}`,
    Accept: "application/json",
  };
  if (body) headers["Content-Type"] = "application/json";
  const resp = await fetch(url, { method, headers, body: body || undefined });
  if (resp.status === 429) {
    throw new Error("Webshare rate limit atingido. Tente novamente em 60s.");
  }
  return resp;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const WEBSHARE_API_KEY = Deno.env.get("WEBSHARE_API_KEY");
    if (!WEBSHARE_API_KEY) throw new Error("WEBSHARE_API_KEY não configurada");

    // ========== INTERNAL ADMIN ALLOCATE (no user JWT needed) ==========
    const bodyText = await req.text();
    const bodyClone = JSON.parse(bodyText || "{}");

    if (bodyClone.action === "internal-allocate-proxy") {
      const supabaseInternal = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { target_user_id, quantity: iqty, product_id: iProdId, order_id: iOrderId, country_code: iCountry } = bodyClone;
      if (!target_user_id) throw new Error("target_user_id é obrigatório");
      const qty = iqty || 1;
      const targetCountry = iCountry?.toUpperCase() || "US";

      // Fetch all Webshare proxies
      const allProxies: any[] = [];
      let pg = 1;
      while (true) {
        const resp = await webFetch(`/proxy/list/?mode=direct&page=${pg}&page_size=250`, WEBSHARE_API_KEY);
        const data = await resp.json();
        if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]`);
        if (data.results?.length) allProxies.push(...data.results);
        if (!data.next) break;
        pg++;
      }

      // Get assigned proxy IDs
      const { data: existSubs } = await supabaseInternal
        .from("subscriptions").select("raw_data")
        .eq("type", "webshare").in("status", ["active", "expiring"]);
      const assignedIds = new Set<string>();
      for (const s of (existSubs || [])) {
        const raw = (s.raw_data || {}) as Record<string, any>;
        if (raw.webshare_proxy_id) assignedIds.add(raw.webshare_proxy_id);
      }

      let available = allProxies.filter(p => p.valid && !assignedIds.has(p.id));
      if (targetCountry) {
        available = available.filter(p => p.country_code?.toUpperCase() === targetCountry);
      }
      if (available.length < qty) throw new Error(`Apenas ${available.length} proxies ${targetCountry} disponíveis, precisa de ${qty}`);

      const allocated: any[] = [];
      for (let i = 0; i < qty; i++) {
        const proxy = available[i];
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30);
        const subName = `WS-${Date.now().toString(36).toUpperCase()}${i > 0 ? `-${i}` : ''}`;

        await supabaseInternal.from("subscriptions").insert({
          user_id: target_user_id,
          name: subName,
          type: "webshare",
          status: "active",
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          product_id: iProdId || null,
          auto_renew: false,
          raw_data: {
            webshare_proxy_id: proxy.id,
            proxy_address: proxy.proxy_address,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password,
            country_code: proxy.country_code,
            city_name: proxy.city_name,
            provider: "webshare",
            exchange_quota_free: 2,
            exchange_quota_pay: 0,
            admin_allocated: true,
          },
        });
        allocated.push({ name: subName, ip: proxy.proxy_address, port: proxy.port, country: proxy.country_code });
      }

      // Mark order items as fulfilled
      if (iOrderId) {
        const { data: ois } = await supabaseInternal.from("order_items").select("id").eq("order_id", iOrderId);
        if (ois) {
          for (const oi of ois) {
            await supabaseInternal.from("order_items").update({
              delivery_data: { type: "webshare_proxy", fulfilled: true, count: qty, admin_allocated: true },
            }).eq("id", oi.id);
          }
        }
      }

      console.log(`[internal-allocate] Allocated ${qty} ${targetCountry} proxies to ${target_user_id}`);
      return new Response(JSON.stringify({ success: true, allocated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== INTERNAL: UPDATE SUBSCRIPTION (no user JWT needed) ==========
    if (bodyClone.action === "internal-update-subscription") {
      const supabaseInternal = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { subscription_id: iSubId, raw_data: iRawData, status: iStatus } = bodyClone;
      if (!iSubId) throw new Error("subscription_id é obrigatório");

      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (iRawData) updatePayload.raw_data = iRawData;
      if (iStatus) {
        updatePayload.status = iStatus;
        if (iStatus === "cancelled") updatePayload.cancelled_at = new Date().toISOString();
      }

      const { error: iUpdErr } = await supabaseInternal
        .from("subscriptions")
        .update(updatePayload)
        .eq("id", iSubId);

      if (iUpdErr) throw new Error(`Erro ao atualizar: ${iUpdErr.message}`);

      console.log(`[internal-update] Updated subscription ${iSubId}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== INTERNAL: DELETE SUBSCRIPTION (permanent removal) ==========
    if (bodyClone.action === "internal-delete-subscription") {
      const supabaseInternal = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { subscription_id: dSubId } = bodyClone;
      if (!dSubId) throw new Error("subscription_id é obrigatório");

      const { error: delErr } = await supabaseInternal
        .from("subscriptions")
        .delete()
        .eq("id", dSubId);

      if (delErr) throw new Error(`Erro ao deletar: ${delErr.message}`);

      console.log(`[internal-delete] Deleted subscription ${dSubId}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = bodyClone;
    console.log(`[webshare-api] action=${action} user=${user.id}`);

    // ========== GET PROFILE ==========
    if (action === "get-profile") {
      const resp = await webFetch("/profile/", WEBSHARE_API_KEY);
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== GET SUBSCRIPTION ==========
    if (action === "get-subscription") {
      const resp = await webFetch("/subscription/", WEBSHARE_API_KEY);
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== GET PLAN ==========
    if (action === "get-plan") {
      const subResp = await webFetch("/subscription/", WEBSHARE_API_KEY);
      const subData = await subResp.json();
      if (!subResp.ok) throw new Error(`Webshare API error [${subResp.status}]`);
      const planId = subData.plan;
      if (!planId) throw new Error("Nenhum plano ativo encontrado");

      const planResp = await webFetch(`/subscription/plan/${planId}/`, WEBSHARE_API_KEY);
      const planData = await planResp.json();
      if (!planResp.ok) throw new Error(`Webshare API error [${planResp.status}]`);
      return new Response(JSON.stringify({ subscription: subData, plan: planData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== GET PROXY LIST ==========
    if (action === "get-proxy-list") {
      const mode = params.mode || "direct";
      const page = params.page || 1;
      const pageSize = params.page_size || 250;

      const resp = await webFetch(
        `/proxy/list/?mode=${mode}&page=${page}&page_size=${pageSize}`,
        WEBSHARE_API_KEY
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== GET ALL PROXIES (paginated fetch) ==========
    if (action === "get-all-proxies") {
      const mode = params.mode || "direct";
      const allProxies: any[] = [];
      let page = 1;
      const pageSize = 250;

      while (true) {
        const resp = await webFetch(
          `/proxy/list/?mode=${mode}&page=${page}&page_size=${pageSize}`,
          WEBSHARE_API_KEY
        );
        const data = await resp.json();
        if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]`);

        if (data.results?.length) {
          allProxies.push(...data.results);
        }
        if (!data.next) break;
        page++;
      }

      return new Response(JSON.stringify({ data: allProxies, total: allProxies.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== GET PROXY CONFIG ==========
    if (action === "get-proxy-config") {
      const resp = await webFetch("/proxy/config/", WEBSHARE_API_KEY);
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]`);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== GET BANDWIDTH STATS ==========
    if (action === "get-bandwidth-stats") {
      const subResp = await webFetch("/subscription/", WEBSHARE_API_KEY);
      const subData = await subResp.json();
      if (!subResp.ok) throw new Error(`Webshare API error [${subResp.status}]`);

      const startDate = subData.start_date;
      const endDate = subData.end_date;

      // Fetch aggregate stats for the current billing cycle
      const aggResp = await webFetch(
        `/stats/aggregate/?timestamp__gte=${startDate}&timestamp__lte=${endDate}`,
        WEBSHARE_API_KEY
      );
      const aggData = await aggResp.json();
      if (!aggResp.ok) throw new Error(`Webshare stats error [${aggResp.status}]`);

      // Fetch daily stats for chart
      const statsResp = await webFetch(
        `/stats/?timestamp__gte=${startDate}&timestamp__lte=${endDate}`,
        WEBSHARE_API_KEY
      );
      const statsData = await statsResp.json();
      if (!statsResp.ok) throw new Error(`Webshare stats error [${statsResp.status}]`);

      return new Response(JSON.stringify({
        aggregate: aggData,
        hourly: statsData,
        billing_start: startDate,
        billing_end: endDate,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== REPLACE PROXY ==========
    if (action === "replace-proxy") {
      const { proxy_id } = params as { proxy_id: string };
      if (!proxy_id) throw new Error("proxy_id é obrigatório");

      const resp = await webFetch(`/proxy/replace/`, WEBSHARE_API_KEY, "POST", JSON.stringify({
        proxy_ids: [proxy_id],
      }));
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== GET IP AUTHORIZATION ==========
    if (action === "get-ip-auth") {
      const resp = await webFetch("/proxy/ipauthorization/", WEBSHARE_API_KEY);
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]`);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== PURCHASE PROXY WITH BALANCE ==========
    // Assigns an unassigned Webshare proxy to the customer, debits balance, creates subscription
    if (action === "purchase-proxy-with-balance") {
      const { order_id, total, product_id, quantity: purchaseQty } = params as {
        order_id: string;
        total: number;
        product_id?: string;
        quantity?: number;
      };
      const qty = purchaseQty || 1;

      if (!order_id || total === undefined) {
        throw new Error("order_id e total são obrigatórios");
      }

      // 1. Get user's balance
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      if (profileErr || !profile) throw new Error("Perfil não encontrado");
      if (profile.balance < total) throw new Error("Saldo insuficiente");

      // 1.5. Determine target country from product tags or name
      let targetCountryCode: string | null = null;
      if (product_id) {
        const { data: productData } = await supabaseAdmin
          .from("products")
          .select("name, tags")
          .eq("id", product_id)
          .single();

        if (productData) {
          targetCountryCode = detectCountryFromProduct(productData);
        }
      }
      
      console.log(`[webshare-api] Target country for allocation: ${targetCountryCode || "any"}`);

      // 2. Fetch all Webshare proxies
      const allProxies: any[] = [];
      let page = 1;
      while (true) {
        const resp = await webFetch(
          `/proxy/list/?mode=direct&page=${page}&page_size=250`,
          WEBSHARE_API_KEY
        );
        const data = await resp.json();
        if (!resp.ok) throw new Error(`Erro ao buscar proxies Webshare`);
        if (data.results?.length) allProxies.push(...data.results);
        if (!data.next) break;
        page++;
      }

      if (allProxies.length === 0) throw new Error("Nenhum proxy disponível na Webshare");

      // 3. Get already-assigned proxy IDs from local subscriptions
      const { data: existingSubs } = await supabaseAdmin
        .from("subscriptions")
        .select("raw_data")
        .eq("type", "webshare")
        .in("status", ["active", "expiring"]);

      const assignedIds = new Set<string>();
      for (const sub of (existingSubs || [])) {
        const raw = (sub.raw_data || {}) as Record<string, any>;
        if (raw.webshare_proxy_id) assignedIds.add(raw.webshare_proxy_id);
      }

      // 4. Find unassigned proxies, filtering by country if specified
      let available = allProxies.filter(p => p.valid && !assignedIds.has(p.id));
      
      if (targetCountryCode) {
        const countryFiltered = available.filter(p => 
          p.country_code?.toUpperCase() === targetCountryCode
        );
        
        if (countryFiltered.length < qty) {
          throw new Error(`Apenas ${countryFiltered.length} proxy(s) ${targetCountryCode} disponível(is), mas ${qty} foram solicitados.`);
        }
        
        available = countryFiltered;
        console.log(`[webshare-api] Found ${available.length} ${targetCountryCode} proxies available, need ${qty}`);
      }
      
      if (available.length < qty) throw new Error(`Apenas ${available.length} proxy(s) disponível(is), mas ${qty} foram solicitados.`);

      // 5. Allocate qty proxies
      const allocatedProxies = available.slice(0, qty);
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);

      const subscriptionNames: string[] = [];

      for (const assignedProxy of allocatedProxies) {
        const subName = `WS-${Date.now().toString(36).toUpperCase()}${allocatedProxies.length > 1 ? '-' + (subscriptionNames.length + 1) : ''}`;
        subscriptionNames.push(subName);

        const { error: subErr } = await supabaseAdmin.from("subscriptions").insert({
          user_id: user.id,
          name: subName,
          type: "webshare",
          status: "active",
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          product_id: product_id || null,
          auto_renew: false,
          raw_data: {
            webshare_proxy_id: assignedProxy.id,
            proxy_address: assignedProxy.proxy_address,
            port: assignedProxy.port,
            username: assignedProxy.username,
            password: assignedProxy.password,
            country_code: assignedProxy.country_code,
            city_name: assignedProxy.city_name,
            provider: "webshare",
            exchange_quota_free: 2,
            exchange_quota_pay: 0,
          },
        });

        if (subErr) throw new Error(`Erro ao criar assinatura: ${subErr.message}`);
        console.log(`[webshare-api] Proxy ${assignedProxy.id} assigned to user ${user.id}`);
      }

      // 6. Debit balance (full total for all proxies)
      const newBalance = profile.balance - total;
      await supabaseAdmin
        .from("profiles")
        .update({ balance: newBalance })
        .eq("user_id", user.id);

      // 7. Record wallet transaction
      const { data: orderData } = await supabaseAdmin
        .from("orders")
        .select("code")
        .eq("id", order_id)
        .single();

      await supabaseAdmin.from("wallet_transactions").insert({
        user_id: user.id,
        type: "purchase",
        title: `Compra #${orderData?.code || order_id}`,
        amount: -total,
        balance_after: newBalance,
        reference_id: order_id,
      });

      // 8. Update order status
      await supabaseAdmin
        .from("orders")
        .update({
          status: "completed",
          payment_method: "saldo",
          total,
        })
        .eq("id", order_id);

      // 9. Notify admin
      const productLabel = product_id
        ? (await supabaseAdmin.from("products").select("name").eq("id", product_id).single())?.data?.name || "Proxy"
        : "Proxy Webshare";
      const clientName = (await supabaseAdmin.from("profiles").select("full_name").eq("user_id", user.id).single())?.data?.full_name || "Cliente";

      const proxyList = allocatedProxies.map(p => `${p.proxy_address}:${p.port}`).join(", ");
      await supabaseAdmin.from("notifications").insert({
        title: `${productLabel} Vendido (x${qty})`,
        message: `${clientName} • R$ ${Number(total).toFixed(2)} • ${proxyList} • Pedido #${orderData?.code || ""}`,
        type: "order",
        global: true,
      });

      return new Response(JSON.stringify({
        success: true,
        quantity: qty,
        subscriptions: subscriptionNames,
        proxies: allocatedProxies.map(p => ({
          ip: p.proxy_address,
          port: p.port,
          username: p.username,
          password: p.password,
        })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== ADMIN ALLOCATE PROXY ==========
    if (action === "admin-allocate-proxy") {
      const { target_user_id, quantity: allocQty, product_id: allocProductId, order_id: allocOrderId, country_code: adminCountryCode } = params as {
        target_user_id: string;
        quantity?: number;
        product_id?: string;
        order_id?: string;
        country_code?: string;
      };

      if (!target_user_id) throw new Error("target_user_id é obrigatório");

      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) throw new Error("Acesso negado: apenas administradores");

      const qty = allocQty || 1;
      
      // Determine target country from product or explicit param
      let targetCountry = adminCountryCode?.toUpperCase() || null;
      if (!targetCountry && allocProductId) {
        const { data: productData } = await supabaseAdmin
          .from("products")
          .select("name, tags")
          .eq("id", allocProductId)
          .single();

        if (productData) {
          targetCountry = detectCountryFromProduct(productData);
        }
      }
      
      console.log(`[webshare-api] Admin allocation - target country: ${targetCountry || "any"}`);

      const allProxies: any[] = [];
      let aPage = 1;
      while (true) {
        const resp = await webFetch(`/proxy/list/?mode=direct&page=${aPage}&page_size=250`, WEBSHARE_API_KEY);
        const data = await resp.json();
        if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]`);
        if (data.results?.length) allProxies.push(...data.results);
        if (!data.next) break;
        aPage++;
      }

      const { data: existingAdminSubs } = await supabaseAdmin
        .from("subscriptions")
        .select("raw_data")
        .eq("type", "webshare")
        .in("status", ["active", "expiring"]);

      const aAssignedIds = new Set<string>();
      for (const sub of (existingAdminSubs || [])) {
        const raw = (sub.raw_data || {}) as Record<string, any>;
        if (raw.webshare_proxy_id) aAssignedIds.add(raw.webshare_proxy_id);
      }

      let aAvailable = allProxies.filter((p: any) => p.valid && !aAssignedIds.has(p.id));
      
      if (targetCountry) {
        const countryFiltered = aAvailable.filter(p => p.country_code?.toUpperCase() === targetCountry);
        if (countryFiltered.length < qty) {
          throw new Error(`Apenas ${countryFiltered.length} proxies ${targetCountry} disponíveis, precisa de ${qty}`);
        }
        aAvailable = countryFiltered;
      }
      
      if (aAvailable.length < qty) throw new Error(`Apenas ${aAvailable.length} proxies disponíveis, precisa de ${qty}`);

      const allocated: any[] = [];
      for (let i = 0; i < qty; i++) {
        const proxy = aAvailable[i];
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30);
        const subName = `WS-${Date.now().toString(36).toUpperCase()}${i > 0 ? `-${i}` : ''}`;

        await supabaseAdmin.from("subscriptions").insert({
          user_id: target_user_id,
          name: subName,
          type: "webshare",
          status: "active",
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          product_id: allocProductId || null,
          auto_renew: false,
          raw_data: {
            webshare_proxy_id: proxy.id,
            proxy_address: proxy.proxy_address,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password,
            country_code: proxy.country_code,
            city_name: proxy.city_name,
            provider: "webshare",
            exchange_quota_free: 2,
            exchange_quota_pay: 0,
          },
        });
        allocated.push({ name: subName, ip: proxy.proxy_address, port: proxy.port });
      }

      if (allocOrderId) {
        const { data: ois } = await supabaseAdmin.from("order_items").select("id").eq("order_id", allocOrderId);
        if (ois) {
          for (const oi of ois) {
            await supabaseAdmin.from("order_items").update({
              delivery_data: { type: "webshare_proxy", fulfilled: true, count: qty, admin_allocated: true },
            }).eq("id", oi.id);
          }
        }
      }

      console.log(`[webshare-api] Admin ${user.id} allocated ${qty} proxies to ${target_user_id}`);
      return new Response(JSON.stringify({ success: true, allocated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== GET AVAILABLE COUNT ==========
    // Returns how many unassigned proxies are available for sale
    if (action === "get-available-count") {
      // Fetch all proxies
      const allProxies: any[] = [];
      let page = 1;
      while (true) {
        const resp = await webFetch(
          `/proxy/list/?mode=direct&page=${page}&page_size=250`,
          WEBSHARE_API_KEY
        );
        const data = await resp.json();
        if (!resp.ok) throw new Error(`Webshare API error`);
        if (data.results?.length) allProxies.push(...data.results);
        if (!data.next) break;
        page++;
      }

      // Get assigned IDs
      const { data: existingSubs } = await supabaseAdmin
        .from("subscriptions")
        .select("raw_data")
        .eq("type", "webshare")
        .in("status", ["active", "expiring"]);

      const assignedIds = new Set<string>();
      for (const sub of (existingSubs || [])) {
        const raw = (sub.raw_data || {}) as Record<string, any>;
        if (raw.webshare_proxy_id) assignedIds.add(raw.webshare_proxy_id);
      }

      const available = allProxies.filter(p => p.valid && !assignedIds.has(p.id));

      return new Response(JSON.stringify({
        total: allProxies.length,
        assigned: assignedIds.size,
        available: available.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== EXCHANGE WEBSHARE PROXY ==========
    if (action === "exchange-webshare-proxy") {
      const { subscription_id } = params as { subscription_id: string };
      if (!subscription_id) throw new Error("subscription_id é obrigatório");

      // 1. Get subscription
      const { data: subRow, error: subErr } = await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("id", subscription_id)
        .eq("type", "webshare")
        .single();

      if (subErr || !subRow) throw new Error("Assinatura não encontrada");
      if (subRow.user_id !== user.id) {
        // Check if staff
        const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _user_id: user.id });
        if (!isStaff) throw new Error("Sem permissão");
      }

      const raw = (subRow.raw_data || {}) as Record<string, any>;
      const freeLeft = raw.exchange_quota_free ?? 0;
      if (freeLeft <= 0) throw new Error("Sem cotas de troca disponíveis");

      // Determine country: from raw_data first, then from product tags/name
      let targetCountry = raw.country_code ? String(raw.country_code).toUpperCase() : null;
      if (!targetCountry && subRow.product_id) {
        const { data: prodData } = await supabaseAdmin
          .from("products")
          .select("name, tags")
          .eq("id", subRow.product_id)
          .maybeSingle();
        if (prodData) {
          targetCountry = detectCountryFromProduct(prodData);
        }
      }
      console.log(`[webshare-exchange] Target country for exchange: ${targetCountry || 'ANY'}`);

      const currentProxyId = raw.webshare_proxy_id;
      const oldProxyStr = `${raw.proxy_address || ""}:${raw.port || ""}`;
      let newProxyData: Record<string, any> | null = null;
      let method = "api"; // track which method succeeded

      // Try 1: Webshare API replace (v3 replacement flow)
      if (currentProxyId && raw.proxy_address) {
        try {
          console.log(`[webshare-exchange] Trying API replace for proxy ${currentProxyId}`);

          const replacePayload = {
            to_replace: {
              type: "ip_address",
              ip_addresses: [raw.proxy_address],
              count: 1,
            },
            replace_with: [
              targetCountry
                ? { type: "country", country_code: targetCountry, count: 1 }
                : { type: "any", count: 1 },
            ],
            dry_run: false,
          };

          const replaceResp = await webFetch(
            "https://proxy.webshare.io/api/v3/proxy/replace/",
            WEBSHARE_API_KEY,
            "POST",
            JSON.stringify(replacePayload),
          );
          const replaceData = await replaceResp.json().catch(() => ({}));

          if (!replaceResp.ok) {
            console.warn(`[webshare-exchange] API replace failed [${replaceResp.status}]: ${JSON.stringify(replaceData)}`);
          } else {
            const replacementId = replaceData?.id;
            let replacementState = replaceData?.state;

            if (replacementId) {
              for (let attempt = 0; attempt < 10; attempt++) {
                if (replacementState === "completed" || replacementState === "failed") break;
                await new Promise((r) => setTimeout(r, 1200));

                const statusResp = await webFetch(
                  `https://proxy.webshare.io/api/v3/proxy/replace/${replacementId}/`,
                  WEBSHARE_API_KEY,
                );
                const statusData = await statusResp.json().catch(() => ({}));
                if (!statusResp.ok) {
                  console.warn(`[webshare-exchange] Replace status failed [${statusResp.status}]: ${JSON.stringify(statusData)}`);
                  break;
                }

                replacementState = statusData?.state;
                if (replacementState === "failed") {
                  console.warn(`[webshare-exchange] Replace request failed: ${statusData?.error || "unknown error"}`);
                }
              }
            }

            if (replacementState === "completed") {
              const allCurrentProxies: any[] = [];
              let page = 1;

              while (true) {
                const listResp = await webFetch(`/proxy/list/?mode=direct&page=${page}&page_size=250`, WEBSHARE_API_KEY);
                const listData = await listResp.json().catch(() => ({}));
                if (!listResp.ok) break;

                if (listData.results?.length) allCurrentProxies.push(...listData.results);
                if (!listData.next) break;
                page++;
              }

              // Find proxy that wasn't the old one by checking all proxies assigned to active subs
              const { data: allActiveSubs } = await supabaseAdmin
                .from("subscriptions")
                .select("raw_data")
                .eq("type", "webshare")
                .in("status", ["active", "expiring"])
                .neq("id", subscription_id);

              const otherAssignedIds = new Set<string>();
              for (const s of (allActiveSubs || [])) {
                const r = (s.raw_data || {}) as Record<string, any>;
                if (r.webshare_proxy_id) otherAssignedIds.add(r.webshare_proxy_id);
              }

              // Find a valid proxy not assigned to others, matching the same country
              const candidates = allCurrentProxies.filter(
                (p: any) => p.valid && !otherAssignedIds.has(p.id) && p.id !== currentProxyId && p.proxy_address !== raw.proxy_address
                  && (!targetCountry || String(p.country_code).toUpperCase() === targetCountry),
              );

              if (candidates.length > 0) {
                const np = candidates[0];
                newProxyData = {
                  webshare_proxy_id: np.id,
                  proxy_address: np.proxy_address,
                  port: np.port,
                  username: np.username,
                  password: np.password,
                  country_code: np.country_code,
                  city_name: np.city_name,
                };
                console.log(`[webshare-exchange] API replace succeeded: ${np.proxy_address}:${np.port}`);
              } else {
                console.warn("[webshare-exchange] API completed but no replacement candidate was found");
              }
            } else {
              console.warn(`[webshare-exchange] API replacement did not complete (state=${replacementState || "unknown"})`);
            }
          }
        } catch (e: any) {
          console.warn(`[webshare-exchange] API replace error: ${e.message}`);
        }
      }

      // Try 2: Stock fallback - find available stock_item with same product_id
      if (!newProxyData && subRow.product_id) {
        console.log(`[webshare-exchange] Trying stock fallback for product ${subRow.product_id}`);
        const { data: stockItem } = await supabaseAdmin
          .from("stock_items")
          .select("*")
          .eq("product_id", subRow.product_id)
          .eq("status", "revisado")
          .is("order_item_id", null)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (stockItem) {
          const itemData = (stockItem.data || {}) as Record<string, any>;
          // Mark stock item as consumed
          await supabaseAdmin
            .from("stock_items")
            .update({ status: "vendido", updated_at: new Date().toISOString() })
            .eq("id", stockItem.id);

          newProxyData = {
            webshare_proxy_id: raw.webshare_proxy_id, // keep same webshare ID
            proxy_address: itemData.proxy_address || itemData.ip || raw.proxy_address,
            port: itemData.port || raw.port,
            username: itemData.username || raw.username,
            password: itemData.password || raw.password,
            country_code: itemData.country_code || raw.country_code,
            city_name: itemData.city_name || raw.city_name,
            stock_item_id: stockItem.id,
          };
          method = "stock";
          console.log(`[webshare-exchange] Stock fallback succeeded: item ${stockItem.id}`);
        }
      }

      if (!newProxyData) {
        throw new Error("Não foi possível trocar o proxy. Sem disponibilidade via API ou estoque.");
      }

      // 3. Update subscription raw_data
      const prevExchangeCount = raw.exchange_count ? Number(raw.exchange_count) : 0;
      const updatedRaw = {
        ...raw,
        ...newProxyData,
        provider: "webshare",
        exchange_quota_free: freeLeft - 1,
        exchange_count: prevExchangeCount + 1,
        initial_exchange_quota_free: raw.initial_exchange_quota_free ?? (freeLeft),
        last_exchange: new Date().toISOString(),
        last_exchange_method: method,
      };

      const { error: updateErr } = await supabaseAdmin
        .from("subscriptions")
        .update({ raw_data: updatedRaw, updated_at: new Date().toISOString() })
        .eq("id", subscription_id);

      if (updateErr) throw new Error(`Erro ao atualizar assinatura: ${updateErr.message}`);

      console.log(`[webshare-exchange] Exchange complete. Method=${method}, quota=${freeLeft - 1}`);

      return new Response(JSON.stringify({
        success: true,
        method,
        old_proxy: oldProxyStr,
        new_proxy: `${newProxyData.proxy_address}:${newProxyData.port}`,
        exchange_quota_free: freeLeft - 1,
        proxy: {
          ip: newProxyData.proxy_address,
          port: newProxyData.port,
          username: newProxyData.username,
          password: newProxyData.password,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== ADMIN: UPDATE SUBSCRIPTION RAW_DATA ==========
    if (action === "admin-update-subscription") {
      const { subscription_id: updSubId, raw_data: newRawData, status: newStatus } = params as {
        subscription_id: string;
        raw_data?: Record<string, any>;
        status?: string;
      };
      if (!updSubId) throw new Error("subscription_id é obrigatório");

      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) throw new Error("Acesso negado: apenas administradores");

      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (newRawData) updatePayload.raw_data = newRawData;
      if (newStatus) updatePayload.status = newStatus;
      if (newStatus === "cancelled") updatePayload.cancelled_at = new Date().toISOString();

      const { error: updErr } = await supabaseAdmin
        .from("subscriptions")
        .update(updatePayload)
        .eq("id", updSubId);

      if (updErr) throw new Error(`Erro ao atualizar: ${updErr.message}`);

      console.log(`[webshare-api] Admin ${user.id} updated subscription ${updSubId}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== GET ROTATING PROXY CREDENTIALS ==========
    if (action === "get-rotating-credentials") {
      // Fetch one backbone proxy to get the correct base username
      // The /proxy/config/ returns a short username (e.g. "fhvaccdh") but backbone
      // proxies use a different base (e.g. "fhvaccdhresidential-1").
      // For rotating, we need the backbone base WITHOUT the number suffix.
      const backboneResp = await webFetch("/proxy/list/?mode=backbone&page=1&page_size=1", WEBSHARE_API_KEY);
      const backboneData = await backboneResp.json();
      
      let rotatingUsername = "";
      let rotatingPassword = "";
      
      if (backboneResp.ok && backboneData.results?.length > 0) {
        const bbProxy = backboneData.results[0];
        // Username is like "fhvaccdhresidential-1", strip the trailing "-N"
        const bbUsername = bbProxy.username || "";
        rotatingUsername = bbUsername.replace(/-\d+$/, "");
        rotatingPassword = bbProxy.password || "";
        console.log(`[get-rotating-credentials] Backbone base username: ${rotatingUsername}`);
      } else {
        // Fallback to /proxy/config/ if no backbone proxies
        const configResp = await webFetch("/proxy/config/", WEBSHARE_API_KEY);
        const configData = await configResp.json();
        if (!configResp.ok) throw new Error(`Webshare config error [${configResp.status}]`);
        rotatingUsername = configData.username || configData.proxy_username || "";
        rotatingPassword = configData.password || configData.proxy_password || "";
        console.log(`[get-rotating-credentials] Fallback config username: ${rotatingUsername}`);
      }

      // Get subscription info for bandwidth
      const subResp = await webFetch("/subscription/", WEBSHARE_API_KEY);
      const subData = await subResp.json();

      return new Response(JSON.stringify({
        proxy_host: "p.webshare.io",
        http_port: 80,
        socks5_port: 1080,
        username: rotatingUsername,
        password: rotatingPassword,
        country_suffix: "-country-BR-rotate",
        bandwidth_limit_gb: subData.bandwidth_limit ? subData.bandwidth_limit / (1024 * 1024 * 1024) : null,
        bandwidth_used_bytes: subData.bandwidth_used || 0,
        bandwidth_limit_bytes: subData.bandwidth_limit || 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== PURCHASE ROTATING PROXY (balance) ==========
    if (action === "purchase-rotating-proxy") {
      const { order_id, total, product_id, quantity: gbQty } = params as {
        order_id: string; total: number; product_id?: string; quantity?: number;
      };
      const gb = gbQty || 1;
      if (!order_id || total === undefined) throw new Error("order_id e total são obrigatórios");

      // 1. Check balance
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from("profiles").select("balance").eq("user_id", user.id).single();
      if (profileErr || !profile) throw new Error("Perfil não encontrado");
      if (profile.balance < total) throw new Error("Saldo insuficiente");

      // 2. Fetch rotating proxy credentials from backbone proxy list
      const bbResp = await webFetch("/proxy/list/?mode=backbone&page=1&page_size=1", WEBSHARE_API_KEY);
      const bbData = await bbResp.json();
      
      let rotatingUsername = "";
      let rotatingPassword = "";
      
      if (bbResp.ok && bbData.results?.length > 0) {
        const bbProxy = bbData.results[0];
        rotatingUsername = (bbProxy.username || "").replace(/-\d+$/, "") + "-country-BR-rotate";
        rotatingPassword = bbProxy.password || "";
      } else {
        const configResp = await webFetch("/proxy/config/", WEBSHARE_API_KEY);
        const configData = await configResp.json();
        if (!configResp.ok) throw new Error(`Webshare config error [${configResp.status}]`);
        rotatingUsername = (configData.username || configData.proxy_username || "") + "-country-BR-rotate";
        rotatingPassword = configData.password || configData.proxy_password || "";
      }

      // 3. Create subscription
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);
      const subName = `WSR-${Date.now().toString(36).toUpperCase()}`;

      const { error: subErr } = await supabaseAdmin.from("subscriptions").insert({
        user_id: user.id,
        name: subName,
        type: "webshare_rotating",
        status: "active",
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        product_id: product_id || null,
        auto_renew: false,
        raw_data: {
          provider: "webshare",
          proxy_type: "rotating_residential",
          proxy_host: "p.webshare.io",
          http_port: 80,
          socks5_port: 1080,
          username: rotatingUsername,
          password: rotatingPassword,
          country_code: "BR",
          gb_purchased: gb,
          gb_used: 0,
        },
      });
      if (subErr) throw new Error(`Erro ao criar assinatura: ${subErr.message}`);

      // 4. Debit balance
      const newBalance = profile.balance - total;
      await supabaseAdmin.from("profiles").update({ balance: newBalance }).eq("user_id", user.id);

      // 5. Wallet transaction
      const { data: orderData } = await supabaseAdmin.from("orders").select("code").eq("id", order_id).single();
      await supabaseAdmin.from("wallet_transactions").insert({
        user_id: user.id, type: "purchase",
        title: `Compra #${orderData?.code || order_id}`,
        amount: -total, balance_after: newBalance, reference_id: order_id,
      });

      // 6. Update order
      await supabaseAdmin.from("orders").update({
        status: "completed", payment_method: "saldo", total,
      }).eq("id", order_id);

      // 7. Update order items delivery_data
      const { data: ois } = await supabaseAdmin.from("order_items").select("id").eq("order_id", order_id);
      if (ois) {
        for (const oi of ois) {
          await supabaseAdmin.from("order_items").update({
            delivery_data: { type: "webshare_rotating", fulfilled: true, gb_purchased: gb, subscription_code: subName },
          }).eq("id", oi.id);
        }
      }

      // 8. Notify admin
      const clientName = (await supabaseAdmin.from("profiles").select("full_name").eq("user_id", user.id).single())?.data?.full_name || "Cliente";
      await supabaseAdmin.from("notifications").insert({
        title: `Proxy Rotativo BR (${gb}GB)`,
        message: `${clientName} • R$ ${Number(total).toFixed(2)} • ${gb}GB • Pedido #${orderData?.code || ""}`,
        type: "order", global: true,
      });

      console.log(`[webshare-api] Rotating proxy ${gb}GB provisioned for ${user.id}`);
      return new Response(JSON.stringify({ success: true, subscription: subName, gb_purchased: gb }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (err: any) {
    console.error("[webshare-api] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
