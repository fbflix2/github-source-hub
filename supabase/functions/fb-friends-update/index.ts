import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function extractHandleOrId(input: string): string | null {
  if (!input) return null;
  const url = input.trim();
  const idMatch = url.match(/[?&]id=(\d+)/i);
  if (idMatch?.[1]) return `id:${idMatch[1]}`;
  const handleMatch = url.match(/facebook\.com\/([^/?#]+)/i);
  const handle = handleMatch?.[1];
  if (!handle) return null;
  const blocked = new Set(["profile.php", "people", "pages", "watch", "reel", "marketplace", "groups", "login", "settings", "help", "photo", "photo.php", "photos"]);
  if (blocked.has(handle.toLowerCase())) return null;
  return `h:${handle.toLowerCase()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const profileUrl: string = body?.profile_url || "";
    const isBlocked: boolean = body?.blocked === true;
    const blockedReason: string | null = body?.blocked_reason ?? null;
    const friendsCount = Number(body?.friends_count);
    const name: string | null = body?.name ?? null;

    if (!profileUrl) {
      return new Response(JSON.stringify({ ok: false, error: "profile_url obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isBlocked && (!Number.isFinite(friendsCount) || friendsCount < 0 || friendsCount > 100000)) {
      return new Response(JSON.stringify({ ok: false, error: "Parâmetros inválidos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = extractHandleOrId(profileUrl);
    if (!key) {
      return new Response(JSON.stringify({ ok: false, error: "URL de perfil inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Busca todos targets e filtra pelo handle/id no servidor
    const { data: rows, error } = await supabase
      .from("friend_request_targets")
      .select("id, profile_url")
      .limit(5000);
    if (error) throw error;

    const matches = (rows || []).filter((r) => extractHandleOrId(r.profile_url) === key);
    if (!matches.length) {
      return new Response(JSON.stringify({ ok: false, error: "Perfil não encontrado no banco. Adicione o link primeiro." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = matches.map((m) => m.id);
    const patch: Record<string, unknown> = {};
    if (isBlocked) {
      patch.is_blocked = true;
      patch.blocked_at = new Date().toISOString();
      if (blockedReason) patch.blocked_reason = String(blockedReason).slice(0, 200);
      // Perfil bloqueado/checkpoint → não deve aparecer como "solicitado"
      patch.added = false;
      patch.added_at = null;
    } else {
      patch.friends_count = Math.round(friendsCount);
      patch.friends_updated_at = new Date().toISOString();
      // Captura bem-sucedida = perfil acessível, desmarca bloqueio anterior
      patch.is_blocked = false;
      patch.blocked_at = null;
      patch.blocked_reason = null;
      if (name && name.trim()) patch.profile_name = name.trim();
    }

    const { error: upErr } = await supabase
      .from("friend_request_targets")
      .update(patch)
      .in("id", ids);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ok: true, updated: ids.length, blocked: isBlocked, friends_count: patch.friends_count ?? null }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fb-friends-update error", e);
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});