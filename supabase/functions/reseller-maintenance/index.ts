import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WEBSHARE_BASE = "https://proxy.webshare.io/api/v2";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json(401, { error: "Sem autorização" });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json(401, { error: "Token inválido" });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const subscriptionId = String(body?.subscription_id || "");

    if (!action || !subscriptionId) {
      return json(400, { error: "action e subscription_id são obrigatórios" });
    }

    // Load reseller for the authenticated user
    const { data: reseller, error: rErr } = await supabaseAdmin
      .from("resellers")
      .select("id, status, balance_credits, maintenance_swap_price, maintenance_day_price")
      .eq("user_id", user.id)
      .maybeSingle();

    if (rErr || !reseller) return json(403, { error: "Revendedor não encontrado" });
    if (reseller.status !== "active" && reseller.status !== "warning") {
      return json(403, { error: "Conta de revendedor inativa" });
    }

    // Load subscription and confirm ownership by this reseller
    const { data: sub, error: sErr } = await supabaseAdmin
      .from("subscriptions")
      .select("id, user_id, type, status, end_date, raw_data, reseller_id, name")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (sErr || !sub) return json(404, { error: "Assinatura não encontrada" });
    if (sub.reseller_id !== reseller.id) {
      return json(403, { error: "Esta assinatura não pertence ao seu painel" });
    }

    // ========== SWAP IP ==========
    if (action === "swap-ip") {
      const price = Number(reseller.maintenance_swap_price ?? 2);
      const currentBalance = Number(reseller.balance_credits ?? 0);
      if (currentBalance < price) {
        return json(402, { error: `Saldo insuficiente. Necessário R$ ${price.toFixed(2)}` });
      }

      const raw = (sub.raw_data || {}) as Record<string, unknown>;
      const proxyId = raw.fbflix_proxy_id ?? raw.webshare_proxy_id;
      if (!proxyId) {
        return json(400, { error: "Assinatura não possui proxy vinculado para troca" });
      }

      // Debit first (optimistic); revert on failure below.
      const newBalance = Number((currentBalance - price).toFixed(2));
      const { error: debitErr } = await supabaseAdmin
        .from("resellers")
        .update({ balance_credits: newBalance, updated_at: new Date().toISOString() })
        .eq("id", reseller.id);
      if (debitErr) return json(500, { error: "Falha ao debitar saldo" });

      // Call Webshare replace
      const WEBSHARE_API_KEY = Deno.env.get("WEBSHARE_API_KEY") || "";
      let providerData: any = null;
      try {
        const resp = await fetch(`${WEBSHARE_BASE}/proxy/replace/`, {
          method: "POST",
          headers: {
            "Authorization": `Token ${WEBSHARE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ proxy_ids: [proxyId] }),
        });
        providerData = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(`Webshare [${resp.status}]: ${JSON.stringify(providerData)}`);
      } catch (e) {
        // Revert debit
        await supabaseAdmin
          .from("resellers")
          .update({ balance_credits: currentBalance, updated_at: new Date().toISOString() })
          .eq("id", reseller.id);
        return json(502, { error: "Falha ao trocar proxy no provedor", details: String(e) });
      }

      // Ledger
      await supabaseAdmin.from("reseller_credit_ledger").insert({
        reseller_id: reseller.id,
        type: "debit",
        amount: price,
        balance_after: newBalance,
        reference_id: sub.id,
        description: `Troca de IP · ${sub.name || "proxy"} (sub ${String(sub.id).slice(0, 8)})`,
      });

      return json(200, {
        success: true,
        new_balance: newBalance,
        charged: price,
        provider: providerData,
      });
    }

    // ========== EXTEND DAYS ==========
    if (action === "extend-days") {
      const days = Math.floor(Number(body?.days ?? 0));
      if (!Number.isFinite(days) || days <= 0 || days > 90) {
        return json(400, { error: "days deve ser um número entre 1 e 90" });
      }
      const pricePerDay = Number(reseller.maintenance_day_price ?? 0.5);
      const total = Number((pricePerDay * days).toFixed(2));
      const currentBalance = Number(reseller.balance_credits ?? 0);
      if (currentBalance < total) {
        return json(402, { error: `Saldo insuficiente. Necessário R$ ${total.toFixed(2)}` });
      }

      const base = sub.end_date ? new Date(sub.end_date) : new Date();
      const newEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

      // Debit
      const newBalance = Number((currentBalance - total).toFixed(2));
      const { error: debitErr } = await supabaseAdmin
        .from("resellers")
        .update({ balance_credits: newBalance, updated_at: new Date().toISOString() })
        .eq("id", reseller.id);
      if (debitErr) return json(500, { error: "Falha ao debitar saldo" });

      // Extend
      const { error: extErr } = await supabaseAdmin
        .from("subscriptions")
        .update({ end_date: newEnd.toISOString(), updated_at: new Date().toISOString() })
        .eq("id", sub.id);

      if (extErr) {
        // revert debit
        await supabaseAdmin
          .from("resellers")
          .update({ balance_credits: currentBalance, updated_at: new Date().toISOString() })
          .eq("id", reseller.id);
        return json(500, { error: "Falha ao estender validade" });
      }

      await supabaseAdmin.from("reseller_credit_ledger").insert({
        reseller_id: reseller.id,
        type: "debit",
        amount: total,
        balance_after: newBalance,
        reference_id: sub.id,
        description: `+${days} dias · ${sub.name || "proxy"} (sub ${String(sub.id).slice(0, 8)})`,
      });

      return json(200, {
        success: true,
        new_balance: newBalance,
        charged: total,
        new_end_date: newEnd.toISOString(),
      });
    }

    return json(400, { error: "Ação não suportada" });
  } catch (e) {
    console.error("[reseller-maintenance] error:", e);
    return json(500, { error: String((e as Error)?.message || e) });
  }
});