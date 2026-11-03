import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildWooviCustomer } from "../_shared/woovi-customer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sanitizeOpenPixComment = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .,_\-\/]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
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

    const { client_user_id, client_name, client_email, product_name, product_id, amount, reference_date, description, order_id } = await req.json();

    if (!client_user_id || !product_name || !amount || amount < 1) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (order_id) {
      const { data: target, error: targetError } = await supabaseAdmin.from("orders")
        .select("id,user_id,status,total,code").eq("id", order_id).maybeSingle();
      if (targetError || !target || !String(target.code || "").startsWith("VND-") ||
          target.user_id !== client_user_id || target.status !== "pending_payment" ||
          Math.abs(Number(target.total) - Number(amount)) > 0.01) {
        return new Response(JSON.stringify({ error: "Venda não está pendente ou valor/cliente não corresponde. Salve a correção antes de gerar PIX." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: previousPayments, error: previousError } = await supabaseAdmin.from("payments")
        .select("id,status").eq("order_id", order_id);
      if (previousError || (previousPayments || []).some(p => !["failed", "cancelled", "expired", "rejected"].includes(String(p.status).toLowerCase()))) {
        return new Response(JSON.stringify({ error: "Já existe uma cobrança ou pagamento vinculado a esta venda. Verifique antes de gerar outro PIX." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create invoice link record
    const invoiceCode = `INV-${Date.now().toString(36).toUpperCase()}`;
    // Cobranças avulsas são emitidas pela FBFlix (revendedores só vendem proxy).
    const APP_ID = OPENPIX_APP_ID;
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const openPixComment = sanitizeOpenPixComment(`Cobranca - ${product_name} - ${invoiceCode}`);

    // Create payment record for this invoice
    const paymentCode = `PIX-INV-${Date.now()}`;
    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: client_user_id,
        ...(order_id ? { order_id } : {}),
        amount: Number(amount),
        code: paymentCode,
        gateway: "openpix",
        status: "pending",
        metadata: { type: "invoice_link", invoice_code: invoiceCode, gateway_owner: "fbflix", ...(order_id ? { order_id } : {}) },
      })
      .select("id")
      .single();

    if (payErr) {
      console.error("Payment insert error:", payErr);
      throw new Error("Erro ao criar pagamento");
    }

    const wooviCustomer = await buildWooviCustomer(supabaseAdmin as any, client_user_id);
    if (!wooviCustomer) {
      console.warn("[create-invoice-link] Cliente sem dados fiscais completos — NFS-e automática indisponível");
    }

    // Create OpenPix Charge
    const openPixResponse = await fetch("https://api.openpix.com.br/api/v1/charge", {
      method: "POST",
      headers: {
        Authorization: APP_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        correlationID: payment.id,
        value: Math.round(Number(amount) * 100), // Em centavos
        comment: openPixComment,
        ...(wooviCustomer ? { customer: wooviCustomer } : {}),
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
        headers: { Authorization: APP_ID }
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
          ...(order_id ? { order_id } : {}),
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
