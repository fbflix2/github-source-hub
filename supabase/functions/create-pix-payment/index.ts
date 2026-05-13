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
    const OPENPIX_APP_ID = Deno.env.get("OPENPIX_APP_ID");
    if (!OPENPIX_APP_ID) {
      throw new Error("OPENPIX_APP_ID não configurado");
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
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
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
        gateway: "openpix",
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

    // Persist proxy_data if provided
    if (proxy_data && order_id) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
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

    // Create OpenPix Charge
    // Ref: https://developers.openpix.com.br/api#tag/charge/paths/~1api~1v1~1charge/post
    const openPixResponse = await fetch("https://api.openpix.com.br/api/v1/charge", {
      method: "POST",
      headers: {
        Authorization: OPENPIX_APP_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        correlationID: payment.id,
        value: Math.round(numericAmount * 100), // In cents
        comment: order_id ? `Pedido - ${paymentCode}` : `Recarga de saldo - ${paymentCode}`,
      }),
    });

    const opData = await openPixResponse.json();

    if (!openPixResponse.ok) {
      console.error("OpenPix error:", JSON.stringify(opData));
      throw new Error(`Erro OpenPix [${openPixResponse.status}]: ${JSON.stringify(opData)}`);
    }

    console.log("OpenPix response:", JSON.stringify(opData));

    const charge = opData.charge || opData;
    
    // OpenPix returns the charge identifier and brCode.
    // To get the image, we can use the dedicated endpoint or the one returned in the charge.
    // OpenPix returns the charge identifier and brCode.
    // We'll prioritize the official Base64 endpoint, falling back to the image URL
    let qr_code_base64 = null;
    
    try {
      // Try official v1 endpoint for base64 qrcode
      const imgResponse = await fetch(`https://api.openpix.com.br/api/v1/charge/${charge.identifier}/qrcode?format=base64`, {
        headers: { Authorization: OPENPIX_APP_ID }
      });
      
      if (imgResponse.ok) {
        const imgData = await imgResponse.json();
        // The field in v1 is usually 'qrcodeBase64' or 'base64'
        const rawBase64 = imgData.qrcodeBase64 || imgData.base64 || imgData.imageBase64;
        if (rawBase64) {
          qr_code_base64 = rawBase64.replace(/^data:image\/[a-z]+;base64,/, "");
        }
      }
    } catch (e) {
      console.error("Error fetching QR base64:", e);
    }

    // Fallback: If no base64, use the URL provided in the charge
    if (!qr_code_base64 && charge.qrCodeImage) {
      qr_code_base64 = charge.qrCodeImage;
    }

    // Update payment with gateway reference
    const supabaseAdminForUpdate = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await supabaseAdminForUpdate
      .from("payments")
      .update({
        gateway_reference: charge.identifier,
        metadata: {
          type: order_id ? "order_payment" : "wallet_recharge",
          openpix_charge_id: charge.identifier,
          openpix_status: charge.status,
        },
      })
      .eq("id", payment.id);

    return new Response(
      JSON.stringify({
        payment_id: payment.id,
        openpix_charge_id: charge.identifier,
        qr_code: charge.brCode,
        qr_code_base64: qr_code_base64,
        payment_link: charge.paymentLinkUrl,
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
