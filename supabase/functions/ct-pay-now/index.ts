import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { ct_client_id } = await req.json().catch(() => ({}));
    if (!ct_client_id) {
      return new Response(JSON.stringify({ error: "ct_client_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load ct_client
    const { data: ctClient, error: ccErr } = await admin
      .from("ct_clients")
      .select("id, user_id, monthly_value, status, next_billing")
      .eq("id", ct_client_id)
      .maybeSingle();
    if (ccErr || !ctClient) {
      return new Response(JSON.stringify({ error: "Assinatura não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only the owner (or admin) can pay
    const { data: role } = await admin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    const isAdmin = !!role;
    if (!isAdmin && ctClient.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ctClient.status === "cancelado") {
      return new Response(JSON.stringify({ error: "Assinatura cancelada — contate o suporte" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const price = Number(ctClient.monthly_value || 0);
    if (price <= 0) {
      return new Response(JSON.stringify({ error: "Valor mensal inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get balance
    const { data: prof } = await admin
      .from("profiles").select("balance, full_name").eq("user_id", ctClient.user_id).single();
    const balance = Number(prof?.balance || 0);

    if (balance < price) {
      return new Response(JSON.stringify({
        error: "Saldo insuficiente",
        needed: price,
        balance,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newBalance = balance - price;

    // Debit balance
    await admin.from("profiles").update({ balance: newBalance }).eq("user_id", ctClient.user_id);

    // Next billing = today + 30 days (or current next_billing + 30 if in future to avoid loss)
    const base = new Date();
    if (ctClient.next_billing) {
      const cur = new Date(ctClient.next_billing);
      if (cur.getTime() > base.getTime()) base.setTime(cur.getTime());
    }
    base.setDate(base.getDate() + 30);

    const wasSuspenso = ctClient.status === "suspenso";

    await admin.from("ct_clients").update({
      status: "ativo",
      next_billing: base.toISOString().slice(0, 10),
      last_payment_at: new Date().toISOString(),
    }).eq("id", ct_client_id);

    await admin.from("wallet_transactions").insert({
      user_id: ctClient.user_id,
      type: "debit",
      title: wasSuspenso ? "Reativação Scale Pro" : "Pagamento Scale Pro",
      amount: price,
      balance_after: newBalance,
      reference_id: ct_client_id,
    });

    return new Response(JSON.stringify({
      success: true,
      new_balance: newBalance,
      next_billing: base.toISOString().slice(0, 10),
      reactivated: wasSuspenso,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[ct-pay-now] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});