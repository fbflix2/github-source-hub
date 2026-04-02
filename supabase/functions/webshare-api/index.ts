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
  const allText = tags.map(t => t.toLowerCase().trim()).join(" ") + " " + name;

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
    if (lt === "americano" || lt === "americana") return "US";
  }

  // Brazilian region indicators in tags or name
  const brIndicators = ["brasil", "brazil", "sudeste", "central/sudeste", "centra/sudeste", "nordeste", "sul", "centro-oeste"];
  for (const indicator of brIndicators) {
    if (allText.includes(indicator)) return "BR";
  }

  // US indicators
  const usIndicators = ["usa", "estados unidos", "americano", "americana", "us premium"];
  for (const indicator of usIndicators) {
    if (allText.includes(indicator)) return "US";
  }

  // Fallback: check product name for country codes
  if (name.includes(" br") || name.endsWith(" br")) return "BR";
  if (name.includes(" us") || name.endsWith(" us")) return "US";

  // DEFAULT: If no country detected, default to BR (most products are Brazilian)
  console.log(`[detectCountry] No country detected for "${product.name}", defaulting to BR`);
  return "BR";
}

function normalizeRotatingBaseUsername(rawUsername: string): string {
  const cleaned = (rawUsername || "").trim();
  if (!cleaned) return "";

  const normalized = cleaned
    .replace(/-country-[a-z]{2}-rotate$/i, "")
    .replace(/-[a-z]{2}-rotate$/i, "")
    .replace(/-[a-z]{2}$/i, "")
    .replace(/-\d+$/i, "");

  return normalized.trim();
}

function buildRotatingCountrySuffix(countryCode = "BR"): string {
  return `-${countryCode.toUpperCase()}-rotate`;
}

function buildRotatingUsername(rawUsername: string, countryCode = "BR"): string {
  const baseUsername = normalizeRotatingBaseUsername(rawUsername);
  return baseUsername ? `${baseUsername}${buildRotatingCountrySuffix(countryCode)}` : "";
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

    const token = authHeader.replace("Bearer ", "").trim();
    const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
    const isServiceRole = serviceRoleKey.length > 0 && token === serviceRoleKey;
    let user: any = null;
    if (!isServiceRole) {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      user = authUser;
    }

    const { action, ...params } = bodyClone;
    console.log(`[webshare-api] action=${action} user=${user?.id || 'service-role'}`);

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
          await supabaseAdmin
            .from("stock_items")
            .update({ status: "vendido", updated_at: new Date().toISOString() })
            .eq("id", stockItem.id);

          newProxyData = {
            webshare_proxy_id: raw.webshare_proxy_id,
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

      // Try 3: Pool fallback - find an unassigned proxy directly from the Webshare pool
      if (!newProxyData) {
        console.log(`[webshare-exchange] Trying pool fallback - scanning Webshare proxy list`);
        try {
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

          // Get all assigned proxy IDs from active subscriptions
          const { data: allActiveSubs } = await supabaseAdmin
            .from("subscriptions")
            .select("raw_data")
            .eq("type", "webshare")
            .in("status", ["active", "expiring"])
            .neq("id", subscription_id);

          const assignedIds = new Set<string>();
          for (const s of (allActiveSubs || [])) {
            const r = (s.raw_data || {}) as Record<string, any>;
            if (r.webshare_proxy_id) assignedIds.add(r.webshare_proxy_id);
          }

          // Find an unassigned proxy matching the country
          const poolCandidates = allCurrentProxies.filter(
            (p: any) => p.valid && !assignedIds.has(p.id) && p.id !== currentProxyId
              && (!targetCountry || String(p.country_code).toUpperCase() === targetCountry),
          );

          if (poolCandidates.length > 0) {
            const np = poolCandidates[0];
            newProxyData = {
              webshare_proxy_id: np.id,
              proxy_address: np.proxy_address,
              port: np.port,
              username: np.username,
              password: np.password,
              country_code: np.country_code,
              city_name: np.city_name,
            };
            method = "pool";
            console.log(`[webshare-exchange] Pool fallback succeeded: ${np.proxy_address}:${np.port} (${np.id})`);
          } else {
            console.warn(`[webshare-exchange] Pool fallback: no unassigned ${targetCountry || 'ANY'} proxies found`);
          }
        } catch (e: any) {
          console.warn(`[webshare-exchange] Pool fallback error: ${e.message}`);
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

    // ========== ADMIN: MAINTENANCE EXCHANGE (no quota deduction) ==========
    if (action === "admin-maintenance-exchange") {
      const { subscription_id: maintSubId } = params as { subscription_id: string };
      if (!maintSubId) throw new Error("subscription_id é obrigatório");

      // Only admins can do maintenance exchanges
      const { data: isAdminMaint } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdminMaint) throw new Error("Acesso negado: apenas administradores");

      const { data: maintSub, error: maintSubErr } = await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("id", maintSubId)
        .in("type", ["webshare", "webshare_rotating", "proxybr"])
        .single();

      if (maintSubErr || !maintSub) throw new Error("Assinatura não encontrada");

      const maintRaw = (maintSub.raw_data || {}) as Record<string, any>;

      // Determine country — prioritize product-based detection over raw_data.country_code
      // because raw_data.country_code may be stale/incorrect from legacy ProxyBR data
      let maintCountry: string | null = null;
      if (maintSub.product_id) {
        const { data: prodData } = await supabaseAdmin
          .from("products")
          .select("name, tags")
          .eq("id", maintSub.product_id)
          .maybeSingle();
        if (prodData) maintCountry = detectCountryFromProduct(prodData);
      }
      // Also check product name stored in raw_data if no product_id
      if (!maintCountry && maintRaw.product?.name) {
        maintCountry = detectCountryFromProduct({ name: maintRaw.product.name, tags: null });
      }
      // Last resort: use raw_data.country_code
      if (!maintCountry) {
        maintCountry = maintRaw.country_code ? String(maintRaw.country_code).toUpperCase() : "BR";
      }
      console.log(`[admin-maint-exchange] Detected country: ${maintCountry} for sub ${maintSubId}`);

      const maintCurrentProxyId = maintRaw.webshare_proxy_id;
      const maintOldProxy = `${maintRaw.proxy_address || ""}:${maintRaw.port || ""}`;
      let maintNewProxy: Record<string, any> | null = null;
      let maintMethod = "api";

      // Try API replace first
      if (maintCurrentProxyId && maintRaw.proxy_address) {
        try {
          const replacePayload = {
            to_replace: { type: "ip_address", ip_addresses: [maintRaw.proxy_address], count: 1 },
            replace_with: [maintCountry ? { type: "country", country_code: maintCountry, count: 1 } : { type: "any", count: 1 }],
            dry_run: false,
          };

          const replaceResp = await webFetch("https://proxy.webshare.io/api/v3/proxy/replace/", WEBSHARE_API_KEY, "POST", JSON.stringify(replacePayload));
          const replaceData = await replaceResp.json().catch(() => ({}));

          if (replaceResp.ok) {
            const replacementId = replaceData?.id;
            let replacementState = replaceData?.state;

            if (replacementId) {
              for (let attempt = 0; attempt < 10; attempt++) {
                if (replacementState === "completed" || replacementState === "failed") break;
                await new Promise((r) => setTimeout(r, 1200));
                const statusResp = await webFetch(`https://proxy.webshare.io/api/v3/proxy/replace/${replacementId}/`, WEBSHARE_API_KEY);
                const statusData = await statusResp.json().catch(() => ({}));
                if (!statusResp.ok) break;
                replacementState = statusData?.state;
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

              const { data: allActiveSubs } = await supabaseAdmin
                .from("subscriptions")
                .select("raw_data")
                .eq("type", "webshare")
                .in("status", ["active", "expiring"])
                .neq("id", maintSubId);

              const otherIds = new Set<string>();
              for (const s of (allActiveSubs || [])) {
                const r = (s.raw_data || {}) as Record<string, any>;
                if (r.webshare_proxy_id) otherIds.add(r.webshare_proxy_id);
              }

              const candidates = allCurrentProxies.filter(
                (p: any) => p.valid && !otherIds.has(p.id) && p.id !== maintCurrentProxyId && p.proxy_address !== maintRaw.proxy_address
                  && (!maintCountry || String(p.country_code).toUpperCase() === maintCountry),
              );

              if (candidates.length > 0) {
                const np = candidates[0];
                maintNewProxy = {
                  webshare_proxy_id: np.id, proxy_address: np.proxy_address,
                  port: np.port, username: np.username, password: np.password,
                  country_code: np.country_code, city_name: np.city_name,
                };
              }
            }
          }
        } catch (e: any) {
          console.warn(`[admin-maint-exchange] API replace error: ${e.message}`);
        }
      }

      // Pool fallback
      if (!maintNewProxy) {
        try {
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

          const { data: allActiveSubs } = await supabaseAdmin
            .from("subscriptions")
            .select("raw_data")
            .eq("type", "webshare")
            .in("status", ["active", "expiring"])
            .neq("id", maintSubId);

          const assignedIds = new Set<string>();
          for (const s of (allActiveSubs || [])) {
            const r = (s.raw_data || {}) as Record<string, any>;
            if (r.webshare_proxy_id) assignedIds.add(r.webshare_proxy_id);
          }

          const poolCandidates = allCurrentProxies.filter(
            (p: any) => p.valid && !assignedIds.has(p.id) && p.id !== maintCurrentProxyId
              && (!maintCountry || String(p.country_code).toUpperCase() === maintCountry),
          );

          if (poolCandidates.length > 0) {
            const np = poolCandidates[0];
            maintNewProxy = {
              webshare_proxy_id: np.id, proxy_address: np.proxy_address,
              port: np.port, username: np.username, password: np.password,
              country_code: np.country_code, city_name: np.city_name,
            };
            maintMethod = "pool";
          }
        } catch (e: any) {
          console.warn(`[admin-maint-exchange] Pool fallback error: ${e.message}`);
        }
      }

      if (!maintNewProxy) throw new Error("Não foi possível trocar o proxy. Sem disponibilidade.");

      // Update subscription WITHOUT deducting quota
      // Also update the proxies.data array (used by ProxyBR-type subscriptions on client side)
      const newProxyCode = `${maintNewProxy.proxy_address}:${maintNewProxy.port}:${maintNewProxy.username}:${maintNewProxy.password}`;
      const newProxyParsed = {
        ip: maintNewProxy.proxy_address,
        port: String(maintNewProxy.port),
        username: maintNewProxy.username,
        password: maintNewProxy.password,
      };

      const existingProxies = maintRaw.proxies?.data || [];
      const updatedProxiesData = existingProxies.length > 0
        ? existingProxies.map((p: any, i: number) => {
            if (i === 0 || String(p.id) === String(maintRaw.webshare_proxy_id)) {
              return { ...p, code: newProxyCode, parsed: newProxyParsed, status: "USED" };
            }
            return p;
          })
        : [{ id: maintNewProxy.webshare_proxy_id, code: newProxyCode, parsed: newProxyParsed, status: "USED", notes: null }];

      const updatedMaintRaw = {
        ...maintRaw,
        ...maintNewProxy,
        provider: "webshare",
        proxies: { ...maintRaw.proxies, data: updatedProxiesData, total: updatedProxiesData.length },
        last_maintenance_exchange: new Date().toISOString(),
        last_maintenance_method: maintMethod,
        maintenance_exchange_count: (maintRaw.maintenance_exchange_count || 0) + 1,
      };

      const { error: maintUpdateErr } = await supabaseAdmin
        .from("subscriptions")
        .update({ raw_data: updatedMaintRaw, updated_at: new Date().toISOString() })
        .eq("id", maintSubId);

      if (maintUpdateErr) throw new Error(`Erro ao atualizar: ${maintUpdateErr.message}`);

      console.log(`[admin-maint-exchange] Admin ${user.id} maintenance-exchanged sub ${maintSubId}. Method=${maintMethod}`);
      return new Response(JSON.stringify({
        success: true, method: maintMethod,
        old_proxy: maintOldProxy,
        new_proxy: `${maintNewProxy.proxy_address}:${maintNewProxy.port}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      const countryCode = "BR";
      const backboneResp = await webFetch("/proxy/list/?mode=backbone&page=1&page_size=1", WEBSHARE_API_KEY);
      const backboneData = await backboneResp.json();

      let rotatingUsernameBase = "";
      let rotatingPassword = "";

      if (backboneResp.ok && backboneData.results?.length > 0) {
        const bbProxy = backboneData.results[0];
        rotatingUsernameBase = normalizeRotatingBaseUsername(bbProxy.username || bbProxy.proxy_username || "");
        rotatingPassword = bbProxy.password || "";
      }

      if (!rotatingUsernameBase) {
        const configResp = await webFetch("/proxy/config/", WEBSHARE_API_KEY);
        const configData = await configResp.json();
        if (!configResp.ok) throw new Error(`Webshare config error [${configResp.status}]`);
        rotatingUsernameBase = normalizeRotatingBaseUsername(configData.username || configData.proxy_username || "");
        rotatingPassword = rotatingPassword || configData.password || configData.proxy_password || "";
      }

      if (!rotatingUsernameBase) {
        throw new Error("Não foi possível determinar o usuário rotativo do Webshare");
      }

      console.log(`[get-rotating-credentials] Rotating username resolved for country ${countryCode}`);

      // Get subscription info for bandwidth limits
      const subResp = await webFetch("/subscription/", WEBSHARE_API_KEY);
      const subData = await subResp.json();

      // Use backbone-specific bandwidth fields (rotating proxy only)
      const bandwidthLimit = subData.bandwidth_limit_backbone > 0
        ? subData.bandwidth_limit_backbone
        : (subData.bandwidth_limit || 0);
      const bandwidthUsed = subData.bandwidth_used_backbone ?? subData.bandwidth_used ?? 0;

      // Also fetch stats/aggregate with mode=backbone for accurate usage in current cycle
      let aggregateUsed = bandwidthUsed;
      try {
        const startDate = subData.start_date || "";
        const endDate = subData.end_date || "";
        if (startDate && endDate) {
          const aggResp = await webFetch(
            `/stats/aggregate/?mode=backbone&timestamp__gte=${startDate}&timestamp__lte=${endDate}`,
            WEBSHARE_API_KEY
          );
          if (aggResp.ok) {
            const aggData = await aggResp.json();
            const totalBw = (aggData.download_bytes || 0) + (aggData.upload_bytes || 0);
            if (totalBw > 0) aggregateUsed = totalBw;
            console.log(`[get-rotating-credentials] Backbone aggregate bandwidth: ${totalBw} bytes`);
          }
        }
      } catch (e) {
        console.warn("[get-rotating-credentials] Failed to fetch aggregate stats:", e);
      }

      console.log(`[get-rotating-credentials] Bandwidth: used=${aggregateUsed}, limit=${bandwidthLimit}`);

      return new Response(JSON.stringify({
        proxy_host: "p.webshare.io",
        http_port: 80,
        socks5_port: 1080,
        username: rotatingUsernameBase,
        password: rotatingPassword,
        country_suffix: buildRotatingCountrySuffix(countryCode),
        bandwidth_limit_gb: bandwidthLimit ? bandwidthLimit / (1024 * 1024 * 1024) : null,
        bandwidth_used_bytes: aggregateUsed,
        bandwidth_limit_bytes: bandwidthLimit,
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
      const countryCode = "BR";
      const bbResp = await webFetch("/proxy/list/?mode=backbone&page=1&page_size=1", WEBSHARE_API_KEY);
      const bbData = await bbResp.json();

      let rotatingUsername = "";
      let rotatingPassword = "";

      if (bbResp.ok && bbData.results?.length > 0) {
        const bbProxy = bbData.results[0];
        rotatingUsername = buildRotatingUsername(bbProxy.username || bbProxy.proxy_username || "", countryCode);
        rotatingPassword = bbProxy.password || "";
      }

      if (!rotatingUsername) {
        const configResp = await webFetch("/proxy/config/", WEBSHARE_API_KEY);
        const configData = await configResp.json();
        if (!configResp.ok) throw new Error(`Webshare config error [${configResp.status}]`);
        rotatingUsername = buildRotatingUsername(configData.username || configData.proxy_username || "", countryCode);
        rotatingPassword = rotatingPassword || configData.password || configData.proxy_password || "";
      }

      if (!rotatingUsername) {
        throw new Error("Não foi possível gerar o usuário rotativo do Webshare");
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

    // ========== GET INTERNAL PROXY CONFIG ==========
    if (action === "get-internal-proxy-config") {
      const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _user_id: user.id });
      if (!isStaff) throw new Error("Acesso negado");

      // 1. Check for saved override in DB
      const { data: savedConfig } = await supabaseAdmin
        .from("internal_proxy_configs")
        .select("*")
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2. Always fetch auto-suggested from Webshare
      let autoConfig: Record<string, any> | null = null;
      try {
        const countryCode = "BR";
        const bbResp = await webFetch("/proxy/list/?mode=backbone&page=1&page_size=1", WEBSHARE_API_KEY);
        const bbData = await bbResp.json();

        let baseUsername = "";
        let pwd = "";

        if (bbResp.ok && bbData.results?.length > 0) {
          const bb = bbData.results[0];
          baseUsername = normalizeRotatingBaseUsername(bb.username || bb.proxy_username || "");
          pwd = bb.password || "";
        }

        if (!baseUsername) {
          const cfgResp = await webFetch("/proxy/config/", WEBSHARE_API_KEY);
          const cfgData = await cfgResp.json();
          if (cfgResp.ok) {
            baseUsername = normalizeRotatingBaseUsername(cfgData.username || cfgData.proxy_username || "");
            pwd = pwd || cfgData.password || cfgData.proxy_password || "";
          }
        }

        if (baseUsername) {
          // Resolve p.webshare.io to a real IPv4 so tools like Multilogin don't strip the subdomain
          let resolvedIP: string | null = null;
          try {
            const dnsResp = await fetch("https://dns.google/resolve?name=p.webshare.io&type=A");
            const dnsData = await dnsResp.json();
            const answers = Array.isArray(dnsData?.Answer) ? dnsData.Answer : [];
            resolvedIP = answers.find((answer: any) => answer?.type === 1 && /^\d+\.\d+\.\d+\.\d+$/.test(answer?.data || ""))?.data ?? null;
          } catch {}

          autoConfig = {
            host: "p.webshare.io",
            converted_host: resolvedIP || null,
            http_port: 80,
            socks5_port: 1080,
            alt_http_port: 3128,
            username: `${baseUsername}${buildRotatingCountrySuffix(countryCode)}`,
            password: pwd,
          };
        }
      } catch (e: any) {
        console.warn("[get-internal-proxy-config] Auto-fetch error:", e.message);
      }

      // 3. Fetch bandwidth — use backbone-specific stats for rotating proxy
      let bandwidth: Record<string, any> = {};
      try {
        const subResp = await webFetch("/subscription/", WEBSHARE_API_KEY);
        const subData = await subResp.json();

        // Get the backbone (rotating) bandwidth limit specifically
        const backboneLimitBytes = subData.bandwidth_limit_backbone || 0;
        const totalLimitBytes = subData.bandwidth_limit || 0;
        // Use backbone-specific limit if available, otherwise fall back to total
        const limitBytes = backboneLimitBytes > 0 ? backboneLimitBytes : totalLimitBytes;

        // Fetch backbone-specific aggregate stats for actual rotating proxy usage
        let usedBytes = 0;
        if (subData.start_date && subData.end_date) {
          try {
            // Filter by mode=backbone to get ONLY rotating proxy bandwidth
            const aggResp = await webFetch(
              `/stats/aggregate/?mode=backbone&timestamp__gte=${subData.start_date}&timestamp__lte=${subData.end_date}`,
              WEBSHARE_API_KEY
            );
            const aggData = await aggResp.json();
            console.log(`[get-internal-proxy-config] backbone aggregate stats:`, JSON.stringify(aggData));
            if (aggResp.ok && (aggData.bandwidth_total !== undefined || aggData.bandwidth !== undefined)) {
              usedBytes = aggData.bandwidth_total || aggData.bandwidth || 0;
            }
          } catch (e: any) {
            console.warn(`[get-internal-proxy-config] backbone stats error:`, e.message);
          }
        }

        // Fallback: if backbone stats returned 0, try bandwidth_used_backbone from subscription
        if (usedBytes === 0) {
          usedBytes = subData.bandwidth_used_backbone || subData.bandwidth_backbone || 0;
        }

        console.log(`[get-internal-proxy-config] bandwidth: used=${usedBytes}, limit=${limitBytes}, backbone_limit=${backboneLimitBytes}`);

        bandwidth = {
          used_bytes: usedBytes,
          limit_bytes: limitBytes,
        };
      } catch (e: any) {
        console.warn(`[get-internal-proxy-config] bandwidth fetch error:`, e.message);
      }

      // 4. Determine active config
      const useManual = savedConfig?.source === "manual_override" && savedConfig?.username && savedConfig?.password;
      const activeSource = useManual ? "manual_override" : "webshare_auto";

      const activeConfig = useManual
        ? {
            host: savedConfig.host || autoConfig?.host || "p.webshare.io",
            converted_host: savedConfig.converted_host || null,
            http_port: savedConfig.http_port || 80,
            socks5_port: savedConfig.socks5_port || 1080,
            alt_http_port: savedConfig.alt_http_port || 3128,
            username: savedConfig.username,
            password: savedConfig.password,
          }
        : autoConfig;

      console.log(`[get-internal-proxy-config] source=${activeSource}`);

      return new Response(JSON.stringify({
        active_source: activeSource,
        active: activeConfig,
        auto_suggested: autoConfig,
        saved_override: savedConfig || null,
        bandwidth,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== SAVE INTERNAL PROXY CONFIG ==========
    if (action === "save-internal-proxy-config") {
      const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _user_id: user.id });
      if (!isStaff) throw new Error("Acesso negado");

      const { config } = params as { config: Record<string, any> };
      if (!config) throw new Error("config é obrigatório");

      // Upsert: delete old active, insert new
      await supabaseAdmin
        .from("internal_proxy_configs")
        .delete()
        .eq("status", "active");

      const { error: insertErr } = await supabaseAdmin
        .from("internal_proxy_configs")
        .insert({
          label: config.label || "Proxy Interno BR",
          provider_slug: "webshare",
          country_code: config.country_code || "BR",
          host: config.host || "p.webshare.io",
          converted_host: config.converted_host || null,
          http_port: config.http_port || 80,
          socks5_port: config.socks5_port || 1080,
          alt_http_port: config.alt_http_port || 3128,
          username: config.username || "",
          password: config.password || "",
          source: config.source || "manual_override",
          status: "active",
          notes: config.notes || null,
        });

      if (insertErr) throw new Error(`Erro ao salvar: ${insertErr.message}`);
      console.log(`[save-internal-proxy-config] Saved by ${user.id}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== MIGRATE PROXYBR RENEWAL → WEBSHARE ==========
    if (action === "migrate-proxybr-renewal") {
      const { subscription_name, proxy_index, total_proxies, auto_renew_user_id } = params as {
        subscription_name: string;
        proxy_index?: number;
        total_proxies?: number;
        auto_renew_user_id?: string;
      };
      if (!subscription_name) throw new Error("subscription_name é obrigatório");

      const targetUserId = auto_renew_user_id || user?.id;
      if (!targetUserId) throw new Error("Usuário não identificado");

      // 1. Find the ProxyBR subscription in DB (search by name across all users since sync may assign to admin)
      let existingSub: any = null;
      {
        const { data: directSub } = await supabaseAdmin
          .from("subscriptions")
          .select("*, products:product_id(name, price, tags)")
          .eq("user_id", targetUserId)
          .eq("name", subscription_name)
          .eq("type", "proxybr")
          .maybeSingle();
        
        if (directSub) {
          existingSub = directSub;
        } else {
          // Fallback: search across all users (sync-cron may have assigned to admin user)
          const { data: anySub } = await supabaseAdmin
            .from("subscriptions")
            .select("*, products:product_id(name, price, tags)")
            .eq("name", subscription_name)
            .eq("type", "proxybr")
            .limit(1)
            .maybeSingle();
          existingSub = anySub;
        }
      }
      if (!existingSub) throw new Error("Assinatura ProxyBR não encontrada");

      // For single-proxy subs or non-exploded, check if still active
      const isMultiProxy = (total_proxies || 0) > 1;
      if (!isMultiProxy) {
        if (!["expired", "cancelled"].includes(existingSub.status) && existingSub.end_date) {
          const endDate = new Date(existingSub.end_date);
          if (endDate > new Date()) throw new Error("Esta assinatura ainda está ativa");
        }
      }

      // 2. Detect country from raw_data or product
      const raw = (existingSub.raw_data || {}) as Record<string, any>;
      const productInfo = existingSub.products as any;
      let targetCountry = "BR";
      const productName = (productInfo?.name || raw.product?.name || raw.product_name || existingSub.name || "").toLowerCase();
      if (productName.includes("us") || productName.includes("estados unidos") || productName.includes("usa")) {
        targetCountry = "US";
      }
      const rawCountry = raw.proxies?.data?.[0]?.country_code || raw.country_code;
      if (rawCountry) targetCountry = rawCountry.toUpperCase();

      console.log(`[migrate-proxybr] Sub=${subscription_name} country=${targetCountry} multiProxy=${isMultiProxy} proxyIndex=${proxy_index}`);

      // 3. Find Webshare product price
      const { data: wsProducts } = await supabaseAdmin
        .from("products")
        .select("id, name, price, tags")
        .eq("available", true)
        .ilike("name", "%proxy%");

      let matchedProduct: any = null;
      for (const p of (wsProducts || [])) {
        const pName = p.name.toLowerCase();
        const pTags = (p.tags || []) as string[];
        const isWebshare = pName.includes("residencial") || pName.includes("webshare") || pTags.some((t: string) => t.toLowerCase() === "webshare");
        if (!isWebshare) continue;
        const pCountry = detectCountryFromProduct(p);
        if (pCountry === targetCountry) { matchedProduct = p; break; }
      }
      if (!matchedProduct) {
        matchedProduct = (wsProducts || []).find((p: any) => p.name.toLowerCase().includes("residencial") || p.name.toLowerCase().includes("webshare"));
      }

      const renewalPrice = matchedProduct?.price || productInfo?.price || 25;
      console.log(`[migrate-proxybr] Renewal price: R$${renewalPrice} product=${matchedProduct?.name || "fallback"}`);

      // 4. Check wallet balance
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("balance, full_name")
        .eq("user_id", targetUserId)
        .single();

      if (!profile) throw new Error("Perfil não encontrado");
      if (profile.balance < renewalPrice) throw new Error(`Saldo insuficiente. Necessário: R$ ${renewalPrice.toFixed(2)}, disponível: R$ ${profile.balance.toFixed(2)}`);

      // 5. Fetch available Webshare proxies
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
      const { data: existSubs } = await supabaseAdmin
        .from("subscriptions").select("raw_data")
        .eq("type", "webshare").in("status", ["active", "expiring"]);
      const assignedIds = new Set<string>();
      for (const s of (existSubs || [])) {
        const r = (s.raw_data || {}) as Record<string, any>;
        if (r.webshare_proxy_id) assignedIds.add(r.webshare_proxy_id);
      }

      let available = allProxies.filter(p => p.valid && !assignedIds.has(p.id));
      const countryFiltered = available.filter(p => p.country_code?.toUpperCase() === targetCountry);
      if (countryFiltered.length === 0) throw new Error(`Nenhum proxy ${targetCountry} disponível no momento`);
      const assignedProxy = countryFiltered[0];

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);

      const newRawData = {
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
        migrated_from: "proxybr",
        original_name: existingSub.name,
        profile_tag: raw.profile_tag || null,
      };

      // 6. For multi-proxy subs, CREATE a new row; for single-proxy, UPDATE the existing row
      if (isMultiProxy) {
        // Create a new Webshare subscription for this specific proxy
        const newSubName = `${subscription_name}#${proxy_index || 1}`;
        const { error: insertErr } = await supabaseAdmin
          .from("subscriptions")
          .insert({
            user_id: targetUserId,
            name: newSubName,
            type: "webshare",
            status: "active",
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            auto_renew: existingSub.auto_renew,
            product_id: matchedProduct?.id || existingSub.product_id,
            raw_data: { ...newRawData, proxy_index: proxy_index },
          });

        if (insertErr) throw new Error(`Erro ao criar assinatura: ${insertErr.message}`);

        // Track migrated proxies on the original sub
        const migratedProxies = raw.migrated_proxies || [];
        migratedProxies.push(proxy_index || 1);
        const allMigrated = migratedProxies.length >= (total_proxies || 1);

        await supabaseAdmin
          .from("subscriptions")
          .update({
            raw_data: { ...raw, migrated_proxies: migratedProxies },
            ...(allMigrated ? { status: "migrated" } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSub.id);
      } else {
        // Single proxy: update in-place
        const { error: updateErr } = await supabaseAdmin
          .from("subscriptions")
          .update({
            type: "webshare",
            status: "active",
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            product_id: matchedProduct?.id || existingSub.product_id,
            cancelled_at: null,
            updated_at: new Date().toISOString(),
            raw_data: { ...newRawData, original_raw_data: raw },
          })
          .eq("id", existingSub.id);

        if (updateErr) throw new Error(`Erro ao atualizar assinatura: ${updateErr.message}`);
      }

      // 7. Debit wallet
      const newBalance = profile.balance - renewalPrice;
      await supabaseAdmin.from("profiles").update({ balance: newBalance }).eq("user_id", targetUserId);

      // 8. Record wallet transaction
      await supabaseAdmin.from("wallet_transactions").insert({
        user_id: targetUserId,
        type: "purchase",
        title: `Renovação Proxy ${subscription_name}${isMultiProxy ? `#${proxy_index || 1}` : ''}`,
        amount: -renewalPrice,
        balance_after: newBalance,
        reference_id: existingSub.id,
      });

      // 9. Admin notification
      const clientName = profile.full_name || "Cliente";
      await supabaseAdmin.from("notifications").insert({
        title: "Migração ProxyBR → Webshare",
        message: `${clientName} renovou ${subscription_name}${isMultiProxy ? `#${proxy_index || 1}` : ''} • R$ ${renewalPrice.toFixed(2)} • ${assignedProxy.proxy_address}:${assignedProxy.port} (${targetCountry})`,
        type: "order",
        global: true,
      });

      console.log(`[migrate-proxybr] Success: ${subscription_name} → Webshare proxy ${assignedProxy.id}`);

      return new Response(JSON.stringify({
        success: true,
        subscription_name,
        new_proxy: `${assignedProxy.proxy_address}:${assignedProxy.port}:${assignedProxy.username}:${assignedProxy.password}`,
        price: renewalPrice,
        migrated: true,
      }), {
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
