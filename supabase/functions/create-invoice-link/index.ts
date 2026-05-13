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
    if (!OPENPIX_APP_ID) throw new Error("OPENPIX_APP_ID não configurado");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const staffId = userData.user.id;

    // Check staff
    const { data: isStaff } = await supabase.rpc("is_staff", { _user_id: staffId });
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_user_id, client_name, client_email, product_name, product_id, amount, reference_date, description } = await req.json();

    if (!client_user_id || !product_name || !amount || amount < 1) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create invoice link record
    const invoiceCode = `INV-${Date.now().toString(36).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // Create payment record for this invoice
    const paymentCode = `PIX-INV-${Date.now()}`;
    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: client_user_id,
        amount: Number(amount),
        code: paymentCode,
        gateway: "openpix",
        status: "pending",
        metadata: { type: "invoice_link", invoice_code: invoiceCode },
      })
      .select("id")
      .single();

    if (payErr) {
      console.error("Payment insert error:", payErr);
      throw new Error("Erro ao criar pagamento");
    }

    // Create OpenPix Charge
    const openPixResponse = await fetch("https://api.openpix.com.br/api/v1/charge", {
      method: "POST",
      headers: {
        Authorization: OPENPIX_APP_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        correlationID: payment.id,
        value: Math.round(Number(amount) * 100), // Em centavos
        comment: `Cobrança - ${product_name} - ${invoiceCode}`,
      }),
    });

    const opData = await openPixResponse.json();
    if (!openPixResponse.ok) {
      console.error("OpenPix error:", JSON.stringify(opData));
      throw new Error(`Erro OpenPix: ${openPixResponse.status}`);
    }

    const charge = opData.charge || opData;

    // Fetch QR Code base64
    let qr_code_base64 = null;
    try {
      const imgRes = await fetch(`https://api.openpix.com.br/api/v1/charge/${charge.identifier}/qrcode?format=base64`, {
        headers: { Authorization: OPENPIX_APP_ID }
      });
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        const rawBase64 = imgData.qrcodeBase64 || imgData.base64 || imgData.imageBase64;
        if (rawBase64) {
          qr_code_base64 = rawBase64.replace(/^data:image\/[a-z]+;base64,/, "");
        }
      }
    } catch (e) {
      console.error("Error fetching QR base64:", e);
    }

    if (!qr_code_base64 && charge.qrCodeImage) {
      qr_code_base64 = charge.qrCodeImage;
    }

    // Update payment with OpenPix reference
    await supabaseAdmin
      .from("payments")
      .update({
        gateway_reference: charge.identifier,
        metadata: { 
          type: "invoice_link", 
          invoice_code: invoiceCode, 
          openpix_charge_id: charge.identifier 
        },
      })
      .eq("id", payment.id);

    // Create invoice link
    const { data: invoice, error: invErr } = await supabaseAdmin
      .from("invoice_links")
      .insert({
        code: invoiceCode,
        client_user_id,
        client_name: client_name || null,
        client_email: client_email || null,
        product_name,
        product_id: product_id || null,
        amount: Number(amount),
        reference_date: reference_date || new Date().toISOString().split("T")[0],
        description: description || null,
        status: "pending",
        payment_id: payment.id,
        mp_payment_id: charge.identifier, // Reusing field to store identifier
        qr_code: charge.brCode || null,
        qr_code_base64: qr_code_base64 || null,
        expires_at: expiresAt,
        created_by: staffId,
      })
      .select()
      .single();

    if (invErr) {
      console.error("Invoice insert error:", invErr);
      throw new Error("Erro ao criar cobrança");
    }

    return new Response(JSON.stringify({ success: true, invoice }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
