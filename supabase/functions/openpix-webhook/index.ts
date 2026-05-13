import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-openpix-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const ok = (data: any = { received: true }) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SAFE_BM_PRODUCT_ID = "e5118c63-ed52-4f4e-8983-f44c1ba0d17b";

async function fulfillMissingStockItems(supabase: any, orderId: string) {
  try {
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("id, product_id, delivery_data")
      .eq("order_id", orderId);

    let fulfilledCount = 0;
    for (const oi of orderItems || []) {
      if (!oi.product_id || oi.product_id === SAFE_BM_PRODUCT_ID) continue;
      const dd = oi.delivery_data && typeof oi.delivery_data === "object" ? oi.delivery_data : null;
      if (dd?.type || dd?.bmLinks || dd?.linkPerfil || dd?.idPerfil) continue;

      const { data: product } = await supabase
        .from("products").select("icon_type").eq("id", oi.product_id).maybeSingle();
      if (product?.icon_type === "proxy") continue;

      const { count: linkedCount } = await supabase
        .from("stock_items").select("id", { count: "exact", head: true }).eq("order_item_id", oi.id);
      if ((linkedCount || 0) > 0) continue;

      const { data: result } = await supabase.rpc("fulfill_order_item", {
        p_order_item_id: oi.id, p_product_id: oi.product_id,
      });
      if (result?.success && Number(result?.linked_count || 0) > 0) fulfilledCount += 1;
    }
    if (fulfilledCount > 0) {
      await supabase.from("orders").update({ status: "completed" }).eq("id", orderId);
    }
    return fulfilledCount;
  } catch (e) {
    console.error("[openpix-webhook] fulfill error:", e);
    return 0;
  }
}

Deno.serve(async (req) => {
  // Always handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // OpenPix may send a GET to verify the endpoint when registering
  if (req.method === "GET") {
    return ok({ ok: true, message: "OpenPix webhook endpoint ready" });
  }

  // Parse body safely — never throw
  let body: any = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch (e) {
    console.error("[openpix-webhook] Invalid JSON body:", e);
    // Still return 200 so OpenPix accepts the registration
    return ok({ received: true, warning: "invalid_json" });
  }

  console.log("[openpix-webhook] Event received:", JSON.stringify(body).substring(0, 500));

  // OpenPix test event during webhook creation — must respond 200
  const event = body?.event || body?.evento || "";
  if (event === "OPENPIX:TEST" || event === "teste_webhook" || body?.evento === "teste_webhook") {
    console.log("[openpix-webhook] Test event acknowledged");
    return ok({ received: true, test: true });
  }

  // Only react to charge completed
  const isCompleted =
    event === "OPENPIX:CHARGE_COMPLETED" ||
    event === "CHARGE_COMPLETED" ||
    body?.charge?.status === "COMPLETED";

  if (!isCompleted) {
    console.log("[openpix-webhook] Ignoring event:", event);
    return ok({ received: true, ignored: true });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const charge = body.charge || body.pix || {};
    const paymentId = charge.correlationID;
    if (!paymentId) {
      console.error("[openpix-webhook] No correlationID in payload");
      return ok({ received: true, warning: "missing_correlationID" });
    }

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id, status, user_id, amount, order_id, metadata")
      .eq("id", paymentId)
      .maybeSingle();

    if (!existingPayment) {
      console.error("[openpix-webhook] Payment not found:", paymentId);
      return ok({ received: true, warning: "payment_not_found" });
    }

    if (existingPayment.status === "completed") {
      if (existingPayment.order_id) await fulfillMissingStockItems(supabase, existingPayment.order_id);
      return ok({ received: true, already_processed: true });
    }

    const { data: updatedPayment } = await supabase
      .from("payments")
      .update({
        status: "completed",
        gateway_reference: charge?.identifier || charge?.txId || charge?.endToEndId || null,
        metadata: {
          ...(typeof existingPayment.metadata === "object" ? existingPayment.metadata : {}),
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
      if (existingPayment.order_id) await fulfillMissingStockItems(supabase, existingPayment.order_id);
      return ok({ received: true, race_resolved: true });
    }

    const amount = Number(existingPayment.amount);
    const userId = existingPayment.user_id;
    const orderId = existingPayment.order_id;
    const metadataObj: any = (typeof existingPayment.metadata === "object" && existingPayment.metadata) || {};
    const isInvoiceLink = metadataObj.type === "invoice_link";
    const isWalletRecharge = !orderId && !isInvoiceLink;

    if (isInvoiceLink) {
      await supabase.from("invoice_links")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("payment_id", paymentId);
      await supabase.from("notifications").insert({
        title: "Cobrança Paga",
        message: `Cobrança ${metadataObj.invoice_code || ""} de R$ ${amount.toFixed(2)} paga via OpenPix.`,
        type: "payment", global: true,
      });
    } else if (isWalletRecharge) {
      const { data: profile } = await supabase.from("profiles").select("balance").eq("user_id", userId).single();
      const newBalance = (profile?.balance || 0) + amount;
      await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", userId);
      await supabase.from("wallet_transactions").insert({
        user_id: userId, type: "deposit", title: "Recarga via PIX (OpenPix)",
        amount, balance_after: newBalance, reference_id: paymentId,
      });
      await supabase.from("notifications").insert({
        title: "Recarga de Saldo",
        message: `Cliente recarregou R$ ${amount.toFixed(2)} via PIX. Novo saldo: R$ ${newBalance.toFixed(2)}`,
        type: "wallet", global: true,
      });
    } else if (orderId) {
      const { data: orderData } = await supabase.from("orders").select("code").eq("id", orderId).single();
      await supabase.from("orders").update({ status: "completed" }).eq("id", orderId);
      await supabase.from("wallet_transactions").insert({
        user_id: userId, type: "debit",
        title: `Compra via PIX — ${orderData?.code || "pedido"}`,
        amount, reference_id: paymentId,
      });
      await fulfillMissingStockItems(supabase, orderId);
      await supabase.from("notifications").insert({
        title: "Pedido Pago",
        message: `Pedido #${orderData?.code} de R$ ${amount.toFixed(2)} pago via OpenPix.`,
        type: "order", global: true,
      });
    }

    return ok({ received: true, processed: true });
  } catch (error) {
    console.error("[openpix-webhook] Processing error:", error);
    // Return 200 so OpenPix doesn't retry indefinitely / to register webhook
    return ok({ received: true, error: String(error).substring(0, 200) });
  }
});
