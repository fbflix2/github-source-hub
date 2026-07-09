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
      .select("id, name, price, active, profiles_qty, combo_config")
      .eq("id", planId)
      .maybeSingle();
    if (planErr || !plan) return json({ error: "Plano não encontrado" }, 404);
    if (plan.active === false) return json({ error: "Plano indisponível" }, 400);

    // Block if already has an active/trial subscription
    const { data: existing } = await admin
      .from("ct_clients")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["ativo", "trial"])
      .maybeSingle();
    if (existing) {
      return json({ error: "Você já possui uma assinatura ativa." }, 400);
    }

    // Cancela qualquer tentativa anterior de PIX pendente para não bloquear nova compra
    const { data: pendings } = await admin
      .from("ct_clients")
      .select("id, last_payment_id")
      .eq("user_id", userId)
      .eq("status", "pendente_pagamento");
    if (pendings && pendings.length > 0) {
      const pendingIds = pendings.map((p: any) => p.id);
      const paymentIds = pendings.map((p: any) => p.last_payment_id).filter(Boolean);
      await admin.from("ct_clients").update({ status: "cancelado" }).in("id", pendingIds);
      if (paymentIds.length > 0) {
        await admin.from("payments").update({ status: "cancelled" }).in("id", paymentIds).eq("status", "pending");
      }
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

      // Auto-atribuir proxies inclusos do pool (1 por perfil)
      const proxyResult = await assignPoolProxies(admin, {
        ctClientId: ctClient.id,
        userId,
        qty: Number((plan as any).profiles_qty || 1),
        planName: plan.name,
      });
      const comboResult = await assignPoolComboItems(admin, {
        ctClientId: ctClient.id,
        userId,
        planId: plan.id,
        comboConfig: ((plan as any).combo_config as any) || {},
        planName: plan.name,
      });
      const comboSummaryText = Object.entries(comboResult)
        .map(([t, v]: any) => `${t}: ${v.assigned}${v.missing ? `/${v.missing} faltam` : ""}`)
        .join(", ");

      await admin.from("notifications").insert({
        title: "Nova assinatura CT",
        message: `${profile?.full_name || "Cliente"} assinou o plano ${plan.name} (R$ ${price.toFixed(2)}) via saldo. Proxies: ${proxyResult.assigned}${proxyResult.missing ? ` (faltam ${proxyResult.missing})` : ""}${comboSummaryText ? `. Combo — ${comboSummaryText}` : ""}.`,
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
        comment: `Scale Pro - ${plan.name}`.replace(/[^\x20-\x7E]/g, ""),
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

/**
 * Auto-atribui proxies inclusos do pool à assinatura Scale Pro ativada.
 * - Pega até `qty` proxies do pool (user_id IS NULL, status=available, sem vínculo Scale Pro)
 * - Vincula ao cliente e à ct_client (auto_renew desligado — a assinatura mãe cobre)
 * - Se pool insuficiente, notifica admin
 */
export async function assignPoolProxies(
  admin: ReturnType<typeof createClient>,
  params: { ctClientId: string; userId: string; qty: number; planName?: string },
) {
  const { ctClientId, userId, qty, planName } = params;
  if (!qty || qty < 1) return { assigned: 0, missing: 0 };

  const { data: pool } = await admin
    .from("subscriptions")
    .select("id")
    .in("type", ["proxyfbflix"])
    .is("user_id", null)
    .is("included_in_ct_client_id", null)
    .eq("status", "available")
    .limit(qty);

  const available = pool || [];
  let assigned = 0;

  for (const p of available) {
    const { error: updErr } = await admin
      .from("subscriptions")
      .update({
        user_id: userId,
        included_in_ct_client_id: ctClientId,
        auto_renew: false,
        status: "active",
      })
      .eq("id", p.id)
      .is("user_id", null); // guard contra corrida
    if (updErr) continue;
    await admin.from("ct_client_proxies").insert({
      ct_client_id: ctClientId,
      subscription_id: p.id,
    });
    assigned++;
  }

  const missing = Math.max(0, qty - assigned);
  if (missing > 0) {
    await admin.from("notifications").insert({
      title: "Pool de proxies Scale Pro insuficiente",
      message: `Faltam ${missing} proxy(s) para o plano ${planName || ""}. Atribuir manualmente ao cliente ${userId}.`,
      type: "subscription",
      global: true,
    });
  }

  return { assigned, missing };
}

/**
 * Atribui itens do combo (perfil/bm/pagina/ad_account) do pool à assinatura Scale Pro.
 * Prioriza reservas manuais para o usuário; depois o pool geral do plano.
 */
export async function assignPoolComboItems(
  admin: ReturnType<typeof createClient>,
  params: { ctClientId: string; userId: string; planId: string; comboConfig: Record<string, number>; planName?: string },
) {
  const { ctClientId, userId, planId, comboConfig, planName } = params;
  const summary: Record<string, { assigned: number; missing: number }> = {};
  const types = ["perfil", "bm", "pagina", "ad_account"] as const;

  for (const type of types) {
    const qty = Number(comboConfig?.[type] || 0);
    if (!qty || qty < 1) continue;

    const { data: reserved } = await admin
      .from("ct_pool_items")
      .select("id")
      .eq("plan_id", planId)
      .eq("type", type)
      .eq("status", "reserved")
      .eq("reserved_for_user_id", userId)
      .limit(qty);
    const picked: string[] = (reserved || []).map((r: any) => r.id);

    if (picked.length < qty) {
      const { data: available } = await admin
        .from("ct_pool_items")
        .select("id")
        .eq("plan_id", planId)
        .eq("type", type)
        .eq("status", "available")
        .limit(qty - picked.length);
      picked.push(...(available || []).map((r: any) => r.id));
    }

    let assigned = 0;
    for (const id of picked) {
      const { data: upd, error: updErr } = await admin
        .from("ct_pool_items")
        .update({
          status: "assigned",
          assigned_ct_client_id: ctClientId,
          assigned_at: new Date().toISOString(),
          released_at: null,
        })
        .eq("id", id)
        .in("status", ["available", "reserved"])
        .select("id, identifier, metadata, type")
        .maybeSingle();
      if (updErr || !upd) continue;
      await admin.from("ct_items").insert({
        ct_client_id: ctClientId,
        type: upd.type,
        identifier: upd.identifier,
        metadata: { ...(upd.metadata || {}), pool_item_id: upd.id },
        status: "ativo",
      });
      assigned++;
    }
    const missing = Math.max(0, qty - assigned);
    summary[type] = { assigned, missing };
    if (missing > 0) {
      await admin.from("notifications").insert({
        title: `Pool Scale Pro insuficiente (${type})`,
        message: `Faltam ${missing} ${type}(s) para o plano ${planName || ""}. Cadastre ou atribua manualmente ao cliente ${userId}.`,
        type: "subscription", global: true,
      });
    }
  }
  return summary;
}