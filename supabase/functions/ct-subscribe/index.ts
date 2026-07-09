import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

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
    const planId: string | undefined = body?.plan_id;
    const paymentMethod: "saldo" | "pix" = body?.payment_method === "pix" ? "pix" : "saldo";
    if (!planId) return json({ error: "plan_id obrigatório" }, 400);

    // Fetch plan
    const { data: plan, error: planErr } = await admin
      .from("ct_plans")
      .select("id, name, price, active, profiles_qty")
      .eq("id", planId)
      .maybeSingle();
    if (planErr || !plan) return json({ error: "Plano não encontrado" }, 404);
    if (!plan.active) return json({ error: "Plano indisponível" }, 400);

    // Block if already has an active/trial subscription
    const { data: existing } = await admin
      .from("ct_clients")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["ativo", "trial", "pendente_pagamento"])
      .maybeSingle();
    if (existing) {
      return json({ error: "Você já possui uma assinatura ativa ou pendente." }, 400);
    }

    const price = Number(plan.price);

    if (paymentMethod === "saldo") {
      // Debit balance atomically-ish
      const { data: profile } = await admin
        .from("profiles")
        .select("balance, full_name")
        .eq("user_id", userId)
        .single();
      const currentBalance = Number(profile?.balance || 0);
      if (currentBalance < price) {
        return json({ error: "Saldo insuficiente. Recarregue sua carteira ou pague via PIX." }, 400);
      }
      const newBalance = currentBalance - price;
      await admin.from("profiles").update({ balance: newBalance }).eq("user_id", userId);

      const startDate = new Date();
      const nextBilling = new Date();
      nextBilling.setDate(nextBilling.getDate() + 30);

      const { data: ctClient, error: ctErr } = await admin
        .from("ct_clients")
        .insert({
          user_id: userId,
          plan_id: planId,
          status: "ativo",
          monthly_value: price,
          start_date: startDate.toISOString().slice(0, 10),
          next_billing: nextBilling.toISOString().slice(0, 10),
          payment_method: "saldo",
          last_payment_at: startDate.toISOString(),
        })
        .select("id")
        .single();
      if (ctErr) throw ctErr;

      await admin.from("wallet_transactions").insert({
        user_id: userId,
        type: "debit",
        title: `Assinatura Scale Pro — ${plan.name}`,
        amount: price,
        balance_after: newBalance,
        reference_id: ctClient.id,
      });

      await admin.from("notifications").insert({
        title: "Nova assinatura CT",
        message: `${profile?.full_name || "Cliente"} assinou o plano ${plan.name} (R$ ${price.toFixed(2)}) via saldo.`,
        type: "subscription",
        global: true,
      });

      // WhatsApp notification to the client
      const { data: profPhone } = await admin
        .from("profiles").select("phone, full_name").eq("user_id", userId).single();
      if (profPhone?.phone) {
        const firstName = (profPhone.full_name || "").split(" ")[0] || "cliente";
        const msg =
          `✅ *Scale Pro ativada!*\n\n` +
          `Olá ${firstName}, sua assinatura do plano *${plan.name}* foi ativada com sucesso.\n\n` +
          `💰 Valor: R$ ${price.toFixed(2)}\n` +
          `📅 Próxima renovação: ${nextBilling.toLocaleDateString("pt-BR")}\n\n` +
          `Acesse seu painel: https://fbflix.com.br/contingencia`;
        await admin.functions.invoke("wapi-send", {
          body: {
            action: "send-text",
            phone: profPhone.phone,
            message: msg,
            user_id: userId,
            event_key: "ct_subscription_activated",
          },
        }).catch((e) => console.error("wapi-send failed:", e));
      }

      return json({
        ok: true,
        method: "saldo",
        ct_client_id: ctClient.id,
        next_billing: nextBilling.toISOString().slice(0, 10),
      });
    }

    // ===== PIX flow =====
    const OPENPIX_APP_ID = Deno.env.get("OPENPIX_APP_ID");
    if (!OPENPIX_APP_ID) return json({ error: "PIX indisponível no momento" }, 500);

    // Create ct_client in trial state (24h max)
    const trialEnds = new Date();
    trialEnds.setHours(trialEnds.getHours() + 24);

    const { data: ctClient, error: ctErr } = await admin
      .from("ct_clients")
      .insert({
        user_id: userId,
        plan_id: planId,
        status: "pendente_pagamento",
        monthly_value: price,
        start_date: new Date().toISOString().slice(0, 10),
        payment_method: "pix",
        trial_ends_at: trialEnds.toISOString(),
      })
      .select("id")
      .single();
    if (ctErr) throw ctErr;

    const paymentCode = `CT-${Date.now()}`;
    const { data: payment, error: payErr } = await admin
      .from("payments")
      .insert({
        user_id: userId,
        amount: price,
        code: paymentCode,
        gateway: "openpix",
        status: "pending",
        metadata: {
          type: "ct_subscription",
          ct_client_id: ctClient.id,
          plan_id: planId,
          plan_name: plan.name,
        },
      })
      .select("id")
      .single();
    if (payErr) throw payErr;

    // Save link between ct_client and payment
    await admin.from("ct_clients").update({ last_payment_id: payment.id }).eq("id", ctClient.id);

    // Create OpenPix charge
    const chargeRes = await fetch("https://api.openpix.com.br/api/v1/charge", {
      method: "POST",
      headers: { Authorization: OPENPIX_APP_ID, "Content-Type": "application/json" },
      body: JSON.stringify({
        correlationID: payment.id,
        value: Math.round(price * 100),
        comment: `Scale Pro — ${plan.name}`,
        expiresIn: 60 * 60 * 24, // 24h
      }),
    });
    const opData = await chargeRes.json();
    if (!chargeRes.ok) {
      console.error("OpenPix error:", opData);
      throw new Error("Falha ao gerar PIX");
    }
    const charge = opData.charge || opData;

    let qr_code_base64: string | null = null;
    try {
      const imgRes = await fetch(
        `https://api.openpix.com.br/api/v1/charge/${charge.identifier}/qrcode?format=base64`,
        { headers: { Authorization: OPENPIX_APP_ID } },
      );
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        const raw = imgData.qrcodeBase64 || imgData.base64 || imgData.imageBase64;
        if (raw) qr_code_base64 = raw.replace(/^data:image\/[a-z]+;base64,/, "");
      }
    } catch (_) { /* ignore */ }

    await admin.from("payments").update({
      gateway_reference: charge.identifier,
      metadata: {
        type: "ct_subscription",
        ct_client_id: ctClient.id,
        plan_id: planId,
        plan_name: plan.name,
        openpix_charge_id: charge.identifier,
      },
    }).eq("id", payment.id);

    return json({
      ok: true,
      method: "pix",
      ct_client_id: ctClient.id,
      payment_id: payment.id,
      qr_code: charge.brCode,
      qr_code_base64,
      payment_link: charge.paymentLinkUrl,
      expires_at: trialEnds.toISOString(),
    });
  } catch (err) {
    console.error("[ct-subscribe] error:", err);
    return json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}