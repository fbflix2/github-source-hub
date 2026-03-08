import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const rawEmail = (claimsData.claims.email as string) || "cliente@email.com";
    
    // Mercado Pago blocks payments where payer email = seller email.
    const userEmail = `comprador-${userId.slice(0, 8)}@pagamento.com`;

    const { amount, order_id, proxy_data } = await req.json();
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount < 1) {
      return new Response(JSON.stringify({ error: "Valor mínimo: R$ 1,00" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create payment record
    const paymentCode = `PIX-${Date.now()}`;
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        amount: numericAmount,
        code: paymentCode,
        gateway: "mercadopago",
        status: "pending",
        order_id: order_id || null,
        metadata: { type: order_id ? "order_payment" : "wallet_recharge" },
      })
      .select("id")
      .single();

    if (paymentError) {
      console.error("Payment insert error:", paymentError);
      throw new Error("Erro ao criar pagamento");
    }

    // If proxy_data is provided, persist it to order_items.delivery_data using service_role
    if (proxy_data && order_id) {
      console.log(`[create-pix-payment] Persisting proxy_data for order ${order_id}:`, JSON.stringify(proxy_data));
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Get order items for this order
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
        console.log(`[create-pix-payment] delivery_data saved for order_item ${orderItems[0].id}`);
      }
    }

    // Create Mercado Pago PIX payment
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
        payment_method_id: "pix",
        payer: { email: userEmail },
        external_reference: payment.id,
        notification_url: `https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1/mercadopago-webhook`,
      }),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago error:", JSON.stringify(mpData));
      throw new Error(`Erro Mercado Pago [${mpResponse.status}]: ${JSON.stringify(mpData)}`);
    }

    // Update payment with gateway reference (use admin client to bypass RLS)
    const supabaseAdminForUpdate = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await supabaseAdminForUpdate
      .from("payments")
      .update({
        gateway_reference: String(mpData.id),
        metadata: {
          type: order_id ? "order_payment" : "wallet_recharge",
          mp_status: mpData.status,
          mp_payment_id: String(mpData.id),
        },
      })
      .eq("id", payment.id);

    const pixData = mpData.point_of_interaction?.transaction_data;

    return new Response(
      JSON.stringify({
        payment_id: payment.id,
        mp_payment_id: mpData.id,
        qr_code: pixData?.qr_code || null,
        qr_code_base64: pixData?.qr_code_base64 || null,
        ticket_url: pixData?.ticket_url || null,
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
