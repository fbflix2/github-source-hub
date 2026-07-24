import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await userClient.auth.getUser(token);
    const callerId = userData?.user?.id;
    if (!callerId) throw new Error("Não autorizado");

    const body = await req.json().catch(() => ({}));
    const target_user_id = String(body.target_user_id || "").trim();
    const operation = body.operation === "debit" ? "debit" : "credit";
    const amount = Number(body.amount);
    const note = String(body.note || "").slice(0, 200);
    if (!target_user_id) throw new Error("Cliente inválido");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valor inválido");
    if (amount > 100000) throw new Error("Valor acima do permitido");

    const admin = createClient(url, service);

    // Verify caller is reseller
    const { data: reseller } = await admin
      .from("resellers")
      .select("id, status, balance_credits, company_name")
      .eq("user_id", callerId)
      .maybeSingle();
    if (!reseller) throw new Error("Somente revendedores");
    if (!["active", "warning"].includes(reseller.status)) throw new Error("Revenda inativa");

    // Verify target client belongs to this reseller
    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, balance, full_name, reseller_id")
      .eq("user_id", target_user_id)
      .maybeSingle();
    if (!profile) throw new Error("Cliente não encontrado");

    let belongs = profile.reseller_id === reseller.id;
    if (!belongs) {
      const { data: ord } = await admin
        .from("orders")
        .select("id")
        .eq("reseller_id", reseller.id)
        .eq("user_id", target_user_id)
        .limit(1);
      belongs = !!(ord && ord.length);
    }
    if (!belongs) throw new Error("Cliente não pertence à sua revenda");

    const resellerBalance = Number(reseller.balance_credits ?? 0);
    const clientBalance = Number(profile.balance ?? 0);

    if (operation === "credit") {
      if (resellerBalance < amount) throw new Error("Saldo insuficiente na sua carteira de revenda");
    } else {
      if (clientBalance < amount) throw new Error("Cliente não possui saldo suficiente para debitar");
    }

    const newClientBalance = operation === "credit" ? clientBalance + amount : clientBalance - amount;
    const newResellerBalance = operation === "credit" ? resellerBalance - amount : resellerBalance + amount;

    // Update client wallet
    const { error: upErr } = await admin
      .from("profiles")
      .update({ balance: newClientBalance })
      .eq("user_id", target_user_id);
    if (upErr) throw upErr;

    // Update reseller wallet
    await admin
      .from("resellers")
      .update({ balance_credits: newResellerBalance })
      .eq("id", reseller.id);

    // Log wallet transaction on client side
    const title = operation === "credit"
      ? `Crédito manual do revendedor${note ? ` — ${note}` : ""}`
      : `Débito manual do revendedor${note ? ` — ${note}` : ""}`;

    await admin.from("wallet_transactions").insert({
      user_id: target_user_id,
      type: operation === "credit" ? "credit" : "debit",
      title,
      amount,
      balance_after: newClientBalance,
      reference_id: String(reseller.id),
    });

    // Log reseller ledger
    await admin.from("reseller_credit_ledger").insert({
      reseller_id: reseller.id,
      type: operation === "credit" ? "debit" : "credit",
      amount,
      balance_after: newResellerBalance,
      description: operation === "credit"
        ? `Crédito enviado ao cliente ${profile.full_name || target_user_id}${note ? ` — ${note}` : ""}`
        : `Débito recebido do cliente ${profile.full_name || target_user_id}${note ? ` — ${note}` : ""}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        client_balance: newClientBalance,
        reseller_balance: newResellerBalance,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});