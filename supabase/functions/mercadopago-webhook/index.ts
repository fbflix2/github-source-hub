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
        // Fetch existing payment to preserve metadata fields (e.g. type)
        const { data: existingPmt } = await supabase
          .from("payments")
          .select("metadata")
          .eq("id", mpPayment.external_reference)
          .single();

        const existingMeta = typeof existingPmt?.metadata === 'object' && existingPmt?.metadata ? existingPmt.metadata : {};

        await supabase
          .from("payments")
          .update({
            status: mpPayment.status === "rejected" ? "failed" : mpPayment.status,
            metadata: {
              ...(existingMeta as Record<string, unknown>),
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

    // Atomic update: only mark as completed if still pending (prevents race condition duplicates)
    const { data: updatedPayment, error: updateError } = await supabase
      .from("payments")
      .update({
        status: "completed",
        metadata: {
          ...(typeof existingPayment.metadata === 'object' && existingPayment.metadata ? existingPayment.metadata : {}),
          mp_status: "approved",
          mp_payment_id: String(mpPaymentId),
        },
      })
      .eq("id", paymentId)
      .neq("status", "completed")
      .select("id")
      .maybeSingle();

    if (!updatedPayment) {
      console.log("Payment was already completed by another request (race condition prevented):", paymentId);
      return new Response(JSON.stringify({ received: true, already_processed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this is a wallet recharge or an order payment
    const metadataObj = typeof existingPayment.metadata === 'object' && existingPayment.metadata ? existingPayment.metadata : {};
    // If there's no order_id, it's a wallet recharge (more robust than checking metadata.type)
    const isWalletRecharge = !orderId;

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

      // Notify admin about wallet recharge
      await supabase.from("notifications").insert({
        title: "Recarga de Saldo",
        message: `Cliente recarregou R$ ${amount.toFixed(2)} via PIX. Novo saldo: R$ ${newBalance.toFixed(2)}`,
        type: "wallet",
        global: true,
      });

      console.log(`Credited R$ ${amount} to user ${userId}. New balance: ${newBalance}`);
    } else if (orderId) {
      // ========== ORDER PAYMENT FLOW ==========
      console.log(`Processing order payment for order ${orderId}`);

      // Fetch order code for the transaction title
      const { data: orderData } = await supabase
        .from("orders")
        .select("code")
        .eq("id", orderId)
        .single();

      // Mark order as completed
      await supabase
        .from("orders")
        .update({ status: "completed" })
        .eq("id", orderId);

      // Record in wallet_transactions so it appears in client history
      await supabase.from("wallet_transactions").insert({
        user_id: userId,
        type: "debit",
        title: `Compra via PIX — ${orderData?.code || "pedido"}`,
        amount: amount,
        reference_id: paymentId,
      });

      console.log(`Recorded PIX order payment of R$ ${amount} in wallet_transactions for user ${userId}`);

      // Get order items for fulfillment
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("id, product_id, delivery_data")
        .eq("order_id", orderId);

      if (orderItems) {
        for (const oi of orderItems) {
          // Check if this is a proxy contract order
          const dd = typeof oi.delivery_data === 'object' && oi.delivery_data ? oi.delivery_data as Record<string, unknown> : null;
          if (dd && dd.type === "proxy_contract" && dd.product_variant_id) {
            console.log(`Contracting proxy for order item ${oi.id}:`, JSON.stringify(dd));
            
            const PROXYBR_API_KEY = Deno.env.get("PROXYBR_API_KEY");
            if (PROXYBR_API_KEY) {
              try {
                const contractResp = await fetch("https://painel.proxybr.com.br/api/subscriptions/contract", {
                  method: "POST",
                  headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-API-Key": PROXYBR_API_KEY,
                  },
                  body: JSON.stringify({
                    quantity: dd.quantity || 1,
                    interval: dd.interval || "monthly",
                    product_variant_id: dd.product_variant_id,
                  }),
                });
                const contractText = await contractResp.text();
                console.log(`ProxyBR contract response [${contractResp.status}]: ${contractText.substring(0, 500)}`);
                
                if (contractResp.ok) {
                  let contractData: any;
                  try { contractData = JSON.parse(contractText); } catch { contractData = {}; }
                  
                  // Extract subscription code from various ProxyBR response formats
                  const subCode = contractData.code 
                    || contractData.data?.code 
                    || contractData.subscription?.code 
                    || contractData.subscriptions?.[0]?.code
                    || (Array.isArray(contractData) ? contractData[0]?.code : null);
                  const endDateRaw = contractData.due_date || contractData.end_date || contractData.data?.due_date || contractData.subscription?.due_date || null;
                  // Fallback: if API doesn't return end_date, assume 30 days from now
                  const endDate = endDateRaw || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                  
                  console.log(`Extracted subCode=${subCode}, endDate=${endDate} from contract response keys: ${Object.keys(contractData).join(',')}`);
                  
                  if (subCode) {
                    // Save subscription linked to user
                    const { data: existingSub } = await supabase
                      .from("subscriptions")
                      .select("id")
                      .eq("name", subCode)
                      .eq("type", "proxybr")
                      .maybeSingle();

                    if (existingSub) {
                      await supabase.from("subscriptions").update({
                        user_id: userId,
                        status: "active",
                        end_date: endDate,
                        auto_renew: contractData.auto_renew_active ?? false,
                        raw_data: contractData,
                      }).eq("id", existingSub.id);
                    } else {
                      await supabase.from("subscriptions").insert({
                        name: subCode,
                        type: "proxybr",
                        status: "active",
                        user_id: userId,
                        start_date: new Date().toISOString(),
                        end_date: endDate,
                        auto_renew: contractData.auto_renew_active ?? false,
                        raw_data: contractData,
                      });
                    }
                    console.log(`Saved proxy subscription ${subCode} for user ${userId}`);
                    
                    // Get user email and push to ProxyBR notes
                    const { data: { user: buyerUser } } = await supabase.auth.admin.getUserById(userId);
                    if (buyerUser?.email) {
                      try {
                        await fetch(`https://painel.proxybr.com.br/api/subscriptions/${subCode}`, {
                          method: "PUT",
                          headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                            "X-API-Key": PROXYBR_API_KEY,
                          },
                          body: JSON.stringify({ notes: buyerUser.email }),
                        });
                        console.log(`Set ProxyBR notes for ${subCode} to ${buyerUser.email}`);
                      } catch (e) {
                        console.error("Failed to set ProxyBR notes:", e);
                      }
                    }
                  }
                  
                  // Mark delivery_data as fulfilled
                  await supabase.from("order_items").update({
                    delivery_data: { ...dd, fulfilled: true, subscription_code: subCode },
                  }).eq("id", oi.id);
                } else {
                  console.error(`Proxy contract failed for item ${oi.id}`);
                  await supabase.from("order_items").update({
                    delivery_data: { ...dd, fulfilled: false, error: contractText.substring(0, 200) },
                  }).eq("id", oi.id);
                }
              } catch (contractErr) {
                console.error(`Proxy contract exception for item ${oi.id}:`, contractErr);
              }
            } else {
              console.error("PROXYBR_API_KEY not configured, cannot contract proxy");
            }
            continue; // Skip normal fulfillment for proxy items
          }
          
          // FALLBACK: detect proxy product by icon_type when delivery_data is missing
          if (!dd && oi.product_id) {
            const { data: productInfo } = await supabase
              .from("products")
              .select("icon_type, external_id")
              .eq("id", oi.product_id)
              .single();
            
            if (productInfo?.icon_type === 'proxy' && productInfo.external_id) {
              console.log(`[webhook-fallback] Proxy product detected by icon_type for item ${oi.id}, external_id=${productInfo.external_id}`);
              const PROXYBR_API_KEY = Deno.env.get("PROXYBR_API_KEY");
              if (PROXYBR_API_KEY) {
                try {
                  // Fetch products to find a variant
                  const productsResp = await fetch(`${PROXYBR_BASE || "https://painel.proxybr.com.br/api"}/products`, {
                    headers: { "Accept": "application/json", "X-API-Key": PROXYBR_API_KEY },
                  });
                  const productsData = await productsResp.json();
                  const apiProduct = Array.isArray(productsData) ? productsData.find((p: any) => String(p.id) === String(productInfo.external_id)) : null;
                  
                  if (apiProduct?.variant?.length > 0) {
                    const variant = apiProduct.variant.find((v: any) => v.stocks > 0) || apiProduct.variant[0];
                    console.log(`[webhook-fallback] Using variant ${variant.id} (${variant.location}) for product ${productInfo.external_id}`);
                    
                    const contractResp = await fetch("https://painel.proxybr.com.br/api/subscriptions/contract", {
                      method: "POST",
                      headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "X-API-Key": PROXYBR_API_KEY,
                      },
                      body: JSON.stringify({
                        quantity: 1,
                        interval: "monthly",
                        product_variant_id: variant.id,
                      }),
                    });
                    const contractText = await contractResp.text();
                    console.log(`[webhook-fallback] ProxyBR contract response [${contractResp.status}]: ${contractText.substring(0, 500)}`);
                    
                    if (contractResp.ok) {
                      let contractData: any;
                      try { contractData = JSON.parse(contractText); } catch { contractData = {}; }
                      
                      const subCode = contractData.code 
                        || contractData.data?.code 
                        || contractData.subscription?.code 
                        || contractData.subscriptions?.[0]?.code
                        || (Array.isArray(contractData) ? contractData[0]?.code : null);
                      const endDateRaw = contractData.due_date || contractData.end_date || contractData.data?.due_date || contractData.subscription?.due_date || null;
                      const endDate = endDateRaw || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                      
                      console.log(`[webhook-fallback] Extracted subCode=${subCode}, endDate=${endDate}`);
                      
                      if (subCode) {
                        const { data: existingSub } = await supabase
                          .from("subscriptions")
                          .select("id")
                          .eq("name", subCode)
                          .eq("type", "proxybr")
                          .maybeSingle();

                        if (existingSub) {
                          await supabase.from("subscriptions").update({
                            user_id: userId,
                            status: "active",
                            end_date: endDate,
                            auto_renew: contractData.auto_renew_active ?? false,
                            raw_data: contractData,
                          }).eq("id", existingSub.id);
                        } else {
                          await supabase.from("subscriptions").insert({
                            name: subCode,
                            type: "proxybr",
                            status: "active",
                            user_id: userId,
                            start_date: new Date().toISOString(),
                            end_date: endDate,
                            auto_renew: contractData.auto_renew_active ?? false,
                            raw_data: contractData,
                          });
                        }
                        console.log(`[webhook-fallback] Saved proxy subscription ${subCode} for user ${userId}`);
                        
                        // Set notes
                        const { data: { user: buyerUser } } = await supabase.auth.admin.getUserById(userId);
                        if (buyerUser?.email) {
                          try {
                            await fetch(`https://painel.proxybr.com.br/api/subscriptions/${subCode}`, {
                              method: "PUT",
                              headers: {
                                "Accept": "application/json",
                                "Content-Type": "application/json",
                                "X-API-Key": PROXYBR_API_KEY,
                              },
                              body: JSON.stringify({ notes: buyerUser.email }),
                            });
                          } catch (e) {
                            console.error("Failed to set ProxyBR notes:", e);
                          }
                        }
                        
                        await supabase.from("order_items").update({
                          delivery_data: { type: "proxy_contract", fulfilled: true, subscription_code: subCode, fallback: true },
                        }).eq("id", oi.id);
                      }
                    }
                  }
                } catch (err) {
                  console.error(`[webhook-fallback] Error contracting proxy for item ${oi.id}:`, err);
                }
              }
              continue;
            }
          }
          
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

      // Notify admin about completed order via PIX
      const { data: orderNotifData } = await supabase.from("orders").select("code").eq("id", orderId).single();
      await supabase.from("notifications").insert({
        title: "Pedido Concluído",
        message: `Pedido ${orderNotifData?.code || orderId} finalizado — R$ ${amount.toFixed(2)} (PIX)`,
        type: "order",
        global: true,
      });

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
