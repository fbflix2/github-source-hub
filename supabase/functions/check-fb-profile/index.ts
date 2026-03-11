import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Indicators that suggest a profile is blocked/disabled/not available.
 * We check the raw HTML returned by Facebook for these patterns.
 */
const BLOCK_INDICATORS = [
  "This content isn't available right now",
  "This content isn\u2019t available right now",
  "content isn't available",
  "this page isn't available",
  "This Page Isn't Available",
  "This page isn\u2019t available",
  "account has been disabled",
  "Account Has Been Disabled",
  "profile is not available",
  "temporarily restricted",
  "Sorry, this content isn't available",
  "Sorry, this content isn\u2019t available",
  "page you requested was not found",
  "The link you followed may be broken",
  "the link you followed may have expired",
  "errorSummary",
  '"error_code"',
  "account_disabled",
  "permanently deleted",
];

/**
 * Indicators that suggest the profile IS active/live.
 */
const ACTIVE_INDICATORS = [
  'data-pagelet="ProfileActions"',
  'data-pagelet="ProfileTilesFeed"',
  '"profile_owner"',
  '"timeline_context"',
  'profileCoverPhoto',
  '"userID"',
  'entity_id',
  'profile_header_renderer',
  '"profilePic"',
  'profile_photo',
];

type ProfileStatus = "active" | "blocked" | "not_found" | "unknown" | "error";

interface CheckResult {
  url: string;
  status: ProfileStatus;
  httpStatus: number;
  detail: string;
}

async function checkProfileUrl(profileUrl: string): Promise<CheckResult> {
  let formattedUrl = profileUrl.trim();
  if (!formattedUrl.startsWith("http")) {
    formattedUrl = `https://www.facebook.com/${formattedUrl}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(formattedUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const html = await resp.text();
    const httpStatus = resp.status;
    const finalUrl = resp.url;

    // Check for login redirect (Facebook hiding profile behind login wall)
    if (finalUrl.includes("/login") || finalUrl.includes("checkpoint")) {
      // Even login redirects can tell us things — if the page existed, it would redirect to login
      // A non-existent page also redirects to login, so this is "unknown"
      return {
        url: profileUrl,
        status: "unknown",
        httpStatus,
        detail: "Redirecionado para login — não é possível verificar sem autenticação",
      };
    }

    // 404
    if (httpStatus === 404) {
      return {
        url: profileUrl,
        status: "not_found",
        httpStatus,
        detail: "Perfil não encontrado (404)",
      };
    }

    // Check block indicators
    const htmlLower = html.toLowerCase();
    for (const indicator of BLOCK_INDICATORS) {
      if (html.includes(indicator) || htmlLower.includes(indicator.toLowerCase())) {
        return {
          url: profileUrl,
          status: "blocked",
          httpStatus,
          detail: `Perfil bloqueado/desativado — detectado: "${indicator.substring(0, 50)}"`,
        };
      }
    }

    // Check active indicators
    for (const indicator of ACTIVE_INDICATORS) {
      if (html.includes(indicator)) {
        return {
          url: profileUrl,
          status: "active",
          httpStatus,
          detail: "Perfil ativo — indicadores de perfil encontrados",
        };
      }
    }

    // Also try Graph API picture as a secondary check
    const handleOrId = extractHandleOrId(profileUrl);
    if (handleOrId) {
      const graphUrl = `https://graph.facebook.com/${encodeURIComponent(handleOrId)}/picture?type=large&redirect=false`;
      try {
        const graphResp = await fetch(graphUrl);
        if (graphResp.ok) {
          const graphData = await graphResp.json();
          const photoUrl = graphData?.data?.url;
          if (photoUrl && !photoUrl.includes("static")) {
            return {
              url: profileUrl,
              status: "active",
              httpStatus,
              detail: "Perfil ativo — foto de perfil encontrada via Graph API",
            };
          }
        }
      } catch {
        // Graph API check failed, continue with unknown
      }
    }

    // If page has substantial content but no clear indicators
    if (html.length > 50000) {
      return {
        url: profileUrl,
        status: "active",
        httpStatus,
        detail: "Provavelmente ativo — página com conteúdo substancial",
      };
    }

    return {
      url: profileUrl,
      status: "unknown",
      httpStatus,
      detail: "Não foi possível determinar o status com certeza",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      url: profileUrl,
      status: "error",
      httpStatus: 0,
      detail: `Erro ao verificar: ${message}`,
    };
  }
}

function extractHandleOrId(url: string): string | null {
  const trimmed = url.trim();
  const idMatch = trimmed.match(/[?&]id=(\d+)/i);
  if (idMatch?.[1]) return idMatch[1];
  const handleMatch = trimmed.match(/facebook\.com\/([^/?#]+)/i);
  const handle = handleMatch?.[1];
  if (!handle) return trimmed.replace(/^https?:\/\//i, "").replace(/\/$/, "") || null;
  const blocked = new Set(["profile.php", "people", "pages", "watch", "reel", "marketplace", "groups", "login"]);
  if (blocked.has(handle.toLowerCase())) return null;
  return handle;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — staff only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: isStaff } = await adminClient.rpc("is_staff", { _user_id: userId });
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    let result: unknown;

    switch (action) {
      case "check-url": {
        const { url } = params;
        if (!url) throw new Error("url is required");
        result = await checkProfileUrl(url);
        break;
      }

      case "check-batch": {
        const { urls } = params as { urls: string[] };
        if (!urls || !Array.isArray(urls)) throw new Error("urls array is required");
        const limited = urls.slice(0, 20); // Max 20 at a time to avoid timeouts
        const results: CheckResult[] = [];
        // Process sequentially to avoid rate limiting
        for (const url of limited) {
          const r = await checkProfileUrl(url);
          results.push(r);
          // Small delay between requests to avoid being blocked
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        result = { results, total: limited.length };
        break;
      }

      case "check-stock": {
        const { folderId, limit: queryLimit, statusFilter } = params;
        const statuses = statusFilter === "vendido" 
          ? ["vendido"] 
          : statusFilter === "all" 
            ? ["revisado", "aguardando", "vendido"]
            : ["revisado", "aguardando"];
        
        const query = adminClient
          .from("stock_items")
          .select("id, name, identification, identification_link, status, data, product_id")
          .is("deleted_at", null)
          .not("identification_link", "is", null)
          .ilike("identification_link", "%facebook%")
          .in("status", statuses)
          .order("created_at", { ascending: false })
          .limit(queryLimit || 20);

        if (folderId) {
          query.eq("folder", folderId);
        }

        const { data: stockItems, error: stockError } = await query;
        if (stockError) throw new Error(stockError.message);

        const results: (CheckResult & { stockItemId: string; stockItemName: string })[] = [];
        for (const item of stockItems || []) {
          const url = item.identification_link!;
          const r = await checkProfileUrl(url);
          results.push({
            ...r,
            stockItemId: item.id,
            stockItemName: item.name,
          });
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        result = { results, total: results.length };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[check-fb-profile]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
