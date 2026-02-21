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
    console.log(`Fetching subscriptions page ${page}: ${url}. Total so far: ${allSubs.length}`);
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
      if (parsed.length > 0) {
        // Log first sub keys and customer field to understand structure
        const first = parsed[0];
        console.log(`First sub keys: ${Object.keys(first).join(', ')}`);
        if (first.customer) console.log(`Customer field: ${JSON.stringify(first.customer)}`);
        if (first.client) console.log(`Client field: ${JSON.stringify(first.client)}`);
      }
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

    // Handle the new get-all-subscriptions action
    if (action === "get-all-subscriptions") {
      const allSubs = await fetchAllSubscriptions(PROXYBR_API_KEY);
      return new Response(
        JSON.stringify(allSubs),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sync subscriptions to local DB with auto-linking by email
    if (action === "sync-subscriptions") {
      // Verify admin
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) throw new Error("Sem permissão de administrador");

      const allSubs = await fetchAllSubscriptions(PROXYBR_API_KEY);

      // Build email -> user_id map from auth.users
      const emailToUserId = new Map<string, string>();
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (error || !users?.length) break;
        for (const u of users) {
          if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id);
        }
        if (users.length < perPage) break;
        page++;
      }

      // Also build name -> user_id map from profiles as fallback
      const nameToUserId = new Map<string, string>();
      const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, full_name");
      if (profiles) {
        for (const p of profiles) {
          if (p.full_name) nameToUserId.set(p.full_name.toLowerCase().trim(), p.user_id);
        }
      }

      console.log(`Loaded ${emailToUserId.size} emails and ${nameToUserId.size} profile names for matching`);

      let synced = 0;
      let linked = 0;

      for (const sub of allSubs) {
      const code = sub.code;
        if (!code) continue;

        // Use notes field as primary identification (API doesn't return customer/client objects)
        const notes = (sub.notes || "").toLowerCase().trim();
        console.log(`Sub ${code}: notes="${notes}"`);

        let matchedUserId: string | undefined;

        // 1. Exact email match
        if (notes && emailToUserId.has(notes)) {
          matchedUserId = emailToUserId.get(notes);
          console.log(`Sub ${code}: exact email match -> ${matchedUserId}`);
        }

        // 2. Exact name match
        if (!matchedUserId && notes && nameToUserId.has(notes)) {
          matchedUserId = nameToUserId.get(notes);
          console.log(`Sub ${code}: exact name match -> ${matchedUserId}`);
        }

        // 3. Partial match: notes contains a known email
        if (!matchedUserId && notes) {
          for (const [email, uid] of emailToUserId.entries()) {
            if (notes.includes(email)) {
              matchedUserId = uid;
              console.log(`Sub ${code}: partial email match "${email}" -> ${uid}`);
              break;
            }
          }
        }

        // 4. Partial match: notes contains a known name
        if (!matchedUserId && notes) {
          for (const [name, uid] of nameToUserId.entries()) {
            if (name.length >= 3 && notes.includes(name)) {
              matchedUserId = uid;
              console.log(`Sub ${code}: partial name match "${name}" -> ${uid}`);
              break;
            }
          }
        }

        if (!matchedUserId) {
          console.log(`Sub ${code}: no match found`);
        }

        // Determine status
        const endDateStr = sub.due_date || sub.end_date || new Date().toISOString();
        const startDateStr = sub.created_at || sub.start_date || new Date().toISOString();
        const apiStatus = (sub.status || "UNKNOWN").toUpperCase();
        const now = new Date();
        const endDate = new Date(endDateStr);
        const daysLeft = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        let mappedStatus = "active";
        if (apiStatus === "CANCELLED") mappedStatus = "cancelled";
        else if (daysLeft < 0) mappedStatus = "expired";
        else if (daysLeft <= 3) mappedStatus = "expiring";

        const record: Record<string, any> = {
          name: code,
          type: "proxybr",
          status: mappedStatus,
          start_date: startDateStr,
          end_date: endDateStr,
          auto_renew: sub.auto_renew_active ?? false,
        };

        // Check if already exists
        const { data: existing } = await supabaseAdmin
          .from("subscriptions")
          .select("id, user_id")
          .eq("name", code)
          .eq("type", "proxybr")
          .maybeSingle();

        if (existing) {
          // Update status, and if not linked yet but we found a match, link it
          if (matchedUserId && existing.user_id === user.id) {
            record.user_id = matchedUserId;
            linked++;
          }
          await supabaseAdmin.from("subscriptions").update(record).eq("id", existing.id);
        } else {
          // Create new — use matched user or admin as placeholder
          record.user_id = matchedUserId || user.id;
          if (matchedUserId) linked++;
          await supabaseAdmin.from("subscriptions").insert(record);
        }
        synced++;
      }

      return new Response(
        JSON.stringify({ synced, linked, total: allSubs.length }),
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
