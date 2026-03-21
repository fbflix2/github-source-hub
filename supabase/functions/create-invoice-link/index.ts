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
    if (!MERCADOPAGO_ACCESS_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");

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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const staffId = claimsData.claims.sub as string;

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
        gateway: "mercadopago",
        status: "pending",
        metadata: { type: "invoice_link", invoice_code: invoiceCode },
      })
      .select("id")
      .single();

    if (payErr) {
      console.error("Payment insert error:", payErr);
      throw new Error("Erro ao criar pagamento");
    }

    // Generate PIX via Mercado Pago
    const payerEmail = `cliente-${client_user_id.slice(0, 8)}@pagamento.com`;
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": payment.id,
      },
      body: JSON.stringify({
        transaction_amount: Number(amount),
        description: `Cobrança - ${product_name} - ${invoiceCode}`,
        payment_method_id: "pix",
        payer: { email: payerEmail },
        external_reference: payment.id,
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
      }),
    });

    const mpData = await mpResponse.json();
    if (!mpResponse.ok) {
      console.error("MP error:", JSON.stringify(mpData));
      throw new Error(`Erro Mercado Pago: ${mpResponse.status}`);
    }

    // Update payment with MP reference
    await supabaseAdmin
      .from("payments")
      .update({
        gateway_reference: String(mpData.id),
        metadata: { type: "invoice_link", invoice_code: invoiceCode, mp_payment_id: String(mpData.id) },
      })
      .eq("id", payment.id);

    const pixData = mpData.point_of_interaction?.transaction_data;

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
        mp_payment_id: String(mpData.id),
        qr_code: pixData?.qr_code || null,
        qr_code_base64: pixData?.qr_code_base64 || null,
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
