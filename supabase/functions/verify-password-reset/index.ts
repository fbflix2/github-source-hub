import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, email, code, new_password } = await req.json();
    if (!email || !code) return jsonRes({ error: "email e código são obrigatórios" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const emailNorm = String(email).trim().toLowerCase();
    const codeNorm = String(code).trim();

    // Fetch latest active code for this email
    const { data: row, error } = await admin
      .from("password_reset_codes")
      .select("*")
      .eq("email", emailNorm)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !row) return jsonRes({ error: "Código inválido ou expirado" }, 400);
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return jsonRes({ error: "Código expirado. Solicite um novo." }, 400);
    }
    if (row.attempts >= 5) {
      await admin.from("password_reset_codes").update({ used: true }).eq("id", row.id);
      return jsonRes({ error: "Muitas tentativas. Solicite um novo código." }, 400);
    }
    if (row.code !== codeNorm) {
      await admin.from("password_reset_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return jsonRes({ error: "Código incorreto" }, 400);
    }

    // action: verify-only → confirm code correctness before showing password step
    if (action === "verify") {
      return jsonRes({ success: true, valid: true });
    }

    // action: reset → change password
    if (!new_password || typeof new_password !== "string" || new_password.length < 6) {
      return jsonRes({ error: "A senha deve ter pelo menos 6 caracteres" }, 400);
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(row.user_id, {
      password: new_password,
      user_metadata: { must_change_password: false },
    });
    if (updErr) return jsonRes({ error: updErr.message }, 400);

    await admin.from("password_reset_codes").update({ used: true }).eq("id", row.id);

    return jsonRes({ success: true, message: "Senha alterada com sucesso" });
  } catch (e) {
    console.error(e);
    return jsonRes({ error: (e as Error).message }, 500);
  }
});