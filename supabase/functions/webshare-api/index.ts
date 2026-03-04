import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBSHARE_BASE = "https://proxy.webshare.io/api/v2";

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

    const { action, ...params } = await req.json();
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
      const { order_id, total, product_id } = params as {
        order_id: string;
        total: number;
        product_id?: string;
      };

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

      // 4. Find first unassigned proxy
      const available = allProxies.filter(p => p.valid && !assignedIds.has(p.id));
      if (available.length === 0) throw new Error("Todos os proxies estão atribuídos. Sem estoque.");

      const assignedProxy = available[0];

      // 5. Calculate end date (30 days from now)
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);

      // 6. Create subscription record
      const subName = `WS-${Date.now().toString(36).toUpperCase()}`;
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
        },
      });

      if (subErr) throw new Error(`Erro ao criar assinatura: ${subErr.message}`);

      // 7. Debit balance
      const newBalance = profile.balance - total;
      await supabaseAdmin
        .from("profiles")
        .update({ balance: newBalance })
        .eq("user_id", user.id);

      // 8. Record wallet transaction
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

      // 9. Update order status
      await supabaseAdmin
        .from("orders")
        .update({
          status: "completed",
          payment_method: "saldo",
          total,
        })
        .eq("id", order_id);

      // 10. Notify admin
      await supabaseAdmin.from("notifications").insert({
        title: "Proxy Webshare Vendido",
        message: `Proxy ${assignedProxy.proxy_address}:${assignedProxy.port} atribuído ao cliente. Pedido #${orderData?.code || ""}`,
        type: "order",
        global: true,
      });

      console.log(`[webshare-api] Proxy ${assignedProxy.id} assigned to user ${user.id}`);

      return new Response(JSON.stringify({
        success: true,
        subscription: subName,
        proxy: {
          ip: assignedProxy.proxy_address,
          port: assignedProxy.port,
          username: assignedProxy.username,
          password: assignedProxy.password,
        },
      }), {
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

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (err: any) {
    console.error("[webshare-api] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
