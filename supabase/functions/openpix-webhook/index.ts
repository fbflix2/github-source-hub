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

async function assignScaleProProxies(
  supabase: any,
  params: { ctClientId: string; userId: string; qty: number; planName?: string },
) {
  const { ctClientId, userId, qty, planName } = params;
  if (!qty || qty < 1) return { assigned: 0, missing: 0 };
  const { data: pool } = await supabase
    .from("subscriptions")
    .select("id")
    .in("type", ["proxyfbflix"])
    .is("user_id", null)
    .is("included_in_ct_client_id", null)
    .eq("status", "available")
    .limit(qty);
  let assigned = 0;
  for (const p of (pool || [])) {
    const { error: updErr } = await supabase
      .from("subscriptions")
      .update({ user_id: userId, included_in_ct_client_id: ctClientId, auto_renew: false, status: "active" })
      .eq("id", p.id).is("user_id", null);
    if (updErr) continue;
    await supabase.from("ct_client_proxies").insert({ ct_client_id: ctClientId, subscription_id: p.id });
    assigned++;
  }
  const missing = Math.max(0, qty - assigned);
  if (missing > 0) {
    await supabase.from("notifications").insert({
      title: "Pool de proxies Scale Pro insuficiente",
      message: `Faltam ${missing} proxy(s) para o plano ${planName || ""}. Atribuir manualmente ao cliente ${userId}.`,
      type: "subscription", global: true,
    }).catch(() => {});
  }
  return { assigned, missing };
}

/**
 * Atribui itens do combo (perfil, bm, pagina, ad_account) do pool à assinatura Scale Pro.
 * Prioriza itens reservados manualmente para o usuário; depois pega do pool geral do plano.
 */
async function assignScaleProComboItems(
  supabase: any,
  params: { ctClientId: string; userId: string; planId: string; comboConfig: Record<string, number>; planName?: string },
) {
  const { ctClientId, userId, planId, comboConfig, planName } = params;
  const summary: Record<string, { assigned: number; missing: number }> = {};
  const types = ["perfil", "bm", "pagina", "ad_account"] as const;

  for (const type of types) {
    const qty = Number(comboConfig?.[type] || 0);
    if (!qty || qty < 1) continue;

    // 1) Reservados para o usuário
    const { data: reserved } = await supabase
      .from("ct_pool_items")
      .select("id")
      .eq("plan_id", planId)
      .eq("type", type)
      .eq("status", "reserved")
      .eq("reserved_for_user_id", userId)
      .limit(qty);
    const picked: string[] = (reserved || []).map((r: any) => r.id);

    // 2) Disponíveis no pool do plano
    if (picked.length < qty) {
      const { data: available } = await supabase
        .from("ct_pool_items")
        .select("id")
        .eq("plan_id", planId)
        .eq("type", type)
        .eq("status", "available")
        .limit(qty - picked.length);
      picked.push(...(available || []).map((r: any) => r.id));
    }

    let assigned = 0;
    for (const id of picked) {
      const { data: upd, error: updErr } = await supabase
        .from("ct_pool_items")
        .update({
          status: "assigned",
          assigned_ct_client_id: ctClientId,
          assigned_at: new Date().toISOString(),
          released_at: null,
        })
        .eq("id", id)
        .in("status", ["available", "reserved"])
        .select("id, identifier, metadata, type")
        .maybeSingle();
      if (updErr || !upd) continue;
      await supabase.from("ct_items").insert({
        ct_client_id: ctClientId,
        type: upd.type,
        identifier: upd.identifier,
        metadata: { ...(upd.metadata || {}), pool_item_id: upd.id },
        status: "ativo",
      }).catch(() => {});
      assigned++;
    }
    const missing = Math.max(0, qty - assigned);
    summary[type] = { assigned, missing };
    if (missing > 0) {
      await supabase.from("notifications").insert({
        title: `Pool Scale Pro insuficiente (${type})`,
        message: `Faltam ${missing} ${type}(s) para o plano ${planName || ""}. Cadastre ou atribua manualmente ao cliente ${userId}.`,
        type: "subscription", global: true,
      }).catch(() => {});
    }
  }
  return summary;
}

async function fulfillOrder(supabase: any, orderId: string, userId: string) {
  try {
    const { data: orderItems } = await supabase.from("order_items").select("*").eq("order_id", orderId);

    const { data: userProfile } = await supabase
      .from("profiles").select("lauth_email, lauth_enabled").eq("user_id", userId).maybeSingle();
    const lauthEnabled = userProfile?.lauth_enabled || false;
    const lauthEmail = userProfile?.lauth_email;

    if (!orderItems) return 0;

    let fulfilledCount = 0;
    for (const oiRaw of orderItems) {
      const oi: any = oiRaw;
      const dd = typeof oi.delivery_data === 'object' && oi.delivery_data ? oi.delivery_data as Record<string, unknown> : null;
      
      // Check if already fulfilled
      if (dd?.fulfilled || dd?.type || dd?.bmLinks || dd?.linkPerfil || dd?.idPerfil) continue;

      // ========== SAFE BM AUTO-ACTIVATION ==========
      if (oi.product_id === SAFE_BM_PRODUCT_ID) {
        console.log(`[openpix-webhook] SafeBM product detected for item ${oi.id}`);
        try {
          const { data: clientProfile } = await supabase
            .from("profiles").select("full_name").eq("user_id", userId).single();
          const clientName = clientProfile?.full_name || "Cliente";
          const itemQty = oi.quantity || 1;
          
          for (let i = 0; i < itemQty; i++) {
            const { count: existingCount } = await supabase
              .from("safe_bm_vaults").select("id", { count: "exact", head: true })
              .eq("user_id", userId).eq("status", "active");
            
            await supabase.from("safe_bm_vaults").insert({
              user_id: userId, client_name: clientName,
              bm_name: `BM ${(existingCount || 0) + 1}`,
              bm_link: "https://business.facebook.com",
              status: "active", subscription_price: oi.price || 9.99,
              protection_start: new Date().toISOString(),
            });
          }
          await supabase.from("order_items").update({
            delivery_data: { type: "safe_bm", fulfilled: true, count: itemQty },
          }).eq("id", oi.id);
          fulfilledCount++;
        } catch (e) {
          console.error("[openpix-webhook] SafeBM error:", e);
        }
        continue;
      }

      // ========== WEBSHARE PROXY FULFILLMENT ==========
      let productInfo = null;
      if (oi.product_id) {
        const { data } = await supabase
          .from("products").select("icon_type, external_id, name, tags")
          .eq("id", oi.product_id).single();
        productInfo = data;
      }

      const isProxyProduct = productInfo?.icon_type === 'proxy' || (dd && dd.type === "proxy_contract");
      if (isProxyProduct) {
        console.log(`[openpix-webhook] Proxy product detected for item ${oi.id}`);
        const WEBSHARE_API_KEY = Deno.env.get("WEBSHARE_API_KEY");
        if (!WEBSHARE_API_KEY) {
          console.error("[openpix-webhook] WEBSHARE_API_KEY missing");
          continue;
        }

        try {
          // Country detection
          let targetCountry = "BR";
          const brIndicators = ["brasil", "brazil", "br", "sudeste", "nordeste", "sul", "centro-oeste"];
          const usIndicators = ["usa", "estados unidos", "americano", "us premium"];
          
          const searchText = ((productInfo?.tags || []) as string[]).join(" ").toLowerCase() + " " + (productInfo?.name || "").toLowerCase();
          for (const ind of brIndicators) { if (searchText.includes(ind)) { targetCountry = "BR"; break; } }
          if (targetCountry === "BR" && !searchText.includes("brazil")) {
             for (const ind of usIndicators) { if (searchText.includes(ind)) { targetCountry = "US"; break; } }
          }

          // Get assigned proxies - VERY aggressive to avoid duplicates
          const { data: existingSubs } = await supabase
            .from("subscriptions").select("raw_data")
            .eq("type", "webshare").in("status", ["active", "expiring", "processing", "past_due"]);
          
          const assignedIds = new Set<string>();
          const assignedIPs = new Set<string>();
          for (const s of (existingSubs || [])) {
            const raw = (s.raw_data || {}) as Record<string, any>;
            if (raw.webshare_proxy_id) assignedIds.add(String(raw.webshare_proxy_id));
            if (raw.proxy_address) assignedIPs.add(String(raw.proxy_address));
            
            // Check pack data
            const packData = raw.proxies?.data || [];
            if (Array.isArray(packData)) {
              for (const p of packData) {
                if (p.id) assignedIds.add(String(p.id));
                if (p.proxy_address || p.ip) assignedIPs.add(String(p.proxy_address || p.ip));
              }
            }
          }

          const itemQty = oi.quantity || 1;
          const selectedProxies = [];
          let page = 1;
          while (selectedProxies.length < itemQty && page <= 10) {
            const resp = await fetch(`https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=${page}&page_size=250&country_code__in=${targetCountry}`, {
              headers: { Authorization: `Token ${WEBSHARE_API_KEY}` }
            });
            if (!resp.ok) break;
            const data = await resp.json();
            for (const p of (data.results || [])) {
              if (p.valid && !assignedIds.has(String(p.id)) && !assignedIPs.has(String(p.proxy_address))) {
                selectedProxies.push(p);
                assignedIds.add(String(p.id));
                assignedIPs.add(String(p.proxy_address));
                if (selectedProxies.length >= itemQty) break;
              }
            }
            if (!data.next) break;
            page++;
          }

          for (let i = 0; i < selectedProxies.length; i++) {
            const p = selectedProxies[i];
            const start = new Date();
            const end = new Date();
            end.setDate(end.getDate() + 30);
            
            await supabase.from("subscriptions").insert({
              user_id: userId, name: `WS-${Date.now().toString(36).toUpperCase()}${i > 0 ? `-${i}` : ''}`,
              type: "webshare", status: "active",
              start_date: start.toISOString(), end_date: end.toISOString(),
              product_id: oi.product_id,
              raw_data: {
                webshare_proxy_id: p.id, proxy_address: p.proxy_address,
                port: p.port, username: p.username, password: p.password,
                country_code: p.country_code, provider: "webshare",
                exchange_quota_free: 2, exchange_quota_pay: 0,
              },
            });
          }

          await supabase.from("order_items").update({
            delivery_data: { type: "webshare_proxy", fulfilled: true, count: selectedProxies.length },
          }).eq("id", oi.id);
          fulfilledCount++;
        } catch (e) {
          console.error("[openpix-webhook] Proxy error:", e);
        }
        continue;
      }

      // ========== STANDARD STOCK FULFILLMENT ==========
      if (!oi.product_id) continue;
      const { data: resultRaw } = await supabase.rpc("fulfill_order_item", {
        p_order_item_id: oi.id, p_product_id: oi.product_id,
      });
      const result: any = resultRaw;
       if (result?.success && Number(result?.linked_count || 0) > 0) {
         fulfilledCount += 1;
         
         // Fetch the newly created delivery_data to see if we need Lauth transfer
         const { data: updatedOi } = await supabase
           .from("order_items")
           .select("delivery_data")
           .eq("id", oi.id)
           .single();
           
         const profileId = updatedOi?.delivery_data?.idPerfil;
         
         if (profileId && lauthEnabled && lauthEmail) {
           try {
             const lauthResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/lauth-transfer`, {
               method: 'POST',
               headers: {
                 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                 'Content-Type': 'application/json'
               },
               body: JSON.stringify({ profileId, email: lauthEmail, itemId: oi.id })
             });
             const lauthResult = await lauthResp.json();
             if (lauthResult.success) {
               await supabase.from("order_items").update({
                 delivery_data: {
                   ...(updatedOi.delivery_data || {}),
                   lauthDeliveredAt: new Date().toISOString(),
                   lauthRecipientEmail: lauthEmail
                 }
               }).eq("id", oi.id);
             }
           } catch (e) { console.error("[openpix-webhook] Lauth error:", e); }
         }
       } else {
         console.error(`[openpix-webhook] Fulfillment failed for item ${oi.id}:`, result?.error || "Unknown error");
         // Notify admin about stock failure
         await supabase.from("notifications").insert({
           title: "Falha na Entrega (Estoque)",
           message: `Pedido #${orderId} - Item: ${oi.name} não foi entregue por falta de estoque.`,
           type: "order",
           global: true,
         });
       }
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
      if (existingPayment.order_id) await fulfillOrder(supabase, existingPayment.order_id, existingPayment.user_id);
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
      if (existingPayment.order_id) await fulfillOrder(supabase, existingPayment.order_id, existingPayment.user_id);
      return ok({ received: true, race_resolved: true });
    }

    const amount = Number(existingPayment.amount);
    const userId = existingPayment.user_id;
    const orderId = existingPayment.order_id;
    const metadataObj: any = (typeof existingPayment.metadata === "object" && existingPayment.metadata) || {};
    const isInvoiceLink = metadataObj.type === "invoice_link";
    const isCtSubscription = metadataObj.type === "ct_subscription";
    const isWalletRecharge = !orderId && !isInvoiceLink && !isCtSubscription;

    if (isInvoiceLink) {
      await supabase.from("invoice_links")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("payment_id", paymentId);
      await supabase.from("notifications").insert({
        title: "Cobrança Paga",
        message: `Cobrança ${metadataObj.invoice_code || ""} de R$ ${amount.toFixed(2)} paga via OpenPix.`,
        type: "payment", global: true,
      });
    } else if (isCtSubscription) {
      const ctClientId = metadataObj.ct_client_id;
      const planName = metadataObj.plan_name || "Scale Pro";
      if (ctClientId) {
        const nextBilling = new Date();
        nextBilling.setDate(nextBilling.getDate() + 30);
        await supabase.from("ct_clients").update({
          status: "ativo",
          start_date: new Date().toISOString().slice(0, 10),
          next_billing: nextBilling.toISOString().slice(0, 10),
          last_payment_id: paymentId,
          last_payment_at: new Date().toISOString(),
          trial_ends_at: null,
        }).eq("id", ctClientId);

        // Auto-atribuir proxies inclusos (1 por perfil do plano)
        const { data: ctRow } = await supabase
          .from("ct_clients").select("plan_id").eq("id", ctClientId).maybeSingle();
        let profilesQty = 1;
        if (ctRow?.plan_id) {
          const { data: planRow } = await supabase
            .from("ct_plans").select("profiles_qty").eq("id", ctRow.plan_id).maybeSingle();
          profilesQty = Number(planRow?.profiles_qty || 1);
        }
        const proxyResult = await assignScaleProProxies(supabase, {
          ctClientId, userId, qty: profilesQty, planName,
        });

        const { data: prof } = await supabase
          .from("profiles").select("full_name, phone").eq("user_id", userId).single();

        await supabase.from("notifications").insert({
          title: "Nova assinatura CT",
          message: `${prof?.full_name || "Cliente"} assinou o plano ${planName} (R$ ${amount.toFixed(2)}) via PIX. Proxies atribuídos: ${proxyResult.assigned}${proxyResult.missing ? ` (faltam ${proxyResult.missing})` : ""}.`,
          type: "subscription",
          global: true,
        });

        if (prof?.phone) {
          const firstName = (prof.full_name || "").split(" ")[0] || "cliente";
          const msg =
            `✅ *Scale Pro ativada!*\n\n` +
            `Olá ${firstName}, seu pagamento PIX foi confirmado e sua assinatura do plano *${planName}* já está ativa.\n\n` +
            `💰 Valor: R$ ${amount.toFixed(2)}\n` +
            `📅 Próxima renovação: ${nextBilling.toLocaleDateString("pt-BR")}\n\n` +
            `Acesse seu painel: https://fbflix.com.br/contingencia`;
          await supabase.functions.invoke("wapi-send", {
            body: {
              action: "send-text",
              phone: prof.phone,
              message: msg,
              user_id: userId,
              event_key: "ct_subscription_activated",
            },
          }).catch((e) => console.error("wapi-send failed:", e));
        }
      }
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
      await fulfillOrder(supabase, orderId, userId);
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
