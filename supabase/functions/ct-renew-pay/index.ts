import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildWooviCustomer } from "../_shared/woovi-customer.ts";
import { resolveOpenPixGateway } from "../_shared/openpix-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Sessão inválida" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "pix");
    const ctClientId = String(body?.ct_client_id || "");
    if (!ctClientId) return json({ error: "ct_client_id obrigatório" }, 400);

    const { data: ctClient } = await admin
      .from("ct_clients")
      .select("id, user_id, monthly_value, status, next_billing, plan_id, last_payment_id")
      .eq("id", ctClientId)
      .maybeSingle();
    if (!ctClient) return json({ error: "Assinatura não encontrada" }, 404);

    const { data: role } = await admin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role && ctClient.user_id !== userId) return json({ error: "Sem permissão" }, 403);

    const price = Number(ctClient.monthly_value || 0);
    if (price <= 0) return json({ error: "Valor mensal inválido" }, 400);

    // ===== Confirma renovação (usado após pagamento com cartão / PIX) =====
    if (action === "confirm") {
      const paymentId = String(body?.payment_id || "");
      if (!paymentId) return json({ error: "payment_id obrigatório" }, 400);

      const { data: payment } = await admin
        .from("payments")
        .select("id, user_id, amount, status")
        .eq("id", paymentId)
        .maybeSingle();
      if (!payment || payment.user_id !== ctClient.user_id) {
        return json({ error: "Pagamento não encontrado" }, 404);
      }
      if (payment.status !== "completed") {
        return json({ ok: false, pending: true });
      }
      const result = await applyRenewal(admin, ctClient, paymentId);
      return json({ ok: true, ...result });
    }

    // ===== PIX =====
    const OPENPIX_APP_ID = Deno.env.get("OPENPIX_APP_ID");
    if (!OPENPIX_APP_ID) return json({ error: "PIX indisponível no momento" }, 500);
    const gw = await resolveOpenPixGateway(admin, { userId: ctClient.user_id });
    const APP_ID = gw.appId || OPENPIX_APP_ID;

    const { data: payment, error: payErr } = await admin
      .from("payments")
      .insert({
        user_id: ctClient.user_id,
        amount: price,
        code: `CTR-${Date.now()}`,
        gateway: "openpix",
        status: "pending",
        metadata: { type: "ct_renewal", ct_client_id: ctClient.id, reseller_id: gw.resellerId, gateway_owner: gw.owner },
      })
      .select("id")
      .single();
    if (payErr) throw payErr;

    const wooviCustomer = await buildWooviCustomer(admin as any, ctClient.user_id);
    const chargeRes = await fetch("https://api.openpix.com.br/api/v1/charge", {
      method: "POST",
      headers: { Authorization: APP_ID, "Content-Type": "application/json" },
      body: JSON.stringify({
        correlationID: payment.id,
        value: Math.round(price * 100),
        comment: "Mensalidade Scale Pro".replace(/[^\x20-\x7E]/g, ""),
        expiresIn: 60 * 60 * 24,
        ...(wooviCustomer ? { customer: wooviCustomer } : {}),
      }),
    });
    const opData = await chargeRes.json();
    if (!chargeRes.ok) {
      console.error("[ct-renew-pay] OpenPix error:", opData);
      throw new Error("Falha ao gerar PIX");
    }
    const charge = opData.charge || opData;

    let qr_code_base64: string | null = null;
    try {
      const imgRes = await fetch(
        `https://api.openpix.com.br/api/v1/charge/${charge.identifier}/qrcode?format=base64`,
        { headers: { Authorization: APP_ID } },
      );
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        const raw = imgData.qrcodeBase64 || imgData.base64 || imgData.imageBase64;
        if (raw) qr_code_base64 = raw.replace(/^data:image\/[a-z]+;base64,/, "");
      }
    } catch (_) { /* ignore */ }

    await admin.from("payments").update({
      gateway_reference: charge.identifier,
      metadata: { type: "ct_renewal", ct_client_id: ctClient.id, openpix_charge_id: charge.identifier, reseller_id: gw.resellerId, gateway_owner: gw.owner },
    }).eq("id", payment.id);

    return json({
      ok: true,
      method: "pix",
      payment_id: payment.id,
      qr_code: charge.brCode,
      qr_code_base64,
      payment_link: charge.paymentLinkUrl,
      amount: price,
    });
  } catch (err) {
    console.error("[ct-renew-pay] error:", err);
    return json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, 500);
  }
});

async function applyRenewal(admin: any, ctClient: any, paymentId: string) {
  // Idempotência: se este pagamento já renovou, não soma de novo
  if (ctClient.last_payment_id === paymentId) {
    return { already_applied: true, next_billing: ctClient.next_billing };
  }

  const base = new Date();
  if (ctClient.next_billing) {
    const cur = new Date(ctClient.next_billing);
    if (cur.getTime() > base.getTime()) base.setTime(cur.getTime());
  }
  base.setDate(base.getDate() + 30);
  const nextBilling = base.toISOString().slice(0, 10);
  const wasSuspenso = ctClient.status === "suspenso";

  await admin.from("ct_clients").update({
    status: "ativo",
    next_billing: nextBilling,
    last_payment_id: paymentId,
    last_payment_at: new Date().toISOString(),
  }).eq("id", ctClient.id);

  await admin.from("notifications").insert({
    title: wasSuspenso ? "Scale Pro reativada" : "Mensalidade Scale Pro paga",
    message: `Assinatura renovada até ${nextBilling}.`,
    type: "subscription",
    global: true,
  });

  return { next_billing: nextBilling, reactivated: wasSuspenso };
}
