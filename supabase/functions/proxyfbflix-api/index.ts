import { createClient } from "npm:@supabase/supabase-js@2";

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

function buildRotatingUsername(rawUsername: string, countryCode = "BR", cityName?: string): string {
  const baseUsername = normalizeRotatingBaseUsername(rawUsername);
  if (!baseUsername) return "";
  let u = `${baseUsername}${buildRotatingCountrySuffix(countryCode)}`;
  if (cityName && cityName !== "all") {
    // Webshare format for city is -city-CityName
    const formattedCity = cityName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
    u = `${u}-city-${formattedCity}`;
  }
  return u;
}

async function webFetch(
  path: string,
  apiKey: string,
  method = "GET",
  body?: string,
  options: { throwOnServerError?: boolean; retries?: number } = {},
) {
  const url = path.startsWith("http") ? path : `${WEBSHARE_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Token ${apiKey}`,
    Accept: "application/json",
  };
  if (body) headers["Content-Type"] = "application/json";

  const maxAttempts = Math.max(1, options.retries ?? (method === "GET" ? 2 : 1));
  let resp: Response | null = null;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    // Keep per-attempt timeout low so total (attempts * timeout + backoff)
    // stays well under the 150s edge-function idle limit.
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      resp = await fetch(url, { method, headers, body: body || undefined, signal: controller.signal });
    } catch (e: any) {
      clearTimeout(timeout);
      lastError = e;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        continue;
      }
      if (e.name === "AbortError") {
        throw new Error("API do fornecedor (Proxy Fbflix/Webshare) está lenta/fora do ar. Aguarde alguns minutos e tente novamente.");
      }
      throw e;
    }
    clearTimeout(timeout);

    if (resp.status >= 500 && attempt < maxAttempts) {
      console.warn(`[webFetch] ${url} returned ${resp.status}, retrying attempt ${attempt + 1}/${maxAttempts}`);
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      continue;
    }

    break;
  }

  if (!resp) throw lastError || new Error("Proxy Fbflix API indisponível. Tente novamente.");

  if (resp.status === 429) {
    throw new Error("Proxy Fbflix rate limit atingido. Tente novamente em 60s.");
  }
  if (resp.status >= 500 && options.throwOnServerError !== false) {
    throw new Error(`Proxy Fbflix API indisponível (${resp.status}). Tente novamente em alguns minutos.`);
  }
  // Safe JSON wrapper: prevents "Unexpected token '<'" crashes when Webshare
  // returns an HTML error page (404/auth/maintenance).
  const originalJson = resp.json.bind(resp);
  (resp as any).json = async () => {
    const text = await resp.text();
    if (!text || !text.trim()) return {};
    const trimmed = text.trimStart();
    // Webshare upstream outage: API returns plain-text "404 page not found" on all v2 endpoints.
    if (resp.status === 404 && /404 page not found/i.test(trimmed)) {
      throw new Error("API do fornecedor (Proxy Fbflix/Webshare) está fora do ar no momento. Aguarde alguns minutos e tente novamente.");
    }
    if (trimmed.startsWith("<")) {
      console.error(`[webFetch] Non-JSON response from ${url} [${resp.status}]: ${trimmed.slice(0, 200)}`);
      
      // If the caller is expecting JSON but gets HTML, and it's a 404, we let the caller handle the 404 status
      if (resp.status === 404) {
        return { error: "Not Found", status: 404 };
      }
      
      throw new Error(`Proxy Fbflix retornou resposta inválida (${resp.status}). Tente novamente em alguns minutos.`);
    }
    try {
      return JSON.parse(text);
    } catch {
      console.error(`[webFetch] Invalid JSON from ${url}: ${text.slice(0, 200)}`);
      throw new Error("API do fornecedor (Proxy Fbflix/Webshare) está fora do ar no momento. Aguarde alguns minutos e tente novamente.");
    }
  };
  void originalJson;
  return resp;
}

function isSupplierOutageError(error: unknown): boolean {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return (
    message.includes("fornecedor") ||
    message.includes("webshare") ||
    message.includes("proxy fbflix api indisponível") ||
    message.includes("proxy fbflix api error") ||
    message.includes("proxy fbflix retornou resposta inválida") ||
    message.includes("aborterror") ||
    message.includes("timeout")
  );
}

function providerOfflinePayload(error: unknown, extra: Record<string, unknown> = {}) {
  return {
    provider_unavailable: true,
    warning: "Fornecedor de proxies temporariamente instável. Os dados ao vivo serão retomados automaticamente quando normalizar.",
    upstream_error: String((error as any)?.message || error || "Erro no fornecedor"),
    ...extra,
  };
}

const SAFE_SUPPLIER_READ_ACTIONS = new Set([
  "get-profile",
  "get-subscription",
  "get-plan",
  "get-proxy-list",
  "get-all-proxies",
  "get-usage-stats",
  "get-proxy-config",
  "get-bandwidth-stats",
  "get-rotating-credentials",
  "get-internal-proxy-config",
]);

async function fetchAllWebshareProxies(apiKey: string, mode: "direct" | "backbone" = "direct") {
  const proxies: any[] = [];
  let page = 1;

  while (true) {
    const resp = await webFetch(
      `/proxy/list/?mode=${mode}&page=${page}&page_size=250`,
      apiKey,
      "GET",
      undefined,
      { throwOnServerError: false },
    );
    // Tolerate transient 404/5xx on the list endpoint: stop paging instead of failing the whole sync.
    if (resp.status === 404) {
      console.warn(`[fetchAllWebshareProxies] list endpoint returned 404 on page ${page}; stopping pagination`);
      break;
    }
    if (!resp.ok) {
      throw new Error(`Proxy Fbflix API error [${resp.status}]`);
    }
    let data: any;
    try {
      data = await resp.json();
    } catch (e: any) {
      // The overridden resp.json() already logs the offending body; surface a friendly message.
      throw new Error(e?.message || `Proxy Fbflix retornou resposta inválida (${resp.status}). Tente novamente.`);
    }

    if (data.results?.length) proxies.push(...data.results);
    if (!data.next) break;
    page++;
  }

  return proxies;
}

function buildStaticWebshareRawData(proxy: any, currentRaw: Record<string, any> = {}): Record<string, any> {
  return {
    ...currentRaw,
    fbflix_proxy_id: proxy.id,
    proxy_address: proxy.proxy_address,
    port: proxy.port,
    username: proxy.username,
    password: proxy.password,
    country_code: proxy.country_code,
    city_name: proxy.city_name,
    provider: "proxyfbflix",
  };
}

async function getAssignedProxyIds(supabase: any, userId?: string) {
  // We want to be VERY aggressive in finding assigned proxies to avoid duplicates.
  // We include ALL types that might use Webshare proxies and all "live" statuses.
  const { data: existSubs } = await supabase
    .from("subscriptions")
    .select("user_id, raw_data")
    .in("status", ["active", "expiring", "processing", "past_due", "expired"]);

  const assignedIds = new Set<string>();
  const assignedIPs = new Set<string>();
  const userIPs = new Set<string>();
  
  for (const s of (existSubs || [])) {
    const raw = (s.raw_data || {}) as Record<string, any>;
    
    // Check various ID fields
    const fid = raw.fbflix_proxy_id || raw.webshare_proxy_id;
    if (fid) assignedIds.add(String(fid));
    
    // Check IP addresses
    const ip = raw.proxy_address || raw.ip;
    if (ip) {
      assignedIPs.add(String(ip));
      if (userId && s.user_id === userId) userIPs.add(String(ip));
    }

    // Also check used_ips history for this user if available in raw_data
    if (userId && s.user_id === userId && Array.isArray(raw.used_ips)) {
      raw.used_ips.forEach((uip: any) => userIPs.add(String(uip)));
    }

    // CRITICAL: Also check proxies inside the data array for multi-proxy packs
    const proxiesData = raw.proxies?.data || [];
    if (Array.isArray(proxiesData)) {
      for (const p of proxiesData) {
        const pid = p.id;
        if (pid) assignedIds.add(String(pid));
        
        const pip = p.proxy_address || p.ip || (p.code?.includes(':') ? p.code.split(':')[0] : null);
        if (pip) {
          assignedIPs.add(String(pip));
          if (userId && s.user_id === userId) userIPs.add(String(pip));
        }
      }
    }
  }
  
  return { assignedIds, assignedIPs, userIPs };
}

Deno.serve(async (req) => {
  let bodyText = "";
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const WEBSHARE_API_KEY = Deno.env.get("WEBSHARE_API_KEY");
    if (!WEBSHARE_API_KEY) throw new Error("WEBSHARE_API_KEY não configurada");

    // SECTION: INTERNAL ADMIN ALLOCATE (no user JWT needed)
    bodyText = await req.text();
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

      // Get assigned proxy IDs and IPs
      const { assignedIds, assignedIPs, userIPs } = await getAssignedProxyIds(supabaseInternal, target_user_id);

      // Efficient search: stop as soon as we find enough proxies
      const available: any[] = [];
      let pg = 1;
      while (available.length < qty) {
        let url = `/proxy/list/?mode=direct&page=${pg}&page_size=250`;
        if (targetCountry) url += `&country_code=${targetCountry}`;
        
        const resp = await webFetch(url, WEBSHARE_API_KEY);
        const data = await resp.json();
        if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]`);
        
        const results = data.results || [];
        if (results.length === 0) break;

        for (const p of results) {
          const isAssigned = assignedIds.has(String(p.id)) || assignedIPs.has(String(p.proxy_address));
          const isPreviouslyUsed = userIPs.has(String(p.proxy_address));

          if (p.valid && !isAssigned && !isPreviouslyUsed) {
            available.push(p);
            // Track what we just picked to avoid duplicates within this same batch
            assignedIds.add(String(p.id));
            assignedIPs.add(String(p.proxy_address));
            
            if (available.length >= qty) break;
          }
        }
        
        if (!data.next) break;
        pg++;
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
          type: "proxyfbflix",
          status: "active",
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          product_id: iProdId || null,
          auto_renew: false,
          raw_data: {
            fbflix_proxy_id: proxy.id,
            proxy_address: proxy.proxy_address,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password,
            country_code: proxy.country_code,
            city_name: proxy.city_name,
            provider: "proxyfbflix",
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

    // SECTION: INTERNAL: UPDATE SUBSCRIPTION (no user JWT needed)
    if (bodyClone.action === "internal-allocate-included-proxy") {
      const supabaseInternal = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const incOrderId = bodyClone.order_id as string;
      if (!incOrderId) throw new Error("order_id é obrigatório");

      const { data: incOrder } = await supabaseInternal
        .from("orders")
        .select("id, user_id, reseller_id, status")
        .eq("id", incOrderId)
        .maybeSingle();
      if (!incOrder) throw new Error("Pedido não encontrado");

      const { data: incItems } = await supabaseInternal
        .from("order_items")
        .select("id, quantity, product_id, products:product_id(name, included_proxy_product_id, included_proxy_qty)")
        .eq("order_id", incOrderId);

      const results: any[] = [];

      for (const oi of (incItems || []) as any[]) {
        const prod = oi.products;
        const bundleProductId = prod?.included_proxy_product_id;
        const perUnit = Number(prod?.included_proxy_qty || 0);
        if (!bundleProductId || perUnit <= 0) continue;

        const needed = perUnit * Math.max(1, Number(oi.quantity || 1));

        // Idempotency: count subscriptions already created for this order item
        const { data: existingSubs } = await supabaseInternal
          .from("subscriptions")
          .select("id, raw_data")
          .eq("user_id", incOrder.user_id)
          .in("status", ["active", "expiring"]);
        const alreadyCount = (existingSubs || []).filter(
          (s: any) => String((s.raw_data || {}).included_order_item_id || "") === String(oi.id)
        ).length;
        const missingCount = needed - alreadyCount;
        if (missingCount <= 0) continue;

        const { data: bundleProduct } = await supabaseInternal
          .from("products").select("id, name, tags").eq("id", bundleProductId).maybeSingle();
        const bundleCountry = bundleProduct ? detectCountryFromProduct(bundleProduct as any) : "BR";

        const { assignedIds, assignedIPs, userIPs } = await getAssignedProxyIds(supabaseInternal, incOrder.user_id);

        const pool: any[] = [];
        let pageIdx = 1;
        while (pool.length < missingCount) {
          let url = `/proxy/list/?mode=direct&page=${pageIdx}&page_size=250`;
          if (bundleCountry) url += `&country_code=${bundleCountry}`;
          const resp = await webFetch(url, WEBSHARE_API_KEY);
          const data = await resp.json();
          if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]`);
          const results0 = data.results || [];
          if (results0.length === 0) break;
          for (const p of results0) {
            if (!p.valid) continue;
            if (assignedIds.has(String(p.id)) || assignedIPs.has(String(p.proxy_address))) continue;
            if (userIPs.has(String(p.proxy_address))) continue;
            pool.push(p);
            assignedIds.add(String(p.id));
            assignedIPs.add(String(p.proxy_address));
            if (pool.length >= missingCount) break;
          }
          if (!data.next) break;
          pageIdx++;
        }

        for (let i = 0; i < Math.min(missingCount, pool.length); i++) {
          const proxy = pool[i];
          const startDate = new Date();
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 30);
          const subName = `WS-${Date.now().toString(36).toUpperCase()}${i > 0 ? `-${i + 1}` : ""}`;

          await supabaseInternal.from("subscriptions").insert({
            user_id: incOrder.user_id,
            name: subName,
            type: "proxyfbflix",
            status: "active",
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            // product_id do proxy => renovação usa o preço de tabela normal do proxy
            product_id: bundleProductId,
            auto_renew: false,
            reseller_id: (incOrder as any).reseller_id ?? null,
            raw_data: {
              fbflix_proxy_id: proxy.id,
              proxy_address: proxy.proxy_address,
              port: proxy.port,
              username: proxy.username,
              password: proxy.password,
              country_code: proxy.country_code,
              city_name: proxy.city_name,
              provider: "proxyfbflix",
              exchange_quota_free: 2,
              exchange_quota_pay: 0,
              order_id: incOrderId,
              included_order_item_id: oi.id,
              included_in_product_id: oi.product_id,
              included_free_first_month: true,
              reseller_id: (incOrder as any).reseller_id ?? null,
            },
          });
          results.push({ name: subName, ip: proxy.proxy_address, port: proxy.port });
        }

        if (pool.length < missingCount) {
          await supabaseInternal.from("notifications").insert({
            title: "Proxy incluso pendente",
            message: `Faltam ${missingCount - pool.length} proxy(s) ${bundleCountry} para o pedido ${incOrderId} (produto ${prod?.name || ""}).`,
            type: "system",
            global: true,
          });
        }
      }

      return new Response(JSON.stringify({ success: true, allocated: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // SECTION: INTERNAL: DELETE SUBSCRIPTION (permanent removal)
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

    if (bodyClone.action === "internal-delete-webshare-proxy-noauth") {
      const { fbflix_proxy_id } = bodyClone;
      if (!fbflix_proxy_id) throw new Error("fbflix_proxy_id é obrigatório");
      const resp = await webFetch(`/proxy/list/${fbflix_proxy_id}/`, WEBSHARE_API_KEY, "DELETE");
      if (resp.status !== 204 && resp.status !== 404) {
        const text = await resp.text();
        throw new Error(`Webshare delete error [${resp.status}]: ${text.slice(0, 200)}`);
      }
      const supabaseInternal2 = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabaseInternal2.from("subscriptions").delete().eq("raw_data->>fbflix_proxy_id", fbflix_proxy_id);
      return new Response(JSON.stringify({ success: true, fbflix_proxy_id, status: resp.status }), {
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
        // Try B2B Token validation
        const { data: b2bTokenData, error: b2bError } = await supabaseAdmin
          .from("b2b_tokens")
          .select("user_id, status")
          .eq("token", token)
          .single();

        if (b2bError || !b2bTokenData || b2bTokenData.status !== 'active') {
          return new Response(JSON.stringify({ error: "Token inválido ou expirado. Para integrações fixas, utilize um Token B2B permanente." }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Token is valid, get the user
        const { data: b2bUser, error: b2bUserError } = await supabaseAdmin.auth.admin.getUserById(b2bTokenData.user_id);
        if (b2bUserError || !b2bUser.user) {
          return new Response(JSON.stringify({ error: "Usuário do token não encontrado" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        user = b2bUser.user;
        console.log(`[webshare-api] Authenticated via B2B Token for user ${user.id}`);
      } else {
        user = authUser;
      }
    }

    const { action, ...params } = bodyClone;
    console.log(`[webshare-api] action=${action} user=${user?.id || 'service-role'}`);

    // SECTION: GET PROFILE
    if (action === "get-profile") {
      const resp = await webFetch("/profile/", WEBSHARE_API_KEY);
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECTION: GET SUBSCRIPTION
    if (action === "get-subscription") {
      const resp = await webFetch("/subscription/", WEBSHARE_API_KEY);
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECTION: GET PLAN
    if (action === "get-plan") {
      try {
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
      } catch (e) {
        if (!isSupplierOutageError(e)) throw e;
        return new Response(JSON.stringify(providerOfflinePayload(e, { subscription: null, plan: null })), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // SECTION: GET PROXY LIST
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

    // SECTION: GET ALL PROXIES (paginated fetch)
    if (action === "get-all-proxies") {
      try {
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
      } catch (e) {
        if (!isSupplierOutageError(e)) throw e;
        return new Response(JSON.stringify(providerOfflinePayload(e, { data: [], total: 0 })), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // SECTION: GET USAGE STATS (Top 10)
    if (action === "get-usage-stats") {
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) throw new Error("Acesso negado: apenas administradores");

      const period = params.period || "24h"; // 1h, 24h, 7d
      let timestampGte: string;
      
      const now = new Date();
      if (period === "1h") {
        timestampGte = new Date(now.getTime() - (60 * 60 * 1000)).toISOString();
      } else if (period === "7d") {
        timestampGte = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();
      } else {
        timestampGte = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString();
      }

      // Webshare usage stats endpoint (per proxy)
      const resp = await webFetch(`/stats/proxy/?timestamp__gte=${timestampGte}`, WEBSHARE_API_KEY);
      const rawText = await resp.text();
      if (!resp.ok) {
        console.error(`[get-usage-stats] Webshare error ${resp.status}: ${rawText.slice(0, 200)}`);
        // Return empty stats instead of crashing the UI when endpoint is unavailable
        return new Response(
          JSON.stringify({ data: [], warning: `Estatísticas de uso indisponíveis no momento (Webshare ${resp.status}).` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        console.error(`[get-usage-stats] Webshare returned non-JSON: ${rawText.slice(0, 200)}`);
        return new Response(
          JSON.stringify({ data: [], warning: "Estatísticas de uso temporariamente indisponíveis." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Group by proxy and sum bandwidth
      const stats = Array.isArray(data.results) ? data.results : [];
      const proxyMap = new Map<string, { upload: number, download: number, total: number }>();

      for (const s of stats) {
        const id = String(s.proxy_id);
        const current = proxyMap.get(id) || { upload: 0, download: 0, total: 0 };
        current.upload += (s.upload || 0);
        current.download += (s.download || 0);
        current.total += ((s.upload || 0) + (s.download || 0));
        proxyMap.set(id, current);
      }

      // Get all active subscriptions to link IDs to users
      const { data: subs } = await supabaseAdmin
        .from("subscriptions")
        .select("id, user_id, raw_data, name, profiles(full_name, email)")
        .in("type", ["proxyfbflix", "webshare"])
        .in("status", ["active", "expiring"]);

      const enriched = Array.from(proxyMap.entries()).map(([proxyId, consumption]) => {
        const sub = subs?.find(s => String((s.raw_data as any)?.fbflix_proxy_id) === proxyId);
        return {
          proxy_id: proxyId,
          usage_gb: Number((consumption.total / (1024 * 1024 * 1024)).toFixed(3)),
          download_gb: Number((consumption.download / (1024 * 1024 * 1024)).toFixed(3)),
          upload_gb: Number((consumption.upload / (1024 * 1024 * 1024)).toFixed(3)),
          user_id: sub?.user_id || null,
          user_name: (sub?.profiles as any)?.full_name || "Desconhecido",
          user_email: (sub?.profiles as any)?.email || sub?.name || "N/A",
          subscription_name: sub?.name || "N/A"
        };
      }).sort((a, b) => b.usage_gb - a.usage_gb).slice(0, 10);

      // Check against alerts
      const { data: alerts } = await supabaseAdmin
        .from("proxy_usage_alerts")
        .select("*")
        .eq("is_active", true);

      const findings = enriched.filter(u => {
        const matchingAlert = alerts?.find(a => a.period === period);
        return matchingAlert && u.usage_gb > matchingAlert.threshold;
      });

      // If findings and period is 1h, it might indicate torrent/heavy download
      const suspectedAbuse = findings.map(f => ({
        ...f,
        reason: "Consumo excessivo detectado no período"
      }));

      return new Response(JSON.stringify({ 
        top10: enriched,
        alerts_triggered: suspectedAbuse,
        period 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECTION: GET PROXY CONFIG
    if (action === "get-proxy-config") {
      const resp = await webFetch("/proxy/config/", WEBSHARE_API_KEY);
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]`);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECTION: GET BANDWIDTH STATS
    if (action === "get-bandwidth-stats") {
      try {
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
      } catch (e) {
        if (!isSupplierOutageError(e)) throw e;
        const now = new Date();
        const fallbackStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        return new Response(JSON.stringify(providerOfflinePayload(e, {
          aggregate: {},
          hourly: [],
          billing_start: fallbackStart,
          billing_end: now.toISOString(),
        })), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // SECTION: REPLACE PROXY
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

    // SECTION: GET IP AUTHORIZATION
    if (action === "get-ip-auth") {
      const resp = await webFetch("/proxy/ipauthorization/", WEBSHARE_API_KEY);
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]`);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECTION: PURCHASE PROXY WITH BALANCE
    // Assigns an unassigned Webshare proxy to the customer, debits balance, creates subscription
    if (action === "purchase-proxy-with-balance") {
      const { order_id, total, product_id, quantity: purchaseQty, target_city } = params as {
        order_id: string;
        total: number;
        product_id?: string;
        quantity?: number;
        target_city?: string;
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

      // 1.4 Inherit reseller_id from the order (so it shows in the reseller's dashboard)
      let orderResellerId: string | null = null;
      try {
        const { data: orderRow } = await supabaseAdmin
          .from("orders")
          .select("reseller_id")
          .eq("id", order_id)
          .maybeSingle();
        orderResellerId = (orderRow as any)?.reseller_id ?? null;
      } catch (_) { /* noop */ }

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

      // If user explicitly chose a US selection, override country to US
      const US_CITIES = ["new york","los angeles","chicago","miami","dallas","atlanta","seattle","san francisco","houston","phoenix"];
      if (target_city === "all_us" || (target_city && US_CITIES.includes(target_city.toLowerCase()))) {
        targetCountryCode = "US";
        console.log(`[webshare-api] Country overridden to US based on user city selection`);
      }

      // 2. Get already-assigned proxy IDs from local subscriptions (optimized fetch)
      const { data: existingSubs } = await supabaseAdmin
        .from("subscriptions")
        .select("raw_data")
        .in("type", ["proxyfbflix", "webshare"])
        .in("status", ["active", "expiring"]);

      const assignedIds = new Set<string>();
      for (const sub of (existingSubs || [])) {
        const raw = (sub.raw_data || {}) as Record<string, any>;
        const pid = raw.fbflix_proxy_id || raw.webshare_proxy_id;
        if (pid) assignedIds.add(String(pid));
      }

      // 3. Fetch Webshare proxies with filtering and early exit
      async function findAvailableProxies(country?: string | null, city?: string | null) {
        const found: any[] = [];
        let page = 1;
        const normalizedTargetCity = city && city !== "all" && city !== "all_us"
          ? city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "")
          : null;

        while (true) {
          // Webshare API supports filtering by country_code
          let url = `/proxy/list/?mode=direct&page=${page}&page_size=250`;
          if (country) url += `&country_code=${country}`;
          console.log(`[webshare-api] Fetching proxies from: ${url}`);

          const resp = await webFetch(url, WEBSHARE_API_KEY);
          const data = await resp.json();
          if (!resp.ok) throw new Error(`Erro ao buscar proxies Webshare`);
          
          const results = data.results || [];
          if (results.length === 0) break;

          for (const p of results) {
            if (!p.valid || assignedIds.has(String(p.id))) continue;
            if (country && p.country_code !== country) continue;
            
            if (normalizedTargetCity) {
              const pCity = (p.city_name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
              if (pCity !== normalizedTargetCity) continue;
            }
            
            found.push(p);
            if (found.length >= qty) return found;
          }

          if (!data.next) break;
          page++;
        }
        return found;
      }

      console.log(`[webshare-api] Searching for proxies: country=${targetCountryCode || 'any'}, city=${target_city || 'any'}`);
      
      // Try with city filter first
      let available = await findAvailableProxies(targetCountryCode, target_city);

      
      if (available.length < qty) {
        if (target_city && target_city !== "all" && target_city !== "all_us") {
          console.log(`[webshare-api] No availability for city "${target_city}", falling back to country "${targetCountryCode || 'BR'}"`);
          available = await findAvailableProxies(targetCountryCode || "BR", "all");
        }
        
        if (available.length < qty) {
          throw new Error(`Apenas ${available.length} proxy(s) disponível(is), mas ${qty} foram solicitados.`);
        }
      }

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
          type: "proxyfbflix",
          status: "active",
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          product_id: product_id || null,
          auto_renew: false,
          reseller_id: orderResellerId,
          raw_data: {
            fbflix_proxy_id: assignedProxy.id,
            proxy_address: assignedProxy.proxy_address,
            port: assignedProxy.port,
            username: assignedProxy.username,
            password: assignedProxy.password,
            country_code: assignedProxy.country_code,
            city_name: assignedProxy.city_name,
            provider: "proxyfbflix",
            exchange_quota_free: 2,
            exchange_quota_pay: 0,
            order_id: order_id,
            reseller_id: orderResellerId,
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
        : "Proxy Fbflix";
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

    // SECTION: ALLOCATE PROXY FOR AN ALREADY-PAID ORDER
    // Used when the checkout already debited the wallet (mixed carts / bumps).
    // Does NOT debit balance and does NOT change order totals.
    if (action === "allocate-proxy-for-paid-order") {
      const { order_id, product_id: paidProductId, quantity: paidQty, target_city: paidCity } = params as {
        order_id: string;
        product_id?: string;
        quantity?: number;
        target_city?: string;
      };

      if (!order_id) throw new Error("order_id é obrigatório");
      const qty = paidQty && paidQty > 0 ? paidQty : 1;

      const { data: orderRow } = await supabaseAdmin
        .from("orders")
        .select("id, user_id, status, reseller_id, code")
        .eq("id", order_id)
        .maybeSingle();

      if (!orderRow) throw new Error("Pedido não encontrado");

      const { data: callerIsAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (orderRow.user_id !== user.id && !callerIsAdmin) throw new Error("Acesso negado");
      if (!["completed", "processing", "pending_fulfillment"].includes(String(orderRow.status))) {
        throw new Error("Pedido não está pago");
      }

      // Idempotency: never allocate twice for the same order/product
      const { data: existingForOrder } = await supabaseAdmin
        .from("subscriptions")
        .select("id, name, product_id, raw_data")
        .eq("user_id", orderRow.user_id)
        .in("status", ["active", "expiring"]);

      const already = (existingForOrder || []).filter((s: any) => {
        const raw = (s.raw_data || {}) as Record<string, any>;
        return String(raw.order_id || "") === String(order_id)
          && (!paidProductId || s.product_id === paidProductId);
      });
      if (already.length >= qty) {
        return new Response(JSON.stringify({ success: true, already_allocated: true, quantity: already.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const missing = qty - already.length;

      let paidCountry: string | null = null;
      if (paidProductId) {
        const { data: productData } = await supabaseAdmin
          .from("products").select("name, tags").eq("id", paidProductId).maybeSingle();
        if (productData) paidCountry = detectCountryFromProduct(productData as any);
      }

      const { assignedIds: paidAssigned } = await getAssignedProxyIds(supabaseAdmin);

      const normalizedCity = paidCity && paidCity !== "all" && paidCity !== "all_us"
        ? paidCity.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "")
        : null;

      async function collect(country: string | null, city: string | null) {
        const out: any[] = [];
        let page = 1;
        while (out.length < missing) {
          let url = `/proxy/list/?mode=direct&page=${page}&page_size=250`;
          if (country) url += `&country_code=${country}`;
          const resp = await webFetch(url, WEBSHARE_API_KEY);
          const data = await resp.json();
          if (!resp.ok) throw new Error("Erro ao buscar proxies");
          const results = data.results || [];
          if (results.length === 0) break;
          for (const p of results) {
            if (!p.valid || paidAssigned.has(String(p.id))) continue;
            if (country && p.country_code !== country) continue;
            if (city) {
              const pCity = (p.city_name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
              if (pCity !== city) continue;
            }
            out.push(p);
            if (out.length >= missing) break;
          }
          if (!data.next) break;
          page++;
        }
        return out;
      }

      let picked = await collect(paidCountry, normalizedCity);
      if (picked.length < missing && normalizedCity) picked = await collect(paidCountry || "BR", null);
      if (picked.length < missing) {
        throw new Error(`Apenas ${picked.length} proxy(s) disponível(is), mas ${missing} necessário(s).`);
      }

      const allocatedPaid: any[] = [];
      for (let i = 0; i < missing; i++) {
        const proxy = picked[i];
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30);
        const subName = `WS-${Date.now().toString(36).toUpperCase()}${i > 0 ? `-${i + 1}` : ""}`;

        const { error: insErr } = await supabaseAdmin.from("subscriptions").insert({
          user_id: orderRow.user_id,
          name: subName,
          type: "proxyfbflix",
          status: "active",
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          product_id: paidProductId || null,
          auto_renew: false,
          reseller_id: (orderRow as any).reseller_id ?? null,
          raw_data: {
            fbflix_proxy_id: proxy.id,
            proxy_address: proxy.proxy_address,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password,
            country_code: proxy.country_code,
            city_name: proxy.city_name,
            provider: "proxyfbflix",
            exchange_quota_free: 2,
            exchange_quota_pay: 0,
            order_id: order_id,
            reseller_id: (orderRow as any).reseller_id ?? null,
          },
        });
        if (insErr) throw new Error(`Erro ao criar assinatura: ${insErr.message}`);
        paidAssigned.add(String(proxy.id));
        allocatedPaid.push({ name: subName, ip: proxy.proxy_address, port: proxy.port });
      }

      if (paidProductId) {
        const { data: ois } = await supabaseAdmin
          .from("order_items").select("id").eq("order_id", order_id).eq("product_id", paidProductId);
        for (const oi of (ois || [])) {
          await supabaseAdmin.from("order_items").update({
            delivery_data: { type: "webshare_proxy", fulfilled: true, count: qty },
          }).eq("id", oi.id);
        }
      }

      return new Response(JSON.stringify({ success: true, allocated: allocatedPaid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECTION: ADMIN ALLOCATE PROXY
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

      const aAssignedIds = await getAssignedProxyIds(supabaseAdmin);

      const aAvailable: any[] = [];
      let aPage = 1;
      while (aAvailable.length < qty) {
        let url = `/proxy/list/?mode=direct&page=${aPage}&page_size=250`;
        if (targetCountry) url += `&country_code=${targetCountry}`;
        
        const resp = await webFetch(url, WEBSHARE_API_KEY);
        const data = await resp.json();
        if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]`);
        
        const results = data.results || [];
        if (results.length === 0) break;

        for (const p of results) {
          if (p.valid && !aAssignedIds.has(String(p.id))) {
            aAvailable.push(p);
            if (aAvailable.length >= qty) break;
          }
        }
        
        if (!data.next) break;
        aPage++;
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
          type: "proxyfbflix",
          status: "active",
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          product_id: allocProductId || null,
          auto_renew: false,
          raw_data: {
            fbflix_proxy_id: proxy.id,
            proxy_address: proxy.proxy_address,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password,
            country_code: proxy.country_code,
            city_name: proxy.city_name,
            provider: "proxyfbflix",
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


    // SECTION: GET AVAILABLE COUNT
    // Returns how many unassigned proxies are available for sale
    if (action === "get-available-count") {
      const assignedIds = await getAssignedProxyIds(supabaseAdmin);

      // Count all proxies (we still need to iterate or fetch total for this specific count)
      const allProxies = await fetchAllWebshareProxies(WEBSHARE_API_KEY, "direct");
      const available = allProxies.filter(p => p.valid && !assignedIds.has(String(p.id)));

      return new Response(JSON.stringify({
        total: allProxies.length,
        assigned: assignedIds.size,
        available: available.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECTION: GET AVAILABLE LOCATIONS
    // Returns a list of cities/countries that have available (unassigned) proxies
    if (action === "get-available-locations") {
      const assignedIds = await getAssignedProxyIds(supabaseAdmin);
      const allProxies = await fetchAllWebshareProxies(WEBSHARE_API_KEY, "direct");

      const available = allProxies.filter(p => p.valid && !assignedIds.has(String(p.id)));
      
      const locations: Record<string, Set<string>> = {};
      available.forEach(p => {
        const country = p.country_code?.toUpperCase() || "UNKNOWN";
        if (!locations[country]) locations[country] = new Set();
        if (p.city_name) locations[country].add(p.city_name);
      });

      const result: Record<string, string[]> = {};
      for (const country in locations) {
        result[country] = Array.from(locations[country]).sort();
      }

      return new Response(JSON.stringify({
        success: true,
        locations: result,
        total_available: available.length
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECTION: SYNC WEBSHARE STATIC PROXY CREDENTIALS
    if (action === "sync-webshare-proxy-credentials") {
      const { subscription_id } = params as { subscription_id: string };
      if (!subscription_id) throw new Error("subscription_id é obrigatório");

      const { data: subRow, error: subErr } = await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("id", subscription_id)
        .eq("type", "proxyfbflix")
        .maybeSingle();

      if (subErr || !subRow) throw new Error("Assinatura não encontrada");

      if (!isServiceRole && subRow.user_id !== user?.id) {
        const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _user_id: user?.id });
        if (!isStaff) throw new Error("Sem permissão");
      }

      const raw = (subRow.raw_data || {}) as Record<string, any>;
      const proxyId = raw.fbflix_proxy_id ? String(raw.fbflix_proxy_id) : "";
      const proxyAddress = raw.proxy_address ? String(raw.proxy_address) : "";

      if (!proxyId && !proxyAddress) {
        throw new Error("Assinatura sem identificador do proxy");
      }

      const allProxies = await fetchAllWebshareProxies(WEBSHARE_API_KEY, "direct");
      const providerProxy = allProxies.find((proxy: any) => (
        (proxyId && String(proxy.id) === proxyId) ||
        (proxyAddress && proxy.proxy_address === proxyAddress)
      ));

      if (!providerProxy) {
        // Proxy was removed from Webshare — auto-reallocate from pool
        console.warn(`[sync-webshare-proxy-credentials] Proxy not found on Webshare (id=${proxyId}, ip=${proxyAddress}). Auto-reallocating...`);

        const targetCountry = raw.country_code ? String(raw.country_code).toUpperCase() : null;

        // Get all assigned proxy IDs from other active subscriptions
        const { data: allActiveSubs } = await supabaseAdmin
          .from("subscriptions")
          .select("raw_data")
          .eq("type", "proxyfbflix")
          .in("status", ["active", "expiring"])
          .neq("id", subscription_id);

        const assignedIds = new Set<string>();
        const assignedIPs = new Set<string>();
        for (const s of (allActiveSubs || [])) {
          const r = (s.raw_data || {}) as Record<string, any>;
          if (r.fbflix_proxy_id) assignedIds.add(r.fbflix_proxy_id);
          if (r.proxy_address) assignedIPs.add(r.proxy_address);
        }

        // Find unassigned proxy matching country
        const poolCandidates = allProxies.filter(
          (p: any) => p.valid && !assignedIds.has(p.id) && !assignedIPs.has(p.proxy_address)
            && (!targetCountry || String(p.country_code).toUpperCase() === targetCountry),
        );

        if (poolCandidates.length === 0) {
          throw new Error(`Proxy removido pela Webshare e sem proxies ${targetCountry || ''} disponíveis para realocar. Contate o suporte.`);
        }

        const newProxy = poolCandidates[0];
        const reallocatedRaw = buildStaticWebshareRawData(newProxy, raw) as Record<string, any>;

        const { error: updateErr } = await supabaseAdmin
          .from("subscriptions")
          .update({ raw_data: reallocatedRaw, updated_at: new Date().toISOString() })
          .eq("id", subscription_id);

        if (updateErr) throw new Error(`Erro ao realocar proxy: ${updateErr.message}`);

        console.log(`[sync-webshare-proxy-credentials] sub=${subscription_id} REALLOCATED from ${proxyAddress} to ${newProxy.proxy_address}`);

        return new Response(JSON.stringify({
          success: true,
          synced: true,
          reallocated: true,
          changed_fields: ["proxy_address", "port", "username", "password", "fbflix_proxy_id"],
          proxy: {
            id: newProxy.id,
            ip: newProxy.proxy_address,
            port: newProxy.port,
            username: newProxy.username,
            password: newProxy.password,
            country_code: newProxy.country_code,
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updatedRaw = buildStaticWebshareRawData(providerProxy, raw) as Record<string, any>;
      const fieldsToCompare = ["proxy_address", "port", "username", "password", "country_code", "city_name"] as const;
      const changedFields = fieldsToCompare.filter((field) => String(updatedRaw[field] ?? "") !== String(raw[field] ?? ""));

      if (changedFields.length > 0) {
        const { error: updateErr } = await supabaseAdmin
          .from("subscriptions")
          .update({ raw_data: updatedRaw, updated_at: new Date().toISOString() })
          .eq("id", subscription_id);

        if (updateErr) throw new Error(`Erro ao atualizar assinatura: ${updateErr.message}`);
      }

      console.log(`[sync-webshare-proxy-credentials] sub=${subscription_id} changed=${changedFields.join(",") || "none"}`);

      return new Response(JSON.stringify({
        success: true,
        synced: changedFields.length > 0,
        changed_fields: changedFields,
        proxy: {
          id: providerProxy.id,
          ip: providerProxy.proxy_address,
          port: providerProxy.port,
          username: providerProxy.username,
          password: providerProxy.password,
          country_code: providerProxy.country_code,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECTION: EXCHANGE WEBSHARE PROXY
    if (action === "exchange-webshare-proxy" || action === "exchange-proxyfbflix-proxy" || action === "fix-repeated-proxy") {
      const { subscription_id, target_country: overrideCountry, is_fix = false, proxy_id } = params as { 
        subscription_id: string; 
        target_country?: string;
        is_fix?: boolean;
        proxy_id?: string | number;
      };
      
      const isFixAction = action === "fix-repeated-proxy" || is_fix;
      if (!subscription_id) throw new Error("subscription_id é obrigatório");

      // 1. Get subscription.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subscription_id);
      let subQuery = supabaseAdmin
        .from("subscriptions")
        .select("*")
        .in("type", ["proxyfbflix", "proxyfbflix_rotating", "webshare", "webshare_rotating"])
        .limit(1);
      subQuery = isUuid ? subQuery.eq("id", subscription_id) : subQuery.eq("name", subscription_id);
      const { data: subRows, error: subErr } = await subQuery;
      const subRow = subRows?.[0];

      if (subErr || !subRow) {
        console.error(`[webshare-exchange] Subscription not found for ${subscription_id}`);
        throw new Error("Assinatura não encontrada");
      }
      if (!isServiceRole && subRow.user_id !== user?.id) {
        const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _user_id: user?.id });
        if (!isStaff) throw new Error("Sem permissão");
      }

      const raw = (subRow.raw_data || {}) as Record<string, any>;
      const freeLeft = Number(raw.exchange_quota_free ?? 0);
      const payLeft = Number(raw.exchange_quota_pay ?? 0);
      
      if (isFixAction) {
        if (raw.fix_repeated_done) throw new Error("Troca de correção já foi utilizada para este proxy.");
      } else {
        if (freeLeft + payLeft <= 0) throw new Error("Sem cotas de troca disponíveis");
      }

      // Identify which proxy to replace
      let targetProxyId = proxy_id || raw.fbflix_proxy_id || raw.webshare_proxy_id;
      let targetProxyAddress = raw.proxy_address;
      
      const proxiesData = raw.proxies?.data || [];
      if (proxy_id && Array.isArray(proxiesData)) {
        const found = proxiesData.find((p: any) => String(p.id) === String(proxy_id));
        if (found) {
          targetProxyAddress = found.proxy_address || found.ip || found.code?.split(':')[0];
          targetProxyId = found.id;
        }
      }

      let targetCountry = overrideCountry ? overrideCountry.toUpperCase() : (raw.country_code ? String(raw.country_code).toUpperCase() : null);
      if (!targetCountry && subRow.product_id) {
        const { data: prodData } = await supabaseAdmin.from("products").select("name, tags").eq("id", subRow.product_id).maybeSingle();
        if (prodData) targetCountry = detectCountryFromProduct(prodData);
      }
      
      const oldProxyStr = `${targetProxyAddress || "???"}`;
      let newProxyData: Record<string, any> | null = null;
      let method = "api";

      // Try 1: Webshare API replace
      if (targetProxyId && targetProxyAddress) {
        try {
          const replacePayload = {
            to_replace: { type: "ip_address", ip_addresses: [targetProxyAddress], count: 1 },
            replace_with: [targetCountry ? { type: "country", country_code: targetCountry, count: 1 } : { type: "any", count: 1 }],
            dry_run: false,
          };

          const replaceResp = await webFetch("https://proxy.webshare.io/api/v3/proxy/replace/", WEBSHARE_API_KEY, "POST", JSON.stringify(replacePayload));
          const replaceData = await replaceResp.json().catch(() => ({}));

          if (replaceResp.ok) {
            let replacementState = replaceData?.state;
            if (replaceData?.id) {
              for (let attempt = 0; attempt < 10; attempt++) {
                if (replacementState === "completed" || replacementState === "failed") break;
                await new Promise((r) => setTimeout(r, 1500));
                const statusResp = await webFetch(`https://proxy.webshare.io/api/v3/proxy/replace/${replaceData.id}/`, WEBSHARE_API_KEY);
                const statusData = await statusResp.json().catch(() => ({}));
                if (!statusResp.ok) break;
                replacementState = statusData?.state;
              }
            }

            if (replacementState === "completed") {
              const allCurrentProxies: any[] = [];
              let pg = 1;
              while (true) {
                const listResp = await webFetch(`/proxy/list/?mode=direct&page=${pg}&page_size=250`, WEBSHARE_API_KEY);
                const listData = await listResp.json().catch(() => ({}));
                if (!listResp.ok || !listData.results?.length) break;
                allCurrentProxies.push(...listData.results);
                if (!listData.next) break;
                pg++;
              }

              const { assignedIds, assignedIPs, userIPs } = await getAssignedProxyIds(supabaseAdmin, subRow.user_id);
              
              // In this specific sub, we MUST exclude all other IPs we have
              const myOtherIPs = new Set<string>();
              if (Array.isArray(proxiesData)) {
                proxiesData.forEach((p: any) => {
                  if (String(p.id) !== String(targetProxyId)) {
                    myOtherIPs.add(String(p.proxy_address || p.ip || ""));
                  }
                });
              }

              const candidates = allCurrentProxies.filter(
                (p: any) => {
                  const isAssigned = assignedIds.has(String(p.id)) || assignedIPs.has(String(p.proxy_address));
                  const isPreviouslyUsed = userIPs.has(String(p.proxy_address)) || (raw.used_ips && raw.used_ips.includes(p.proxy_address));
                  
                  return p.valid && !isAssigned && !isPreviouslyUsed
                    && !myOtherIPs.has(String(p.proxy_address))
                    && String(p.id) !== String(targetProxyId) && p.proxy_address !== targetProxyAddress
                    && (!targetCountry || String(p.country_code).toUpperCase() === targetCountry);
                }
              );

              if (candidates.length > 0) {
                const np = candidates[0];
                newProxyData = {
                  fbflix_proxy_id: np.id, webshare_proxy_id: np.id, proxy_address: np.proxy_address,
                  port: np.port, username: np.username, password: np.password,
                  country_code: np.country_code, city_name: np.city_name,
                };
              }
            }
          }
        } catch (e: any) { console.warn(`[webshare-exchange] API replace error: ${e.message}`); }
      }

      // Pool fallback
      if (!newProxyData) {
        try {
          const allCurrentProxies: any[] = [];
          let pg = 1;
          while (true) {
            const listResp = await webFetch(`/proxy/list/?mode=direct&page=${pg}&page_size=250`, WEBSHARE_API_KEY);
            const listData = await listResp.json().catch(() => ({}));
            if (!listResp.ok || !listData.results?.length) break;
            allCurrentProxies.push(...listData.results);
            if (!listData.next) break;
            pg++;
          }

          const { assignedIds, assignedIPs, userIPs } = await getAssignedProxyIds(supabaseAdmin, subRow.user_id);
          const myOtherIPs = new Set<string>();
          if (Array.isArray(proxiesData)) {
            proxiesData.forEach((p: any) => {
              if (String(p.id) !== String(targetProxyId)) {
                myOtherIPs.add(String(p.proxy_address || p.ip || ""));
              }
            });
          }

          const poolCandidates = allCurrentProxies.filter(
            (p: any) => {
              const isAssigned = assignedIds.has(String(p.id)) || assignedIPs.has(String(p.proxy_address));
              const isPreviouslyUsed = userIPs.has(String(p.proxy_address)) || (raw.used_ips && raw.used_ips.includes(p.proxy_address));

              return p.valid && !isAssigned && !isPreviouslyUsed
                && !myOtherIPs.has(String(p.proxy_address))
                && String(p.id) !== String(targetProxyId) && String(p.proxy_address) !== String(targetProxyAddress)
                && (!targetCountry || String(p.country_code).toUpperCase() === targetCountry);
            }
          );

          if (poolCandidates.length > 0) {
            const np = poolCandidates[0];
            newProxyData = {
              fbflix_proxy_id: np.id, webshare_proxy_id: np.id, proxy_address: np.proxy_address,
              port: np.port, username: np.username, password: np.password,
              country_code: np.country_code, city_name: np.city_name,
            };
            method = "pool";
          }
        } catch (e: any) { console.warn(`[webshare-exchange] Pool fallback error: ${e.message}`); }
      }

      if (!newProxyData) throw new Error("Não foi possível trocar o proxy. Sem disponibilidade.");

      // 3. Update subscription raw_data
      const prevExchangeCount = raw.exchange_count ? Number(raw.exchange_count) : 0;
      let nextFree = freeLeft;
      let nextPay = payLeft;
      if (!isFixAction) {
        if (freeLeft > 0) nextFree = freeLeft - 1; else nextPay = payLeft - 1;
      }

      // Update proxies.data array if it exists
      let updatedProxiesData = proxiesData;
      if (Array.isArray(proxiesData) && proxiesData.length > 0) {
        const newProxyCode = `${newProxyData.proxy_address}:${newProxyData.port}:${newProxyData.username}:${newProxyData.password}`;
        updatedProxiesData = proxiesData.map((p: any) => {
          if (String(p.id) === String(targetProxyId)) {
            return {
              ...p, id: newProxyData.fbflix_proxy_id, code: newProxyCode,
              proxy_address: newProxyData.proxy_address, ip: newProxyData.proxy_address,
              port: newProxyData.port, username: newProxyData.username, password: newProxyData.password,
              parsed: { ip: newProxyData.proxy_address, port: String(newProxyData.port), username: newProxyData.username, password: newProxyData.password }
            };
          }
          return p;
        });
      }

      const updatedRaw = {
        ...raw,
        ...newProxyData,
        proxies: { ...raw.proxies, data: updatedProxiesData, total: updatedProxiesData.length },
        used_ips: [...(raw.used_ips || []), oldProxyStr],
        exchange_quota_free: nextFree,
        exchange_quota_pay: nextPay,
        exchange_count: prevExchangeCount + 1,
        last_exchange: new Date().toISOString(),
        last_exchange_method: method,
        fix_repeated_done: isFixAction ? true : (raw.fix_repeated_done || false),
      };

      const { error: updateErr } = await supabaseAdmin
        .from("subscriptions").update({ raw_data: updatedRaw, updated_at: new Date().toISOString() }).eq("id", subRow.id);

      if (updateErr) throw new Error(`Erro ao atualizar: ${updateErr.message}`);

      return new Response(JSON.stringify({
        success: true, method, old_proxy: oldProxyStr,
        new_proxy: `${newProxyData.proxy_address}:${newProxyData.port}`,
        exchange_quota_free: nextFree, exchange_quota_pay: nextPay,
        proxy: { ip: newProxyData.proxy_address, port: newProxyData.port, username: newProxyData.username, password: newProxyData.password },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // SECTION: ADMIN: MAINTENANCE EXCHANGE (no quota deduction)
    if (action === "admin-maintenance-exchange") {
      const { subscription_id: maintSubId, target_city: maintTargetCity } = params as { subscription_id: string; target_city?: string };
      if (!maintSubId) throw new Error("subscription_id é obrigatório");

      // Allow maintenance exchange for service role or if authorized
      if (!isServiceRole) {
        const { data: isAdminMaint } = await supabaseAdmin.rpc("has_role", { _user_id: user?.id, _role: "admin" });
        if (!isAdminMaint) throw new Error("Acesso negado: apenas administradores");
      }

      // Admin maintenance exchange: UUID check
      const isMaintUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(maintSubId);
      let maintQuery = supabaseAdmin
        .from("subscriptions")
        .select("*")
        .in("type", ["proxyfbflix", "proxyfbflix_rotating", "webshare", "webshare_rotating", "proxybr"]);
      
      if (isMaintUuid) {
        maintQuery = maintQuery.eq("id", maintSubId);
      } else {
        maintQuery = maintQuery.eq("name", maintSubId);
      }
      
      const { data: maintSubRows, error: maintSubErr } = await maintQuery.limit(1);
      const maintSub = maintSubRows?.[0];

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

      // The city chosen by the admin must decide the country, not the subscription's
      // original product. Without this, choosing a US city (e.g. Los Angeles) on a
      // BR-tagged subscription always failed with "no availability", even with US
      // proxies in stock, because the search combined BR country + US city.
      if (maintTargetCity) {
        const BR_CITY_HINTS = [
          "sao paulo", "sao paolo", "rio de janeiro", "fortaleza", "diadema",
          "brasilia", "curitiba", "salvador", "recife", "belo horizonte",
        ];
        const normalizedMaintCity = maintTargetCity.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const cityCountry = BR_CITY_HINTS.includes(normalizedMaintCity) ? "BR" : "US";
        if (cityCountry !== maintCountry) {
          console.log(`[admin-maint-exchange] Overriding country ${maintCountry} -> ${cityCountry} based on chosen city "${maintTargetCity}"`);
        }
        maintCountry = cityCountry;
      }

      console.log(`[admin-maint-exchange] Detected country: ${maintCountry} for sub ${maintSubId}`);

      const maintCurrentProxyId = maintRaw.fbflix_proxy_id || maintRaw.webshare_proxy_id;
      const maintOldProxy = `${maintRaw.proxy_address || ""}:${maintRaw.port || ""}`;
      let maintNewProxy: Record<string, any> | null = null;
      let maintMethod = "api";

      // Try API replace first
      if (maintCurrentProxyId && maintRaw.proxy_address) {
        try {
          // Prepare replace_with block
          let replaceWith: any;
          if (maintTargetCity) {
            replaceWith = { type: "city", city_name: maintTargetCity, count: 1 };
          } else if (maintCountry) {
            replaceWith = { type: "country", country_code: maintCountry, count: 1 };
          } else {
            replaceWith = { type: "any", count: 1 };
          }

          const replacePayload = {
            to_replace: { type: "ip_address", ip_addresses: [maintRaw.proxy_address], count: 1 },
            replace_with: [replaceWith],
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
                .eq("type", "proxyfbflix")
                .in("status", ["active", "expiring"])
                .neq("id", maintSubId);

              const otherIds = new Set<string>();
              for (const s of (allActiveSubs || [])) {
                const r = (s.raw_data || {}) as Record<string, any>;
                if (r.fbflix_proxy_id) otherIds.add(r.fbflix_proxy_id);
              }

              const candidates = allCurrentProxies.filter((p: any) => {
                const sameId = p.id === maintCurrentProxyId;
                const sameIp = p.proxy_address === maintRaw.proxy_address;
                const countryMatch = !maintCountry || String(p.country_code).toUpperCase() === maintCountry;
                const cityMatch = !maintTargetCity || String(p.city_name).toLowerCase().includes(maintTargetCity.toLowerCase());
                return p.valid && !otherIds.has(p.id) && !sameId && !sameIp && countryMatch && cityMatch;
              });

              if (candidates.length > 0) {
                const np = candidates[0];
                maintNewProxy = {
                  fbflix_proxy_id: np.id, proxy_address: np.proxy_address,
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
            .eq("type", "proxyfbflix")
            .in("status", ["active", "expiring"])
            .neq("id", maintSubId);

          const assignedIds = new Set<string>();
          for (const s of (allActiveSubs || [])) {
            const r = (s.raw_data || {}) as Record<string, any>;
            if (r.fbflix_proxy_id) assignedIds.add(r.fbflix_proxy_id);
          }

          const poolCandidates = allCurrentProxies.filter((p: any) => {
            const sameId = p.id === maintCurrentProxyId;
            const countryMatch = !maintCountry || String(p.country_code).toUpperCase() === maintCountry;
            const cityMatch = !maintTargetCity || String(p.city_name).toLowerCase().includes(maintTargetCity.toLowerCase());
            return p.valid && !assignedIds.has(p.id) && !sameId && countryMatch && cityMatch;
          });

          if (poolCandidates.length > 0) {
            const np = poolCandidates[0];
            maintNewProxy = {
              fbflix_proxy_id: np.id, proxy_address: np.proxy_address,
              port: np.port, username: np.username, password: np.password,
              country_code: np.country_code, city_name: np.city_name,
            };
            maintMethod = "pool";
          }
        } catch (e: any) {
          console.warn(`[admin-maint-exchange] Pool fallback error: ${e.message}`);
        }
      }

      if (!maintNewProxy) {
        // If specific city requested but not found, collect available cities
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
            .eq("type", "proxyfbflix")
            .in("status", ["active", "expiring"]);

          const assignedIds = new Set<string>();
          for (const s of (allActiveSubs || [])) {
            const r = (s.raw_data || {}) as Record<string, any>;
            if (r.fbflix_proxy_id) assignedIds.add(r.fbflix_proxy_id);
          }

          // Only list cities that actually match the requested country, so the
          // error message never shows e.g. Brazilian cities when the admin asked
          // for a US city (or vice-versa) — that was the source of confusing
          // messages like "no availability in Los Angeles" while Los Angeles was
          // itself listed as "available" (it was available in the WRONG country bucket).
          const availableCities = new Set<string>();
          allCurrentProxies.forEach(p => {
            const countryMatch = !maintCountry || String(p.country_code).toUpperCase() === maintCountry;
            if (p.valid && !assignedIds.has(p.id) && p.city_name && countryMatch) {
              availableCities.add(p.city_name);
            }
          });

          const cityList = Array.from(availableCities).sort().join(", ");
          const countrySuffix = maintCountry ? ` (país ${maintCountry})` : "";
          if (maintTargetCity) {
            throw new Error(`Sem disponibilidade em ${maintTargetCity}${countrySuffix}. Cidades disponíveis${countrySuffix}: ${cityList || "Nenhuma"}`);
          } else {
            throw new Error(`Não foi possível trocar o proxy. Sem disponibilidade geral${countrySuffix}. Cidades com estoque${countrySuffix}: ${cityList || "Nenhuma"}`);
          }
        } catch (e: any) {
          if (e.message.includes("disponibilidade")) throw e;
          throw new Error("Não foi possível trocar o proxy. Sem disponibilidade.");
        }
      }

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
            if (i === 0 || String(p.id) === String(maintRaw.fbflix_proxy_id)) {
              return { ...p, code: newProxyCode, parsed: newProxyParsed, status: "USED" };
            }
            return p;
          })
        : [{ id: maintNewProxy.fbflix_proxy_id, code: newProxyCode, parsed: newProxyParsed, status: "USED", notes: null }];

      const updatedMaintRaw = {
        ...maintRaw,
        ...maintNewProxy,
        provider: "proxyfbflix",
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

    // SECTION: ADMIN: UPDATE SUBSCRIPTION RAW_DATA
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

    // SECTION: GET ROTATING PROXY CREDENTIALS
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

      // Get bandwidth limits from the residential plan specifically
      const plansResp = await webFetch("/subscription/plan/", WEBSHARE_API_KEY);
      const plansData = await plansResp.json();
      const residentialPlan = (plansData.results || []).find((p: any) => p.status === "active" && (p.proxy_subtype === "residential" || p.bandwidth_limit > 0));

      let bandwidthLimit = 0;
      let aggregateUsed = 0;

      if (residentialPlan) {
        // bandwidth_limit is in GB from the plan object
        bandwidthLimit = (residentialPlan.bandwidth_limit || 0) * 1024 * 1024 * 1024;
        
        // Fetch stats filtered by this plan_id for accurate usage
        try {
          const aggResp = await webFetch(
            `/stats/aggregate/?plan_id=${residentialPlan.id}`,
            WEBSHARE_API_KEY
          );
          if (aggResp.ok) {
            const aggData = await aggResp.json();
            aggregateUsed = aggData.bandwidth_total || 0;
            
            // Fallback to account-wide if 0
            if (aggregateUsed === 0) {
              const accAggResp = await webFetch(`/stats/aggregate/`, WEBSHARE_API_KEY);
              if (accAggResp.ok) {
                const accAggData = await accAggResp.json();
                aggregateUsed = accAggData.bandwidth_total || 0;
              }
            }
            console.log(`[get-rotating-credentials] Residential plan ${residentialPlan.id} bandwidth: ${aggregateUsed} bytes`);
          }
        } catch (e) {
          console.warn("[get-rotating-credentials] Failed to fetch plan stats:", e);
        }
      } else {
        // Fallback to subscription endpoint
        const subResp = await webFetch("/subscription/", WEBSHARE_API_KEY);
        const subData = await subResp.json();
        bandwidthLimit = subData.bandwidth_limit_backbone > 0
          ? subData.bandwidth_limit_backbone
          : (subData.bandwidth_limit || 0);
        aggregateUsed = subData.bandwidth_used_backbone ?? subData.bandwidth_used ?? 0;
      }

      console.log(`[get-rotating-credentials] Bandwidth: used=${aggregateUsed}, limit=${bandwidthLimit}`);

      // Resolve converted host
      let convertedHost: string | null = null;
      try {
        const dnsResp = await fetch("https://dns.google/resolve?name=p.webshare.io&type=A");
        const dnsData = await dnsResp.json();
        const answers = Array.isArray(dnsData?.Answer) ? dnsData.Answer : [];
        convertedHost = answers.find((a: any) => a?.type === 1 && /^\d+\.\d+\.\d+\.\d+$/.test(a?.data || ""))?.data ?? null;
      } catch {}

      return new Response(JSON.stringify({
        proxy_host: "p.webshare.io",
        converted_host: convertedHost,
        http_port: 80,
        alt_http_port: 3128,
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

    // SECTION: PURCHASE ROTATING PROXY (balance)
     if (action === "purchase-rotating-proxy") {
       const { order_id, total, product_id, quantity: gbQty, target_city } = params as {
         order_id: string; total: number; product_id?: string; quantity?: number; target_city?: string;
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
         rotatingUsername = buildRotatingUsername(bbProxy.username || bbProxy.proxy_username || "", countryCode, target_city);
         rotatingPassword = bbProxy.password || "";
       }

       if (!rotatingUsername) {
         const configResp = await webFetch("/proxy/config/", WEBSHARE_API_KEY);
         const configData = await configResp.json();
         if (!configResp.ok) throw new Error(`Webshare config error [${configResp.status}]`);
         rotatingUsername = buildRotatingUsername(configData.username || configData.proxy_username || "", countryCode, target_city);
         rotatingPassword = rotatingPassword || configData.password || configData.proxy_password || "";
       }

      if (!rotatingUsername) {
        throw new Error("Não foi possível gerar o usuário rotativo do Webshare");
      }

      // 3. Resolve converted host (IP) for tools that don't support domain
      let convertedHost: string | null = null;
      try {
        const dnsResp = await fetch("https://dns.google/resolve?name=p.webshare.io&type=A");
        const dnsData = await dnsResp.json();
        const answers = Array.isArray(dnsData?.Answer) ? dnsData.Answer : [];
        convertedHost = answers.find((a: any) => a?.type === 1 && /^\d+\.\d+\.\d+\.\d+$/.test(a?.data || ""))?.data ?? null;
      } catch {}

      // 4. Create subscription
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
          provider: "proxyfbflix",
          proxy_type: "rotating_residential",
          proxy_host: "p.webshare.io",
          converted_host: convertedHost,
          http_port: 80,
          alt_http_port: 3128,
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

    // SECTION: GET INTERNAL PROXY CONFIG
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

      // 3. Fetch bandwidth — find the residential plan and use plan_id for accurate stats
      let bandwidth: Record<string, any> = {};
      try {
        // List all plans to find the residential (rotating) one
        const plansResp = await webFetch("/subscription/plan/", WEBSHARE_API_KEY);
        const plansData = await plansResp.json();
        const plans = (plansData.results || []).filter((p: any) => p.status === "active");

        // Find the residential (rotating) plan specifically for internal proxy
        const activePlan = plans.find((p: any) => p.proxy_subtype === "residential")
          || plans.find((p: any) => p.bandwidth_limit > 0);
        
        let limitBytes = 0;
        let usedBytes = 0;
        let todayBytes = 0;

        if (activePlan) {
          // bandwidth_limit is in GB from the plan
          const limitGB = activePlan.bandwidth_limit || 0;
          limitBytes = limitGB * 1024 * 1024 * 1024;
          console.log(`[get-internal-proxy-config] Found active plan ${activePlan.id} (${activePlan.proxy_subtype}), limit: ${limitGB} GB`);

          // Fetch aggregate stats filtered by this specific plan_id
          try {
          const aggResp = await webFetch(`/stats/aggregate/?plan_id=${activePlan.id}`, WEBSHARE_API_KEY);
          const aggData = await aggResp.json();
          if (aggResp.ok && aggData.bandwidth_total !== undefined) {
            usedBytes = aggData.bandwidth_total || 0;
          }
          
          // Fallback to account-wide if 0
          if (usedBytes === 0) {
            const accAggResp = await webFetch(`/stats/aggregate/`, WEBSHARE_API_KEY);
            if (accAggResp.ok) {
              const accAggData = await accAggResp.json();
              usedBytes = accAggData.bandwidth_total || 0;
              console.log(`[get-internal-proxy-config] Fallback to account-wide stats: ${usedBytes}`);
            } else {
              console.warn(`[get-internal-proxy-config] Account-wide stats fetch failed: ${accAggResp.status}`);
            }
          }
          
          } catch (e: any) {
            console.warn(`[get-internal-proxy-config] plan stats error:`, e.message);
          }
        }

        // Fetch today's usage (always using account-wide fallback if needed)
        try {
          const now = new Date();
          // Use UTC for dates
          const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
          const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59)).toISOString();
          
          const planFilter = activePlan ? `&plan_id=${activePlan.id}` : "";
          const todayResp = await webFetch(`/stats/aggregate/?timestamp__gte=${todayStart}&timestamp__lte=${todayEnd}${planFilter}`, WEBSHARE_API_KEY);
          const todayData = await todayResp.json();
          if (todayResp.ok && todayData.bandwidth_total !== undefined) {
            todayBytes = todayData.bandwidth_total || 0;
          }
          
          // Fallback to account-wide if 0 and planFilter was used
          if (todayBytes === 0 && planFilter) {
            const accTodayResp = await webFetch(`/stats/aggregate/?timestamp__gte=${todayStart}&timestamp__lte=${todayEnd}`, WEBSHARE_API_KEY);
            if (accTodayResp.ok) {
              const accTodayData = await accTodayResp.json();
              todayBytes = accTodayData.bandwidth_total || 0;
              console.log(`[get-internal-proxy-config] Fallback to account-wide today stats: ${todayBytes}`);
            }
          }
          
        } catch (e: any) {
          console.warn(`[get-internal-proxy-config] today stats error:`, e.message);
        }

        console.log(`[get-internal-proxy-config] bandwidth: used=${usedBytes}, limit=${limitBytes}, today=${todayBytes}`);

        bandwidth = {
          used_bytes: usedBytes,
          limit_bytes: limitBytes,
          today_bytes: todayBytes,
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

    // SECTION: SAVE INTERNAL PROXY CONFIG
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

    // SECTION: MIGRATE PROXYBR RENEWAL -> WEBSHARE
    if (action === "migrate-proxybr-renewal") {
      const { subscription_name, proxy_index, total_proxies, auto_renew_user_id, skip_whatsapp } = params as {
        subscription_name: string;
        proxy_index?: number;
        total_proxies?: number;
        auto_renew_user_id?: string;
        skip_whatsapp?: boolean;
      };
      if (!subscription_name) throw new Error("subscription_name é obrigatório");

      const targetUserId = auto_renew_user_id || user?.id;
      if (!targetUserId) throw new Error("Usuário não identificado");

      // 1. Find the subscription in DB (search proxybr first, then webshare)
      let existingSub: any = null;
      {
        // Try proxybr first (original flow)
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
          // Try webshare type for the same user
          const { data: wsSub } = await supabaseAdmin
            .from("subscriptions")
            .select("*, products:product_id(name, price, tags)")
            .eq("user_id", targetUserId)
            .eq("name", subscription_name)
            .in("type", ["webshare", "webshare_rotating", "proxyfbflix", "proxyfbflix_rotating"])
            .maybeSingle();
          
          if (wsSub) {
            existingSub = wsSub;
          } else {
            // Fallback: search across all users
            const { data: anySub } = await supabaseAdmin
              .from("subscriptions")
              .select("*, products:product_id(name, price, tags)")
              .eq("name", subscription_name)
            .in("type", ["proxybr", "webshare", "webshare_rotating", "proxyfbflix", "proxyfbflix_rotating"])
              .limit(1)
              .maybeSingle();
            existingSub = anySub;
          }
        }
      }
      if (!existingSub) throw new Error("Assinatura não encontrada");

      const isExistingWebshareRenewal = ["webshare", "webshare_rotating", "proxyfbflix", "proxyfbflix_rotating"].includes(existingSub.type);

      // For single-proxy subs or non-exploded, check if still active
      // Allow renewal when ≤3 days remaining (status "expiring" in frontend)
      const isMultiProxy = (total_proxies || 0) > 1;
      if (!isMultiProxy) {
        if (!["expired", "cancelled"].includes(existingSub.status) && existingSub.end_date) {
          const endDate = new Date(existingSub.end_date);
          const now = new Date();
          const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysRemaining > 3) throw new Error("Esta assinatura ainda está ativa. Renovação disponível nos últimos 3 dias.");
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

      // 3. Determine renewal price (priority order):
      //    a) Admin-locked override on the subscription (raw_data.renewal_price)
      //    b) The product currently linked to the subscription
      //    c) Product matched by raw_data.product_name (original product at sale time)
      //    d) A safe per-country dedicated proxy default (NEVER the rotating R$50 SKU)
      const { data: wsProducts } = await supabaseAdmin
        .from("products")
        .select("id, name, price, tags")
        .eq("available", true)
        .ilike("name", "%proxy%");

      const isRotatingSub = existingSub.type === "webshare_rotating" || existingSub.type === "proxyfbflix_rotating";
      const isRotatingProduct = (p: any) => {
        const n = (p?.name || "").toLowerCase();
        const tags = ((p?.tags || []) as string[]).map((t) => t.toLowerCase());
        return n.includes("rotativ") || n.includes("rotating") || tags.some((t) => t === "rotativo" || t === "rotating");
      };

      // (c) Try to recover the original product by stored name
      const originalProductName: string = (raw.product_name || raw.original_product_name || raw.product?.name || "").toString();
      let matchedProduct: any = null;
      if (originalProductName) {
        matchedProduct = (wsProducts || []).find((p: any) =>
          p.name.toLowerCase().trim() === originalProductName.toLowerCase().trim() &&
          (isRotatingSub ? isRotatingProduct(p) : !isRotatingProduct(p))
        );
      }

      // (c2) Recover the price actually paid on the original order for this subscription.
      let originalOrderPrice: number | null = null;
      if (!matchedProduct) {
        const orderId = raw.order_id || raw.originating_order_id || null;
        if (orderId) {
          const { data: oi } = await supabaseAdmin
            .from("order_items")
            .select("price")
            .eq("order_id", orderId)
            .limit(1)
            .maybeSingle();
          const p = Number((oi as any)?.price);
          if (Number.isFinite(p) && p > 0) originalOrderPrice = p;
        }
      }

      // Only fall back to a webshare-tagged product matching the country.
      // Name-based matching (e.g. "Residencial") is NOT used here because unrelated
      // SKUs like "Proxy Residencial Turbo" (R$40) were being picked by mistake.
      if (!matchedProduct && originalOrderPrice == null) {
        for (const p of (wsProducts || [])) {
          const pTags = ((p.tags || []) as string[]).map((t: string) => t.toLowerCase());
          const isWebshare = pTags.includes("webshare");
          if (!isWebshare) continue;
          if (isRotatingSub !== isRotatingProduct(p)) continue;
          const pCountry = detectCountryFromProduct(p);
          if (pCountry === targetCountry) { matchedProduct = p; break; }
        }
      }


      const lockedPrice = Number(raw.renewal_price ?? raw.original_full_price ?? NaN);
      const safeDefault = 21; // dedicated proxy standard price (BR/US)
      // Guard: never use the linked product's price when its rotating/dedicated
      // type does not match the subscription type (e.g. a dedicated sub mistakenly
      // pointing to the rotating R$50 SKU). Falls back to the correctly typed
      // matched product, or the safe default.
      const productInfoTypeMatches =
        productInfo && (isRotatingSub === isRotatingProduct(productInfo));
      const productInfoPrice = productInfoTypeMatches ? Number(productInfo?.price) : NaN;
      const renewalPrice = Number.isFinite(lockedPrice) && lockedPrice > 0
        ? lockedPrice
        : Number(
            (Number.isFinite(productInfoPrice) && productInfoPrice > 0 ? productInfoPrice : null)
            ?? originalOrderPrice
            ?? matchedProduct?.price
            ?? safeDefault
          );


      console.log(`[migrate-proxybr] Renewal price: R$${renewalPrice} (locked=${Number.isFinite(lockedPrice) ? lockedPrice : "no"} product=${matchedProduct?.name || "fallback"} isRotatingSub=${isRotatingSub})`);

      // 4. Check wallet balance
       const { data: profile } = await supabaseAdmin
         .from("profiles")
         .select("balance, full_name, phone")
         .eq("user_id", targetUserId)
         .single();

      if (!profile) throw new Error("Perfil não encontrado");
      if (profile.balance < renewalPrice) throw new Error(`Saldo insuficiente. Necessário: R$ ${renewalPrice.toFixed(2)}, disponível: R$ ${profile.balance.toFixed(2)}`);

      const startDate = new Date();
      // If renewing an active/expiring sub, extend from current end_date
      const currentEndDate = existingSub.end_date ? new Date(existingSub.end_date) : null;
      const isEarlyRenewal = currentEndDate && currentEndDate > startDate;
      const endDate = new Date(isEarlyRenewal ? currentEndDate : startDate);
      endDate.setDate(endDate.getDate() + 30);
      const nextProductId = isExistingWebshareRenewal
        ? existingSub.product_id
        : matchedProduct?.id || existingSub.product_id;

      let assignedProxy: any = null;
      let nextRawData: Record<string, any> = raw;
      let nextType = existingSub.type;

      if (isExistingWebshareRenewal) {
        nextRawData = {
          ...raw,
          renewed_at: new Date().toISOString(),
        };

        assignedProxy = existingSub.type === "webshare_rotating"
          ? {
              proxy_address: raw.proxy_host || raw.converted_host || "p.webshare.io",
              port: raw.http_port || raw.alt_http_port || 80,
              username: raw.username,
              password: raw.password,
              country_code: raw.country_code || targetCountry,
            }
          : {
              id: raw.fbflix_proxy_id,
              proxy_address: raw.proxy_address,
              port: raw.port,
              username: raw.username,
              password: raw.password,
              country_code: raw.country_code || targetCountry,
            };

        console.log(`[migrate-proxybr] Fast renewal for ${existingSub.type} ${subscription_name}`);
      } else {
        // Get assigned proxy IDs once, then scan Webshare pages until we find the first valid match.
        const { data: existSubs } = await supabaseAdmin
          .from("subscriptions").select("raw_data")
          .eq("type", "proxyfbflix").in("status", ["active", "expiring"]);

        const assignedIds = new Set<string>();
        for (const s of (existSubs || [])) {
          const r = (s.raw_data || {}) as Record<string, any>;
          if (r.fbflix_proxy_id) assignedIds.add(r.fbflix_proxy_id);
        }

        let foundProxy: any = null;
        let pg = 1;
        while (!foundProxy) {
          const resp = await webFetch(`/proxy/list/?mode=direct&page=${pg}&page_size=250`, WEBSHARE_API_KEY);
          const data = await resp.json();
          if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]`);

          foundProxy = (data.results || []).find((proxy: any) => (
            proxy.valid &&
            !assignedIds.has(proxy.id) &&
            proxy.country_code?.toUpperCase() === targetCountry
          ));

          if (foundProxy || !data.next) break;
          pg++;
        }

        if (!foundProxy) throw new Error(`Nenhum proxy ${targetCountry} disponível no momento`);

        assignedProxy = foundProxy;
        nextType = "webshare";
        nextRawData = {
          fbflix_proxy_id: assignedProxy.id,
          proxy_address: assignedProxy.proxy_address,
          port: assignedProxy.port,
          username: assignedProxy.username,
          password: assignedProxy.password,
          country_code: assignedProxy.country_code,
          city_name: assignedProxy.city_name,
          provider: "proxyfbflix",
          exchange_quota_free: 2,
          exchange_quota_pay: 0,
          migrated_from: existingSub.type === "proxybr" ? "proxybr" : undefined,
          original_name: existingSub.name,
          profile_tag: raw.profile_tag || null,
        };
      }

      // 6. For multi-proxy subs, CREATE a new row; for single-proxy, UPDATE the existing row
      if (isMultiProxy) {
        // Create a new Webshare subscription for this specific proxy
        const newSubName = `${subscription_name}#${proxy_index || 1}`;
        const { error: insertErr } = await supabaseAdmin
          .from("subscriptions")
          .insert({
            user_id: targetUserId,
            name: newSubName,
            type: nextType,
            status: "active",
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            auto_renew: existingSub.auto_renew,
            product_id: nextProductId,
            raw_data: { ...nextRawData, proxy_index: proxy_index },
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
            type: nextType,
            status: "active",
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            product_id: nextProductId,
            cancelled_at: null,
            updated_at: new Date().toISOString(),
            raw_data: isExistingWebshareRenewal
              ? nextRawData
              : { ...nextRawData, original_raw_data: raw },
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
        title: `Renovação Proxy FBFlix ${subscription_name}${isMultiProxy ? `#${proxy_index || 1}` : ''}`,
        amount: -renewalPrice,
        balance_after: newBalance,
        reference_id: existingSub.id,
      });

      // 9. Admin notification
      const clientName = profile.full_name || "Cliente";
      await supabaseAdmin.from("notifications").insert({
        title: "Renovação Proxy FBFlix",
        message: `${clientName} renovou ${subscription_name}${isMultiProxy ? `#${proxy_index || 1}` : ''} • R$ ${renewalPrice.toFixed(2)} • ${assignedProxy.proxy_address}:${assignedProxy.port} (${targetCountry})`,
        type: "order",
        global: true,
      });

      // 9b. Web push to admins (renewal = sale)
      try {
        const pushKey = Deno.env.get("PUSH_TRIGGER_KEY");
        if (pushKey) {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-admin-push`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-secret": pushKey,
            },
            body: JSON.stringify({
              title: `🔄 Renovação: Proxy ${subscription_name}${isMultiProxy ? `#${proxy_index || 1}` : ''}`,
              body: `R$ ${renewalPrice.toFixed(2)} • saldo em carteira • ${clientName}`,
              url: "/admin/assinaturas",
              tag: `renew-${existingSub.id}`,
            }),
          });
        }
      } catch (pushErr: any) {
        console.error(`[migrate-proxybr] push error: ${pushErr?.message}`);
      }

        // 10. WhatsApp confirmation to client (skipped on batch auto-renew: lifecycle sends a single summary)
        if (profile?.phone && !skip_whatsapp) {
         try {
           const { data: tpl } = await supabaseAdmin
             .from("whatsapp_templates")
             .select("id")
             .eq("event_key", "proxy_renewed")
             .eq("active", true)
             .maybeSingle();
 
           if (tpl) {
             const productName = productInfo?.name || raw.product?.name || raw.product_name || existingSub.name || "Proxy";
             const formattedExpDate = endDate.toLocaleDateString("pt-BR");
             
             await supabaseAdmin.functions.invoke("wapi-send", {
               body: {
                 action: "send-template",
                 template_id: tpl.id,
                 phone: profile.phone,
                 user_id: targetUserId,
                 variables: {
                   nome: profile.full_name || "Cliente",
                   produto: productName,
                   vencimento: formattedExpDate
                 }
               }
             });
             console.log(`[migrate-proxybr] WhatsApp notification sent to ${profile.phone}`);
           }
         } catch (waErr: any) {
           console.error(`[migrate-proxybr] WhatsApp notification error: ${waErr.message}`);
         }
       }
 
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

    // SECTION: BACKFILL ROTATING PROXY CREDENTIALS
    if (action === "backfill-rotating-credentials") {
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) throw new Error("Acesso negado: apenas administradores");

      // Resolve converted host
      let convertedHost: string | null = null;
      try {
        const dnsResp = await fetch("https://dns.google/resolve?name=p.webshare.io&type=A");
        const dnsData = await dnsResp.json();
        const answers = Array.isArray(dnsData?.Answer) ? dnsData.Answer : [];
        convertedHost = answers.find((a: any) => a?.type === 1 && /^\d+\.\d+\.\d+\.\d+$/.test(a?.data || ""))?.data ?? null;
      } catch {}

      // Find all rotating subs missing converted_host or alt_http_port
      const { data: rotatingSubs } = await supabaseAdmin
        .from("subscriptions")
        .select("id, raw_data")
        .eq("type", "webshare_rotating")
        .in("status", ["active", "expiring"]);

      let updated = 0;
      for (const sub of (rotatingSubs || [])) {
        const raw = (sub.raw_data || {}) as Record<string, any>;
        if (raw.converted_host && raw.alt_http_port) continue;

        const updatedRaw = {
          ...raw,
          converted_host: raw.converted_host || convertedHost,
          alt_http_port: raw.alt_http_port || 3128,
          socks5_port: raw.socks5_port || 1080,
        };

        await supabaseAdmin
          .from("subscriptions")
          .update({ raw_data: updatedRaw, updated_at: new Date().toISOString() })
          .eq("id", sub.id);
        updated++;
      }

      console.log(`[backfill-rotating] Updated ${updated} subscriptions with converted_host=${convertedHost}`);
      return new Response(JSON.stringify({ success: true, updated, converted_host: convertedHost }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECTION: INTERNAL: DELETE WEBSHARE PROXY
    if (action === "internal-delete-webshare-proxy") {
      const supabaseInternal = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { fbflix_proxy_id } = bodyClone;
      if (!fbflix_proxy_id) throw new Error("fbflix_proxy_id é obrigatório");

      // Delete the proxy from Webshare API
      const resp = await webFetch(`/proxy/list/${fbflix_proxy_id}/`, WEBSHARE_API_KEY, "DELETE");
      
      // 204 = success, 404 = already deleted
      if (resp.status !== 204 && resp.status !== 404) {
        const text = await resp.text();
        throw new Error(`Webshare delete error [${resp.status}]: ${text.slice(0, 200)}`);
      }

      console.log(`[internal-delete-proxy] Deleted Webshare proxy ${fbflix_proxy_id} (status=${resp.status})`);
      return new Response(JSON.stringify({ success: true, fbflix_proxy_id, status: resp.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECTION: SYNC PROXY CREDENTIALS FROM WEBSHARE
    if (action === "sync-proxyfbflix-proxy-credentials") {
      const { subscription_id: sSubId } = params as { subscription_id: string };
      if (!sSubId) throw new Error("subscription_id é obrigatório");

      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("id", sSubId)
        .single();

      if (!sub) throw new Error("Assinatura não encontrada");
      const raw = (sub.raw_data || {}) as Record<string, any>;
      const fbflixId = raw.fbflix_proxy_id || raw.webshare_proxy_id;
      if (!fbflixId) throw new Error("Este proxy não possui um ID de fornecedor vinculado");

      const syncFromList = async (reason: string) => {
        console.warn(`[sync-credentials] Falling back to full list search for proxy ${fbflixId}: ${reason}`);
        let allProxies: any[] = [];
        try {
          allProxies = await fetchAllWebshareProxies(WEBSHARE_API_KEY, "direct");
        } catch (e: any) {
          console.error(`[sync-credentials] fallback list fetch failed:`, e?.message);
          throw new Error(
            "Não foi possível sincronizar com o fornecedor agora (API instável). Tente novamente em alguns minutos.",
          );
        }
        const proxyAddress = raw.proxy_address ? String(raw.proxy_address) : "";
        
        const providerProxy = allProxies.find((proxy: any) => (
          String(proxy.id) === String(fbflixId) ||
          (proxyAddress && proxy.proxy_address === proxyAddress)
        ));

        if (!providerProxy) {
          // Proxy sumiu do fornecedor (IP reciclado/removido pela Webshare) mesmo com
          // a assinatura ainda dentro da validade — validade e existência física do IP
          // são coisas independentes. Em vez de falhar, realoca automaticamente do pool.
          console.warn(`[sync-credentials] Proxy ${fbflixId} not found on provider. Auto-reallocating...`);

          const targetCountry = raw.country_code ? String(raw.country_code).toUpperCase() : null;

          const { data: allActiveSubs } = await supabaseAdmin
            .from("subscriptions")
            .select("raw_data")
            .eq("type", "proxyfbflix")
            .in("status", ["active", "expiring"])
            .neq("id", sSubId);

          const assignedIds = new Set<string>();
          const assignedIPs = new Set<string>();
          for (const s of (allActiveSubs || [])) {
            const r = (s.raw_data || {}) as Record<string, any>;
            if (r.fbflix_proxy_id) assignedIds.add(String(r.fbflix_proxy_id));
            if (r.proxy_address) assignedIPs.add(String(r.proxy_address));
          }

          const poolCandidate = allProxies.find((p: any) => (
            p.valid && !assignedIds.has(String(p.id)) && !assignedIPs.has(String(p.proxy_address))
            && (!targetCountry || String(p.country_code).toUpperCase() === targetCountry)
          ));

          if (!poolCandidate) {
            throw new Error(`Proxy removido pelo fornecedor e sem proxies ${targetCountry || ''} disponíveis para realocar. Contate o suporte.`);
          }

          const reallocatedRaw = buildStaticWebshareRawData(poolCandidate, raw) as Record<string, any>;
          reallocatedRaw.last_sync_at = new Date().toISOString();

          const { error: reallocErr } = await supabaseAdmin
            .from("subscriptions")
            .update({ raw_data: reallocatedRaw, updated_at: new Date().toISOString() })
            .eq("id", sSubId);

          if (reallocErr) throw new Error(`Erro ao realocar proxy: ${reallocErr.message}`);

          console.log(`[sync-credentials] sub=${sSubId} REALLOCATED from ${proxyAddress} to ${poolCandidate.proxy_address}`);

          return new Response(JSON.stringify({
            success: true, synced: true, reallocated: true, method: "auto-reallocate",
            new_proxy: `${poolCandidate.proxy_address}:${poolCandidate.port}`,
            proxy: {
              ip: poolCandidate.proxy_address,
              port: poolCandidate.port,
              username: poolCandidate.username,
              password: poolCandidate.password,
              country_code: poolCandidate.country_code,
              city_name: poolCandidate.city_name,
            },
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const updatedRaw = buildStaticWebshareRawData(providerProxy, raw) as Record<string, any>;
        updatedRaw.last_sync_at = new Date().toISOString();

        const { error: updateErr } = await supabaseAdmin
          .from("subscriptions")
          .update({ raw_data: updatedRaw, updated_at: new Date().toISOString() })
          .eq("id", sSubId);

        if (updateErr) throw new Error(`Erro ao salvar sincronização (fallback): ${updateErr.message}`);

        return new Response(JSON.stringify({ success: true, synced: true, method: "list-search" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      };

      // Fetch current data from Webshare. The detail endpoint can intermittently return 5xx,
      // so keep sync usable by falling back to the paginated list endpoint.
      const resp = await webFetch(`/proxy/list/${fbflixId}/`, WEBSHARE_API_KEY, "GET", undefined, { throwOnServerError: false });
      
      // If the detail endpoint fails or the proxy is not found, try the full list search.
      if (resp.status === 404 || resp.status >= 500) {
        return await syncFromList(`detail endpoint returned ${resp.status}`);
      }

      const data = await resp.json();
      if (!resp.ok) throw new Error(`Erro na API Proxy Fbflix [${resp.status}]`);

      const updatedRaw = {
        ...raw,
        proxy_address: data.proxy_address,
        port: data.port,
        username: data.username,
        password: data.password,
        country_code: data.country_code,
        city_name: data.city_name,
        last_sync_at: new Date().toISOString(),
      };

      const { error: updErr } = await supabaseAdmin
        .from("subscriptions")
        .update({ raw_data: updatedRaw, updated_at: new Date().toISOString() })
        .eq("id", sSubId);

      if (updErr) throw new Error(`Erro ao salvar sincronização: ${updErr.message}`);

      console.log(`[sync-credentials] Synced proxy ${fbflixId} for sub ${sSubId}`);
      return new Response(JSON.stringify({ success: true, synced: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (err: any) {
    console.error("[webshare-api] Error:", err.message);
    let requestAction: string | undefined;
    try {
      requestAction = JSON.parse(bodyText || "{}").action;
    } catch {
      requestAction = undefined;
    }
    if (requestAction && SAFE_SUPPLIER_READ_ACTIONS.has(requestAction) && isSupplierOutageError(err)) {
      return new Response(
        JSON.stringify(providerOfflinePayload(err, { data: [], results: [], total: 0 })),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
