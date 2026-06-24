import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const OP_SLUG = "amizades-7k9mpx2qvnxp";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-op-slug",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function authed(req: Request): boolean {
  const slug = req.headers.get("x-op-slug") || new URL(req.url).searchParams.get("slug") || "";
  return slug === OP_SLUG;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!authed(req)) {
    return new Response(JSON.stringify({ ok: false, error: "URL inválida" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "GET") {
      const [t, b, s] = await Promise.all([
        supabase
          .from("friend_request_targets")
          .select("id,batch_id,profile_url,profile_name,added,added_at,created_at,friends_count,friends_updated_at,friends_goal,is_blocked,blocked_at,blocked_reason")
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase.from("supplier_batches").select("id,name,supplier_id"),
        supabase.from("suppliers").select("id,name"),
      ]);
      if (t.error) throw t.error;
      return new Response(JSON.stringify({
        ok: true,
        targets: t.data || [],
        batches: b.data || [],
        suppliers: s.data || [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const action = body?.action as string;
      const id = body?.id as string;
      if (!id) {
        return new Response(JSON.stringify({ ok: false, error: "id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "set_added") {
        const value = Boolean(body?.value);
        const { error } = await supabase
          .from("friend_request_targets")
          .update({ added: value, added_at: value ? new Date().toISOString() : null })
          .eq("id", id);
        if (error) throw error;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "set_goal") {
        const goal = Math.max(1, parseInt(String(body?.goal || "100"), 10));
        const { error } = await supabase
          .from("friend_request_targets")
          .update({ friends_goal: goal })
          .eq("id", id);
        if (error) throw error;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "set_blocked") {
        const value = Boolean(body?.value);
        const { error } = await supabase
          .from("friend_request_targets")
          .update({
            is_blocked: value,
            blocked_at: value ? new Date().toISOString() : null,
            blocked_reason: value ? (body?.reason || "manual") : null,
          })
          .eq("id", id);
        if (error) throw error;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: false, error: "ação inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "Método não suportado" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fb-amizades-public error", e);
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});