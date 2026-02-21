import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // PIX QR codes expire after 30 minutes by default on Mercado Pago
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Find pending payments older than 30 minutes
    const { data: expiredPayments, error: fetchError } = await supabase
      .from("payments")
      .select("id, order_id, user_id, amount, code")
      .eq("status", "pending")
      .eq("gateway", "mercadopago")
      .lt("created_at", thirtyMinutesAgo);

    if (fetchError) {
      console.error("Error fetching expired payments:", fetchError);
      throw fetchError;
    }

    if (!expiredPayments || expiredPayments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expired payments found", cancelled: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let cancelledCount = 0;
    let abandonedCount = 0;

    for (const payment of expiredPayments) {
      // Cancel the payment
      await supabase
        .from("payments")
        .update({
          status: "cancelled",
          metadata: {
            type: "wallet_recharge",
            cancelled_reason: "pix_expired",
            expired_at: new Date().toISOString(),
          },
        })
        .eq("id", payment.id);

      cancelledCount++;

      // If there's an associated order, mark it as abandoned
      if (payment.order_id) {
        await supabase
          .from("orders")
          .update({ status: "abandoned" })
          .eq("id", payment.order_id)
          .in("status", ["processing"]);

        abandonedCount++;
      }
    }

    console.log(`Expired ${cancelledCount} payments, ${abandonedCount} abandoned carts`);

    return new Response(
      JSON.stringify({
        message: "Expired payments processed",
        cancelled: cancelledCount,
        abandoned: abandonedCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
