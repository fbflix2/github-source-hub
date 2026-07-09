import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json({ error: "Token inválido" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const ctClientId: string | undefined = body?.ct_client_id;
    const lauthEmail: string = String(body?.lauth_email || "").trim().toLowerCase();
    const hasAccount: boolean = !!body?.has_account;

    if (!ctClientId || !lauthEmail) return json({ error: "Dados obrigatórios ausentes" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lauthEmail) || lauthEmail.length > 255) {
      return json({ error: "E-mail inválido" }, 400);
    }

    const { data: ct, error: ctErr } = await admin
      .from("ct_clients")
      .select("id, user_id, plan_id")
      .eq("id", ctClientId)
      .maybeSingle();
    if (ctErr || !ct) return json({ error: "Assinatura não encontrada" }, 404);
    if (ct.user_id !== userId) return json({ error: "Não autorizado" }, 403);

    await admin.from("ct_clients")
      .update({ lauth_email: lauthEmail, lauth_status: "pending" })
      .eq("id", ctClientId);

    const { data: profile } = await admin
      .from("profiles").select("full_name, phone").eq("user_id", userId).maybeSingle();
    const { data: plan } = await admin
      .from("ct_plans").select("name").eq("id", ct.plan_id).maybeSingle();

    const clientName = profile?.full_name || "Cliente";
    const planName = plan?.name || "Scale Pro";
    const flowLabel = hasAccount ? "já possui conta Lauth" : "criou conta Lauth agora";

    await admin.from("notifications").insert({
      title: "🔔 Liberar Scale Pro — Lauth",
      message: `${clientName} (${planName}) informou o e-mail Lauth: ${lauthEmail} (${flowLabel}). Liberar acesso à estrutura Scale Pro.`,
      type: "ct_lauth_pending",
      global: true,
    });

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}