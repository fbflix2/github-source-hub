import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ERROR_PATTERNS = [
  "this content isn't available",
  "this content isn\u2019t available",
  "conteúdo não está disponível",
  "page isn't available",
  "account has been disabled",
  "conta foi desativada",
  "content not found",
  "temporarily blocked",
  "bloqueado temporariamente",
  "sorry, something went wrong",
  "link you followed may be broken",
  "link que você seguiu pode estar quebrado",
  "page you requested was not found",
];

const LOGIN_PATTERNS = [
  "log in to continue",
  "faça login para continuar",
  "you must log in",
  "/login/",
  "login_form",
];

type LinkHealth = "healthy" | "error" | "login_required" | "timeout" | "unknown";

interface CheckResult {
  vault_id: string;
  health: LinkHealth;
  detail: string;
}

async function checkSingleLink(vaultId: string, url: string): Promise<CheckResult> {
  if (!url || !url.startsWith("http")) {
    return { vault_id: vaultId, health: "unknown", detail: "URL inválida" };
  }

  const isBizFbInvitation = url.includes("business.facebook.com/invitation");
  const isBizFbGeneric = url.includes("business.facebook.com") && !isBizFbInvitation;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // For business.facebook.com invitation links: if we got ANY response, the link exists
    // These always redirect to login — that's normal behavior
    if (isBizFbInvitation) {
      if (res.status >= 500) {
        return { vault_id: vaultId, health: "error", detail: `Servidor FB com erro (${res.status})` };
      }
      // Check if the invitation token was invalidated (specific error pages)
      const html = await res.text();
      const lower = html.toLowerCase();
      // Only flag as error if the page explicitly says the invitation/content is unavailable
      const INVITATION_ERROR_PATTERNS = [
        "this invitation has expired",
        "este convite expirou",
        "invitation is no longer valid",
        "convite não é mais válido",
        "account has been disabled",
        "conta foi desativada",
      ];
      for (const pattern of INVITATION_ERROR_PATTERNS) {
        if (lower.includes(pattern)) {
          return { vault_id: vaultId, health: "error", detail: `Detectado: "${pattern}"` };
        }
      }
      // Otherwise treat as healthy — login redirect is expected
      return { vault_id: vaultId, health: "healthy", detail: `OK (convite acessível)` };
    }

    // For generic business.facebook.com links (no invitation token)
    if (isBizFbGeneric) {
      if (res.status >= 500) {
        return { vault_id: vaultId, health: "error", detail: `HTTP ${res.status}` };
      }
      return { vault_id: vaultId, health: "login_required", detail: "Link genérico (requer login)" };
    }

    // For non-Facebook links, do full content analysis
    const html = await res.text();
    const lower = html.toLowerCase();

    for (const pattern of ERROR_PATTERNS) {
      if (lower.includes(pattern.toLowerCase())) {
        return { vault_id: vaultId, health: "error", detail: `Detectado: "${pattern}"` };
      }
    }

    for (const pattern of LOGIN_PATTERNS) {
      if (lower.includes(pattern.toLowerCase())) {
        return { vault_id: vaultId, health: "login_required", detail: "Requer login (pode ser normal)" };
      }
    }

    if (res.status >= 400) {
      return { vault_id: vaultId, health: "error", detail: `HTTP ${res.status}` };
    }

    if (html.length > 500) {
      return { vault_id: vaultId, health: "healthy", detail: `OK (${res.status})` };
    }

    return { vault_id: vaultId, health: "unknown", detail: "Resposta muito curta" };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { vault_id: vaultId, health: "timeout", detail: "Timeout (>12s)" };
    }
    return { vault_id: vaultId, health: "error", detail: err.message?.slice(0, 80) || "Erro desconhecido" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is staff using getClaims
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    
    const token = (authHeader || "").replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: isStaff } = await adminClient.rpc("is_staff", { _user_id: userId });
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { vault_ids } = body;

    // Fetch vaults to check
    let query = adminClient.from("safe_bm_vaults").select("id, bm_link").eq("status", "active");
    if (vault_ids && Array.isArray(vault_ids) && vault_ids.length > 0) {
      query = query.in("id", vault_ids);
    }
    const { data: vaults, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;
    if (!vaults || vaults.length === 0) {
      return new Response(JSON.stringify({ results: [], message: "Nenhum cofre ativo encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check links in parallel (max 5 concurrent)
    const results: CheckResult[] = [];
    const batchSize = 5;
    for (let i = 0; i < vaults.length; i += batchSize) {
      const batch = vaults.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((v: any) => checkSingleLink(v.id, v.bm_link))
      );
      results.push(...batchResults);
    }

    // Update vault health status in DB
    const now = new Date().toISOString();
    for (const r of results) {
      await adminClient.from("safe_bm_vaults")
        .update({ link_health: r.health, link_health_checked_at: now })
        .eq("id", r.vault_id);
    }

    console.log(`Checked ${results.length} BM links: ${results.filter(r => r.health === 'healthy').length} healthy, ${results.filter(r => r.health === 'error').length} errors`);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("check-bm-link error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
