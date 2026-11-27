import { createClient } from "npm:@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método inválido." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const action = body?.action;
    const bootstrap = req.headers.get("x-wa-notice-bootstrap");
    if (bootstrap !== null) {
      // Temporary one-time provisioning capability, only accessible in service-role storage.
      if (action !== "activate" || !/^[a-f0-9]{64}$/.test(bootstrap)) return reply({ error: "Não autorizado." }, 403);
      const { data, error } = await admin.from("wa_new_contact_notice_settings")
        .update({ bootstrap_key: null, bootstrap_expires_at: null }).eq("id", 1)
        .eq("bootstrap_key", bootstrap).gt("bootstrap_expires_at", new Date().toISOString()).select("id").maybeSingle();
      if (error || !data) return reply({ error: "Não autorizado." }, 403);
    } else {
      const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!jwt) return reply({ error: "Sessão necessária." }, 401);
      const { data, error } = await admin.auth.getUser(jwt);
      if (error || !data.user) return reply({ error: "Sessão inválida." }, 401);
      const role = await admin.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
      if (role.error || !role.data) return reply({ error: "Acesso restrito a administradores." }, 403);
    }
    const { data: cfg, error: cfgError } = await admin.from("wa_new_contact_notice_settings")
      .select("enabled,message,activated_at,webhook_secret,updated_at").eq("id", 1).single();
    if (cfgError || !cfg) return reply({ error: "Configuração indisponível." }, 500);
    if (action === "activate" || action === "save") {
      const enabled = action === "activate" ? true : body.enabled;
      const message = action === "activate" ? cfg.message : body.message;
      if (typeof enabled !== "boolean" || typeof message !== "string" || !message.trim() || message.length > 3000) return reply({ error: "Mensagem ou estado inválido." }, 400);
      if (enabled && !cfg.enabled) {
        const token = Deno.env.get("WAPI_TOKEN");
        const instance = Deno.env.get("WAPI_INSTANCE_ID");
        if (!token || !instance) return reply({ success: false, error: "W-API não configurada." });
        const target = new URL(url.replace(/\/$/, "") + "/functions/v1/wapi-webhook");
        target.searchParams.set("wa_notice_key", cfg.webhook_secret);
        const endpoint = new URL("https://api.w-api.app/v1/webhook/update-webhook-received");
        endpoint.searchParams.set("instanceId", instance);
        // Preserve the existing CRM endpoint; modify only the received-message callback.
        const r = await fetch(endpoint, {
          method: "PUT", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ value: target.toString() }), signal: AbortSignal.timeout(12000),
        });
        const data = await r.json().catch(() => null);
        if (!r.ok || !data || data.error !== false) return reply({ success: false, error: "W-API não confirmou o webhook de recebimento (HTTP " + r.status + "). O aviso continua desativado." });
      }
      const now = new Date().toISOString();
      const { error } = await admin.from("wa_new_contact_notice_settings").update({
        enabled, message: message.trim(), activated_at: enabled && !cfg.enabled ? now : cfg.activated_at, updated_at: now,
      }).eq("id", 1);
      if (error) return reply({ success: false, error: "Não foi possível salvar a configuração." });
    } else if (action !== "get") return reply({ error: "Ação inválida." }, 400);
    const { data: current, error: currentError } = await admin.from("wa_new_contact_notice_settings")
      .select("enabled,message,activated_at,updated_at").eq("id", 1).single();
    if (currentError || !current) return reply({ error: "Configuração indisponível." }, 500);
    const statuses = ["sent", "failed", "unknown", "pending"] as const;
    const counts = await Promise.all(statuses.map(async status => {
      const { count, error } = await admin.from("wa_new_contact_notice_attempts").select("phone", { count: "exact", head: true }).eq("status", status);
      return [status, error ? null : count] as const;
    }));
    return reply({ success: true, ...current, counts: Object.fromEntries(counts) });
  } catch {
    return reply({ error: "Não foi possível concluir a operação." }, 500);
  }
});
