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
      // First get subscription to find active plan ID
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
      const mode = params.mode || "direct"; // "direct" or "backbone"
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

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (err: any) {
    console.error("[webshare-api] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
