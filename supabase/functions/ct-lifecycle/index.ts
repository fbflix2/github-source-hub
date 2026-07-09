import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const summary = { expired_trials: 0, renewed: 0, suspended: 0 };

  try {
    // 1) Expire trials/pending payment past 24h
    const { data: expired } = await admin
      .from("ct_clients")
      .select("id")
      .in("status", ["trial", "pendente_pagamento"])
      .lt("trial_ends_at", now.toISOString());
    if (expired && expired.length > 0) {
      const ids = expired.map((x) => x.id);
      await admin.from("ct_clients")
        .update({ status: "cancelado" })
        .in("id", ids);
      summary.expired_trials = ids.length;
    }

    // 2) Renew subscriptions where next_billing <= today
    const { data: dueList } = await admin
      .from("ct_clients")
      .select("id, user_id, plan_id, monthly_value, next_billing")
      .eq("status", "ativo")
      .lte("next_billing", today);

    for (const sub of (dueList ?? [])) {
      const price = Number(sub.monthly_value);
      const { data: prof } = await admin
        .from("profiles").select("balance, full_name").eq("user_id", sub.user_id).single();
      const bal = Number(prof?.balance || 0);

      if (bal >= price) {
        const newBal = bal - price;
        await admin.from("profiles").update({ balance: newBal }).eq("user_id", sub.user_id);

        const nextBilling = new Date();
        nextBilling.setDate(nextBilling.getDate() + 30);
        await admin.from("ct_clients").update({
          next_billing: nextBilling.toISOString().slice(0, 10),
          last_payment_at: now.toISOString(),
        }).eq("id", sub.id);

        await admin.from("wallet_transactions").insert({
          user_id: sub.user_id,
          type: "debit",
          title: "Renovação Scale Pro",
          amount: price,
          balance_after: newBal,
          reference_id: sub.id,
        });
        summary.renewed++;
      } else {
        await admin.from("ct_clients").update({ status: "suspenso" }).eq("id", sub.id);
        await admin.from("notifications").insert({
          title: "Assinatura CT suspensa",
          message: `${prof?.full_name || "Cliente"} ficou sem saldo para renovar (R$ ${price.toFixed(2)}).`,
          type: "subscription",
          global: true,
        });
        summary.suspended++;
      }
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ct-lifecycle] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});