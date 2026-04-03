import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ERROR_PATTERNS = [
  "this content isn't available",
  "this content isn\u2019t available",
  "conteúdo não está disponível",
  "page isn't available",
  "content not found",
  "temporarily blocked",
  "sorry, something went wrong",
  "link you followed may be broken",
  "page you requested was not found",
];

const INVITATION_EXPIRED_PATTERNS = [
  "this invitation has expired",
  "este convite expirou",
  "invitation is no longer valid",
  "convite não é mais válido",
  "convite expirou",
];

const DISABLED_PATTERNS = [
  "account has been disabled",
  "conta foi desativada",
];

type LinkHealth = "healthy" | "error" | "expired" | "login_required" | "timeout" | "unknown";

async function checkLink(vaultId: string, url: string): Promise<{ vault_id: string; health: LinkHealth; detail: string }> {
  if (!url || !url.startsWith("http")) {
    return { vault_id: vaultId, health: "unknown", detail: "URL inválida" };
  }

  const isInvitation = url.includes("business.facebook.com/invitation");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (isInvitation) {
      if (res.status >= 500) return { vault_id: vaultId, health: "error", detail: `HTTP ${res.status}` };
      const html = await res.text();
      const lower = html.toLowerCase();
      for (const p of INVITATION_EXPIRED_PATTERNS) {
        if (lower.includes(p)) return { vault_id: vaultId, health: "expired", detail: "Convite expirado" };
      }
      for (const p of DISABLED_PATTERNS) {
        if (lower.includes(p)) return { vault_id: vaultId, health: "error", detail: "Conta desativada" };
      }
      return { vault_id: vaultId, health: "healthy", detail: "OK" };
    }

    if (url.includes("business.facebook.com")) {
      return { vault_id: vaultId, health: res.status >= 500 ? "error" : "healthy", detail: `HTTP ${res.status}` };
    }

    const html = await res.text();
    const lower = html.toLowerCase();
    for (const p of ERROR_PATTERNS) {
      if (lower.includes(p.toLowerCase())) return { vault_id: vaultId, health: "error", detail: p };
    }
    if (res.status >= 400) return { vault_id: vaultId, health: "error", detail: `HTTP ${res.status}` };
    return { vault_id: vaultId, health: html.length > 500 ? "healthy" : "unknown", detail: `HTTP ${res.status}` };
  } catch (err: any) {
    if (err.name === "AbortError") return { vault_id: vaultId, health: "timeout", detail: "Timeout" };
    return { vault_id: vaultId, health: "error", detail: err.message?.slice(0, 80) || "Erro" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Fetch all active vaults with a real link
    const { data: vaults, error } = await adminClient
      .from("safe_bm_vaults")
      .select("id, bm_link, backup_link")
      .eq("status", "active");

    if (error) throw error;
    if (!vaults || vaults.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum cofre ativo", checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    let checked = 0;
    const batchSize = 5;

    for (let i = 0; i < vaults.length; i += batchSize) {
      const batch = vaults.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((v: any) => {
          const link = v.backup_link || v.bm_link;
          return checkLink(v.id, link);
        })
      );

      for (const r of results) {
        await adminClient.from("safe_bm_vaults")
          .update({ link_health: r.health, link_health_checked_at: now })
          .eq("id", r.vault_id);
        checked++;
      }
    }

    console.log(`[CRON] Checked ${checked} BM links`);

    return new Response(JSON.stringify({ message: `Verificação diária concluída`, checked }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("check-bm-link-cron error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
