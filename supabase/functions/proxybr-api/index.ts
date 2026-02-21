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

async function fetchAllSubscriptions(apiKey: string) {
  // Try fetching with pagination - ProxyBR may return paginated or flat array
  let allSubs: any[] = [];
  let page = 1;
  const maxPages = 50; // safety limit

  while (page <= maxPages) {
    const url = `${PROXYBR_BASE}/subscriptions?page=${page}`;
    console.log(`Fetching subscriptions page ${page}: ${url}`);
    const response = await proxyFetch(url, apiKey);
    const text = await response.text();

    if (!response.ok) {
      console.error(`ProxyBR error [${response.status}]: ${text.substring(0, 300)}`);
      throw new Error(`ProxyBR API error [${response.status}]`);
    }

    let parsed: any;
    try { parsed = JSON.parse(text); } catch { throw new Error("Invalid JSON from ProxyBR"); }

    // API may return { data: [...], last_page: N } or just an array
    if (Array.isArray(parsed)) {
      allSubs = [...allSubs, ...parsed];
      break; // flat array = no pagination
    } else if (parsed?.data && Array.isArray(parsed.data)) {
      allSubs = [...allSubs, ...parsed.data];
      const lastPage = parsed.last_page || parsed.meta?.last_page || 1;
      if (page >= lastPage) break;
      page++;
    } else {
      // Unknown format, return as-is
      allSubs = [parsed];
      break;
    }
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
    if (!authHeader) throw new Error("Não autorizado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    const { action, ...params } = await req.json();

    // Handle the new get-all-subscriptions action
    if (action === "get-all-subscriptions") {
      const allSubs = await fetchAllSubscriptions(PROXYBR_API_KEY);
      return new Response(
        JSON.stringify(allSubs),
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

      case "contract-subscription":
        url = `${PROXYBR_BASE}/subscriptions/contract`;
        method = "POST";
        body = JSON.stringify({
          quantity: params.quantity,
          interval: params.interval,
          product_variant_id: params.product_variant_id,
          discount_coupon: params.discount_coupon || null,
        });
        break;

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
