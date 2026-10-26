import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildWooviCustomer } from "../_shared/woovi-customer.ts";
import { resolveOpenPixGateway } from "../_shared/openpix-gateway.ts";

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
    const { amount, order_id, proxy_data, reseller_id } = await req.json();
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount < 1) {
      return new Response(JSON.stringify({ error: "Valor mínimo: R$ 1,00" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Resolve gateway credentials (reseller-aware) ---
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Blackproxy-only safety rule: never charge FBFLIX's OpenPix for a
    // customer order belonging to this reseller. Other resellers are unchanged.
    const BLACKPROXY_RESELLER_ID = "67b6094f-2988-497f-b666-3d4e9620cb0d";
    if (order_id) {
      const { data: orderOwner, error: orderOwnerError } = await adminClient
        .from("orders")
        .select("reseller_id, user_id")
        .eq("id", order_id)
        .maybeSingle();
      if (orderOwnerError) throw orderOwnerError;
      if (orderOwner?.reseller_id === BLACKPROXY_RESELLER_ID) {
        if (orderOwner.user_id !== userId) {
          return new Response(JSON.stringify({ error: "Pedido não pertence ao usuário autenticado" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: blackproxy, error: gatewayError } = await adminClient
          .from("resellers")
          .select("gateway_provider, gateway_openpix_app_id, gateway_mp_access_token, status")
          .eq("id", BLACKPROXY_RESELLER_ID)
          .maybeSingle();
        if (gatewayError) throw gatewayError;
        const ownOpenPix = blackproxy?.gateway_provider === "openpix" &&
          Boolean(String(blackproxy.gateway_openpix_app_id || "").trim()) &&
          ["active", "warning"].includes(String(blackproxy.status));
        const ownMp = blackproxy?.gateway_provider === "mercadopago" &&
          String(blackproxy.gateway_mp_access_token || "").trim().length > 20 &&
          ["active", "warning"].includes(String(blackproxy.status));
        if (ownMp) {
          return await createResellerMpPix({
            adminClient, supabase, userId, numericAmount, order_id, proxy_data,
            resellerId: BLACKPROXY_RESELLER_ID,
            accessToken: String(blackproxy!.gateway_mp_access_token).trim(),
            email: userData.user.email || "",
          });
        }
        if (!ownOpenPix) {
          const message = blackproxy?.gateway_provider === "mercadopago"
            ? "A Blackproxy selecionou Mercado Pago, mas o checkout PIX Mercado Pago ainda não está integrado. Nenhuma cobrança foi criada na FBFLIX."
            : "A Blackproxy precisa configurar e ativar seu próprio gateway antes de receber pagamentos.";
          return new Response(JSON.stringify({ error: message }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const gw = await resolveOpenPixGateway(adminClient, {
      userId,
      resellerId: reseller_id || null,
      orderId: order_id || null,
    });
    if (order_id) {
      const { data: orderOwner } = await adminClient.from("orders").select("reseller_id").eq("id", order_id).maybeSingle();
      if (orderOwner?.reseller_id === BLACKPROXY_RESELLER_ID && (gw.owner !== "reseller" || gw.resellerId !== BLACKPROXY_RESELLER_ID)) {
        return new Response(JSON.stringify({ error: "Gateway próprio da Blackproxy não pôde ser validado. Cobrança não criada." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const effectiveAppId = gw.appId || OPENPIX_APP_ID;
    const effectiveResellerId = gw.resellerId;

    // Make sure the order carries reseller_id (in case autofill did not run)
    if (effectiveResellerId && order_id) {
      await adminClient
        .from("orders")
        .update({ reseller_id: effectiveResellerId })
        .eq("id", order_id)
        .is("reseller_id", null);
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
        metadata: {
          type: order_id ? "order_payment" : "wallet_recharge",
          reseller_id: effectiveResellerId,
          gateway_owner: gw.owner,
        },
      })
      .select("id")
      .single();

    if (paymentError) {
      console.error("Payment insert error:", paymentError);
      throw new Error("Erro ao criar pagamento");
    }

    // Persist proxy_data if provided
    if (proxy_data && order_id) {
      const { data: orderItems } = await adminClient
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
        await adminClient
          .from("order_items")
          .update({ delivery_data: deliveryData })
          .eq("id", orderItems[0].id);
      }
    }

    // Create OpenPix Charge
    // Ref: https://developers.openpix.com.br/api#tag/charge/paths/~1api~1v1~1charge/post
    const wooviCustomer = await buildWooviCustomer(adminClient as any, userId);
    if (!wooviCustomer) {
      console.warn("[create-pix-payment] Perfil sem dados fiscais completos — NFS-e automática indisponível");
    }
    const createCharge = (withCustomer: boolean) =>
      fetch("https://api.openpix.com.br/api/v1/charge", {
        method: "POST",
        headers: {
          Authorization: effectiveAppId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          correlationID: payment.id,
          value: Math.round(numericAmount * 100), // In cents
          comment: order_id ? `Pedido - ${paymentCode}` : `Recarga de saldo - ${paymentCode}`,
          ...(withCustomer && wooviCustomer ? { customer: wooviCustomer } : {}),
        }),
      });

    let openPixResponse = await createCharge(true);
    let opData = await openPixResponse.json();

    // Se a Woovi recusar os dados fiscais do cliente, gera a cobrança sem o bloco
    // customer (o PIX funciona; apenas a NFS-e automática fica indisponível).
    if (!openPixResponse.ok && wooviCustomer && /CPF|CNPJ|customer/i.test(JSON.stringify(opData))) {
      console.warn("[create-pix-payment] Woovi recusou customer, refazendo sem dados fiscais:", JSON.stringify(opData));
      openPixResponse = await createCharge(false);
      opData = await openPixResponse.json();
    }

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
        headers: { Authorization: effectiveAppId }
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
    await adminClient
      .from("payments")
      .update({
        gateway_reference: charge.identifier,
        metadata: {
          type: order_id ? "order_payment" : "wallet_recharge",
          reseller_id: effectiveResellerId,
          gateway_owner: effectiveResellerId && effectiveAppId !== OPENPIX_APP_ID ? "reseller" : "fbflix",
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
