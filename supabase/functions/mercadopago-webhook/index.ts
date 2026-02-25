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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // MP can send webhooks as JSON body or as query params (IPN style)
    let mpPaymentId: string | null = null;
    
    const url = new URL(req.url);
    const topicParam = url.searchParams.get("topic") || url.searchParams.get("type");
    const idParam = url.searchParams.get("id") || url.searchParams.get("data.id");

    // Try JSON body first
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // No JSON body — might be IPN query-param style
    }
    
    console.log("Webhook received - body:", JSON.stringify(body), "query:", url.search);

    // Extract payment ID from various MP webhook formats
    if (body.data && typeof body.data === 'object' && (body.data as Record<string, unknown>).id) {
      mpPaymentId = String((body.data as Record<string, unknown>).id);
    } else if (body.id && (body.type === "payment" || topicParam === "payment")) {
      mpPaymentId = String(body.id);
    } else if (idParam && (topicParam === "payment" || topicParam === "merchant_order")) {
      mpPaymentId = idParam;
    }

    // Skip non-payment events
    const eventType = body.type || body.action || topicParam || "";
    if (!String(eventType).includes("payment") && !mpPaymentId) {
      console.log("Skipping non-payment event:", eventType);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!mpPaymentId) {
      console.log("No payment ID found in webhook");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("Processing payment ID:", mpPaymentId);

    // Fetch payment details from Mercado Pago
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${mpPaymentId}`,
      {
        headers: { Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` },
      }
    );

    if (!mpResponse.ok) {
      console.error("Failed to fetch MP payment:", mpResponse.status);
      throw new Error(`Failed to verify payment with Mercado Pago`);
    }

    const mpPayment = await mpResponse.json();
    console.log("MP Payment status:", mpPayment.status, "external_reference:", mpPayment.external_reference);

    if (mpPayment.status !== "approved") {
      if (mpPayment.external_reference) {
        await supabase
          .from("payments")
          .update({
            status: mpPayment.status === "rejected" ? "failed" : mpPayment.status,
            metadata: {
              mp_status: mpPayment.status,
              mp_status_detail: mpPayment.status_detail,
            },
          })
          .eq("id", mpPayment.external_reference);
      }

      return new Response(JSON.stringify({ received: true, status: mpPayment.status }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Payment approved
    const paymentId = mpPayment.external_reference;
    if (!paymentId) {
      console.error("No external_reference in approved payment");
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already processed
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id, status, user_id, amount, order_id, metadata")
      .eq("id", paymentId)
      .single();

    if (!existingPayment) {
      console.error("Payment not found:", paymentId);
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingPayment.status === "completed") {
      console.log("Payment already processed:", paymentId);
      return new Response(JSON.stringify({ received: true, already_processed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amount = Number(existingPayment.amount);
    const userId = existingPayment.user_id;
    const orderId = existingPayment.order_id;

    // Mark payment as completed
    await supabase
      .from("payments")
      .update({
        status: "completed",
        metadata: {
          ...(typeof existingPayment.metadata === 'object' && existingPayment.metadata ? existingPayment.metadata : {}),
          mp_status: "approved",
          mp_payment_id: String(mpPaymentId),
        },
      })
      .eq("id", paymentId);

    // Check if this is a wallet recharge or an order payment
    const metadataObj = typeof existingPayment.metadata === 'object' && existingPayment.metadata ? existingPayment.metadata : {};
    const isWalletRecharge = (metadataObj as Record<string, unknown>).type === "wallet_recharge" && !orderId;

    if (isWalletRecharge) {
      // ========== WALLET RECHARGE FLOW ==========
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("user_id", userId)
        .single();

      const currentBalance = profile?.balance || 0;
      const newBalance = currentBalance + amount;

      await supabase
        .from("profiles")
        .update({ balance: newBalance })
        .eq("user_id", userId);

      await supabase.from("wallet_transactions").insert({
        user_id: userId,
        type: "deposit",
        title: "Recarga via PIX",
        amount: amount,
        balance_after: newBalance,
        reference_id: paymentId,
      });

      console.log(`Credited R$ ${amount} to user ${userId}. New balance: ${newBalance}`);
    } else if (orderId) {
      // ========== ORDER PAYMENT FLOW ==========
      console.log(`Processing order payment for order ${orderId}`);

      // Mark order as completed
      await supabase
        .from("orders")
        .update({ status: "completed" })
        .eq("id", orderId);

      // Get order items for fulfillment
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("id, product_id")
        .eq("order_id", orderId);

      if (orderItems) {
        for (const oi of orderItems) {
          if (!oi.product_id) continue;

          // Use the atomic fulfillment function
          const { data: result, error: rpcError } = await supabase.rpc("fulfill_order_item", {
            p_order_item_id: oi.id,
            p_product_id: oi.product_id,
          });

          if (rpcError) {
            console.error(`Fulfillment error for item ${oi.id}:`, rpcError);
          } else {
            console.log(`Fulfillment result for item ${oi.id}:`, result);
          }
        }
      }

      console.log(`Order ${orderId} fulfilled successfully`);
    }

    return new Response(
      JSON.stringify({ received: true, credited: isWalletRecharge, order_fulfilled: !!orderId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
