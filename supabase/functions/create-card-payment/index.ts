import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SAFE_BM_PRODUCT_ID = "e5118c63-ed52-4f4e-8983-f44c1ba0d17b";

async function fulfillMissingStockItems(supabaseAdmin: any, orderId: string) {
  const { data: orderItems, error: itemsError } = await supabaseAdmin
    .from("order_items")
    .select("id, product_id, delivery_data")
    .eq("order_id", orderId);

  if (itemsError) throw itemsError;
  let fulfilledCount = 0;

  for (const oi of orderItems || []) {
    if (!oi.product_id || oi.product_id === SAFE_BM_PRODUCT_ID) continue;
    const deliveryData = oi.delivery_data && typeof oi.delivery_data === "object" ? oi.delivery_data : null;
    if (deliveryData?.type || deliveryData?.bmLinks || deliveryData?.linkPerfil || deliveryData?.idPerfil) continue;

    const { data: product } = await supabaseAdmin
      .from("products")
      .select("icon_type")
      .eq("id", oi.product_id)
      .maybeSingle();

    if (product?.icon_type === "proxy") continue;

    const { count: linkedCount } = await supabaseAdmin
      .from("stock_items")
      .select("id", { count: "exact", head: true })
      .eq("order_item_id", oi.id);

    if ((linkedCount || 0) > 0) continue;

    const { data: result, error: rpcError } = await supabaseAdmin.rpc("fulfill_order_item", {
      p_order_item_id: oi.id,
      p_product_id: oi.product_id,
    });

    if (rpcError) {
      console.error(`[create-card-payment] Fulfillment error for ${oi.id}:`, rpcError);
      continue;
    }

    if (result?.success && Number(result?.linked_count || 0) > 0) fulfilledCount += 1;
    else if (result && result.success === false) console.warn(`[create-card-payment] Fulfillment warning for ${oi.id}:`, result.error);
  }

  if (fulfilledCount > 0) {
    await supabaseAdmin.from("orders").update({ status: "completed" }).eq("id", orderId);
  }

  return fulfilledCount;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: authUserData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !authUserData?.user?.id) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authUserData.user.id;

    // Check if user has card payment enabled
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("card_payment_enabled, full_name, cpf")
      .eq("user_id", userId)
      .single();

    if (!profile?.card_payment_enabled) {
      return new Response(JSON.stringify({ error: "Pagamento via cartão não habilitado para sua conta" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get real user email
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email || `comprador-${userId.slice(0, 8)}@pagamento.com`;

    const { amount, order_id, token: cardToken, proxy_data } = await req.json();
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount < 1) {
      return new Response(JSON.stringify({ error: "Valor mínimo: R$ 1,00" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!cardToken) {
      return new Response(JSON.stringify({ error: "Token do cartão não fornecido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create payment record
    const paymentCode = `CARD-${Date.now()}`;
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        amount: numericAmount,
        code: paymentCode,
        gateway: "mercadopago",
        status: "pending",
        order_id: order_id || null,
        metadata: { type: order_id ? "order_payment" : "wallet_recharge", method: "card" },
      })
      .select("id")
      .single();

    if (paymentError) {
      console.error("Payment insert error:", paymentError);
      throw new Error("Erro ao criar pagamento");
    }

    // Persist proxy_data if provided
    if (proxy_data && order_id) {
      const { data: orderItems } = await supabaseAdmin
        .from("order_items")
        .select("id")
        .eq("order_id", order_id);

      if (orderItems && orderItems.length > 0) {
        const deliveryData = {
          type: "proxy_contract",
          product_variant_id: proxy_data.product_variant_id,
          api_product_id: proxy_data.api_product_id,
          variant_location: proxy_data.variant_location,
          quantity: proxy_data.quantity || 1,
          interval: proxy_data.interval || "monthly",
        };
        await supabaseAdmin
          .from("order_items")
          .update({ delivery_data: deliveryData })
          .eq("id", orderItems[0].id);
      }
    }

    // Create Mercado Pago card payment using token
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": payment.id,
      },
      body: JSON.stringify({
        transaction_amount: numericAmount,
        description: order_id ? `Pedido - ${paymentCode}` : `Recarga de saldo - ${paymentCode}`,
        payer: {
          email: userEmail,
          first_name: profile?.full_name?.split(" ")[0] || "Cliente",
          last_name: profile?.full_name?.split(" ").slice(1).join(" ") || "FBFLIX",
          identification: {
            type: "CPF",
            number: (profile?.cpf || "").replace(/\D/g, ""),
          },
        },
        token: cardToken,
        installments: 1,
        external_reference: payment.id,
        notification_url: `https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1/mercadopago-webhook`,
      }),
    });

    const mpData = await mpResponse.json();
    console.log("MP response status:", mpData.status, "detail:", mpData.status_detail);

    // Update payment record
    const finalStatus = mpData.status === "approved" ? "completed" : mpData.status === "in_process" ? "pending" : "failed";
    await supabaseAdmin
      .from("payments")
      .update({
        status: finalStatus,
        gateway_reference: String(mpData.id || ""),
        metadata: {
          type: order_id ? "order_payment" : "wallet_recharge",
          method: "card",
          mp_status: mpData.status,
          mp_status_detail: mpData.status_detail,
          mp_payment_id: String(mpData.id || ""),
        },
      })
      .eq("id", payment.id);

    if (mpData.status === "approved" && order_id) {
      const fulfilled = await fulfillMissingStockItems(supabaseAdmin, order_id);
      console.log(`[create-card-payment] Auto-fulfilled ${fulfilled} stock item(s) for order ${order_id}`);
    }

    if (!mpResponse.ok && mpData.status !== "approved") {
      console.error("Mercado Pago card error:", JSON.stringify(mpData));
      
      const rejectionMessages: Record<string, string> = {
        cc_rejected_bad_filled_card_number: "Número do cartão inválido",
        cc_rejected_bad_filled_date: "Data de validade inválida",
        cc_rejected_bad_filled_other: "Dados do cartão incorretos",
        cc_rejected_bad_filled_security_code: "CVV inválido",
        cc_rejected_blacklist: "Cartão não autorizado",
        cc_rejected_call_for_authorize: "Ligue para o banco para autorizar",
        cc_rejected_card_disabled: "Cartão desabilitado",
        cc_rejected_duplicated_payment: "Pagamento duplicado",
        cc_rejected_high_risk: "Pagamento recusado por segurança",
        cc_rejected_insufficient_amount: "Saldo insuficiente no cartão",
        cc_rejected_max_attempts: "Limite de tentativas atingido",
        cc_rejected_other_reason: "Pagamento recusado pelo banco",
      };

      const userMessage = rejectionMessages[mpData.status_detail] || `Pagamento recusado: ${mpData.status_detail || "erro desconhecido"}`;

      return new Response(JSON.stringify({
        error: userMessage,
        status: mpData.status,
        status_detail: mpData.status_detail,
        payment_id: payment.id,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        payment_id: payment.id,
        mp_payment_id: mpData.id,
        status: mpData.status,
        status_detail: mpData.status_detail,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
