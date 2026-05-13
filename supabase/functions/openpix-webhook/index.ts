import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SAFE_BM_PRODUCT_ID = "e5118c63-ed52-4f4e-8983-f44c1ba0d17b";

async function fulfillMissingStockItems(supabase: any, orderId: string) {
  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("id, product_id, delivery_data")
    .eq("order_id", orderId);

  if (itemsError) throw itemsError;
  let fulfilledCount = 0;

  for (const oi of orderItems || []) {
    if (!oi.product_id || oi.product_id === SAFE_BM_PRODUCT_ID) continue;
    const deliveryData = oi.delivery_data && typeof oi.delivery_data === "object" ? oi.delivery_data : null;
    if (deliveryData?.type || deliveryData?.bmLinks || deliveryData?.linkPerfil || deliveryData?.idPerfil) continue;

    const { data: product } = await supabase
      .from("products")
      .select("icon_type")
      .eq("id", oi.product_id)
      .maybeSingle();

    if (product?.icon_type === "proxy") continue;

    const { count: linkedCount } = await supabase
      .from("stock_items")
      .select("id", { count: "exact", head: true })
      .eq("order_item_id", oi.id);

    if ((linkedCount || 0) > 0) continue;

    const { data: result, error: rpcError } = await supabase.rpc("fulfill_order_item", {
      p_order_item_id: oi.id,
      p_product_id: oi.product_id,
    });

    if (rpcError) {
      console.error(`[openpix-webhook] Catch-up fulfillment error for ${oi.id}:`, rpcError);
      continue;
    }

    if (result?.success && Number(result?.linked_count || 0) > 0) fulfilledCount += 1;
    else if (result && result.success === false) console.warn(`[openpix-webhook] Catch-up fulfillment warning for ${oi.id}:`, result.error);
  }

  if (fulfilledCount > 0) {
    await supabase.from("orders").update({ status: "completed" }).eq("id", orderId);
  }

  return fulfilledCount;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENPIX_APP_ID = Deno.env.get("OPENPIX_APP_ID");
    if (!OPENPIX_APP_ID) {
      throw new Error("OPENPIX_APP_ID não configurado");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      console.error("Erro ao processar JSON:", e);
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    console.log("OpenPix Webhook received:", JSON.stringify(body));

    const event = body.event;
    
    // OpenPix sends a test event when creating a webhook
    if (event === "OPENPIX:TEST") {
       return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if it is a completed charge
    if (event !== "OPENPIX:CHARGE_COMPLETED" && event !== "CHARGE_COMPLETED") {
      console.log("Ignorando evento OpenPix:", event);
      return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const charge = body.charge || body.pix; // Adjust based on OpenPix payload
    const paymentId = charge?.correlationID;
    
    if (!paymentId) {
      console.error("No correlationID found in OpenPix webhook");
      return new Response(JSON.stringify({ error: "Missing correlationID" }), { status: 400 });
    }

    console.log("Processing OpenPix payment ID (correlationID):", paymentId);

    // Fetch existing payment
    const { data: existingPayment, error: fetchError } = await supabase
      .from("payments")
      .select("id, status, user_id, amount, order_id, metadata")
      .eq("id", paymentId)
      .single();

    if (fetchError || !existingPayment) {
      console.error("Payment not found in database:", paymentId, fetchError);
      return new Response(JSON.stringify({ error: "Payment not found" }), { status: 404 });
    }

    if (existingPayment.status === "completed") {
      console.log("Payment already marked as completed:", paymentId);
      if (existingPayment.order_id) {
        await fulfillMissingStockItems(supabase, existingPayment.order_id);
      }
      return new Response(JSON.stringify({ received: true, already_processed: true }), { status: 200 });
    }

    // Atomic update to mark as completed
    const { data: updatedPayment, error: updateError } = await supabase
      .from("payments")
      .update({
        status: "completed",
        gateway_reference: charge?.identifier || charge?.txId || charge?.id,
        metadata: {
          ...(typeof existingPayment.metadata === 'object' ? existingPayment.metadata : {}),
          openpix_event: event,
          openpix_charge_id: charge?.identifier,
          openpix_status: "COMPLETED",
        },
      })
      .eq("id", paymentId)
      .neq("status", "completed")
      .select("id")
      .maybeSingle();

    if (!updatedPayment) {
      console.log("Race condition: Payment already completed.");
      return new Response(JSON.stringify({ received: true, already_processed: true }), { status: 200 });
    }

    const amount = Number(existingPayment.amount);
    const userId = existingPayment.user_id;
    const orderId = existingPayment.order_id;
    const metadataObj = typeof existingPayment.metadata === 'object' && existingPayment.metadata ? existingPayment.metadata : {};
    const isInvoiceLink = (metadataObj as any).type === "invoice_link";
    const isWalletRecharge = !orderId && !isInvoiceLink;

    if (isInvoiceLink) {
      const invoiceCode = (metadataObj as any).invoice_code;
      await supabase.from("invoice_links").update({ status: "paid", paid_at: new Date().toISOString() }).eq("payment_id", paymentId);
      await supabase.from("notifications").insert({ title: "Cobrança Paga", message: `Cobrança ${invoiceCode} de R$ ${amount.toFixed(2)} paga via OpenPix.`, type: "payment", global: true });
    } else if (isWalletRecharge) {
      const { data: profile } = await supabase.from("profiles").select("balance").eq("user_id", userId).single();
      const currentBalance = profile?.balance || 0;
      const newBalance = currentBalance + amount;
      await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", userId);
      await supabase.from("wallet_transactions").insert({ user_id: userId, type: "deposit", title: "Recarga via PIX (OpenPix)", amount, balance_after: newBalance, reference_id: paymentId });
      await supabase.from("notifications").insert({ title: "Recarga de Saldo", message: `Cliente recarregou R$ ${amount.toFixed(2)} via PIX. Novo saldo: R$ ${newBalance.toFixed(2)}`, type: "wallet", global: true });
    } else if (orderId) {
      const { data: orderData } = await supabase.from("orders").select("code").eq("id", orderId).single();
      await supabase.from("orders").update({ status: "completed" }).eq("id", orderId);
      await supabase.from("wallet_transactions").insert({ user_id: userId, type: "debit", title: `Compra via PIX — ${orderData?.code || "pedido"}`, amount, reference_id: paymentId });
      
      // Auto-fulfillment logic (abbreviated here, should match your production webhook logic)
      await fulfillMissingStockItems(supabase, orderId);
      
      // Notify Admin
      await supabase.from("notifications").insert({
        title: "Pedido Pago",
        message: `Pedido #${orderData?.code} de R$ ${amount.toFixed(2)} pago via OpenPix.`,
        type: "order",
        global: true,
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
