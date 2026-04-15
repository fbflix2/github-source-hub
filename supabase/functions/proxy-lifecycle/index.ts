import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

// BRT helper: get current date in BRT as YYYY-MM-DD
function getBRTDate(): Date {
  const now = new Date();
  return new Date(now.getTime() - 3 * 60 * 60 * 1000);
}

function daysDiff(endDate: string): number {
  const brtNow = getBRTDate();
  const todayStr = brtNow.toISOString().slice(0, 10);
  const today = new Date(todayStr + "T00:00:00Z");
  const end = new Date(endDate.slice(0, 10) + "T00:00:00Z");
  return Math.floor((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let body: any = {};
    try { body = await req.json(); } catch {}
    const dryRun = body?.dry_run === true;
    const resetFirst = body?.reset_and_run === true;

    // If reset_and_run, clear grace_notifications for non-cancelled subs
    if (resetFirst) {
      await admin.from("subscriptions")
        .update({ grace_notifications: {} })
        .in("type", ["webshare", "webshare_rotating"])
        .in("status", ["active", "expired", "expiring"]);
      console.log("[proxy-lifecycle] Reset grace_notifications for non-cancelled subs");
    }

    const SITE_URL = "https://fbflix.com.br";
    const GRACE_FEE_PER_DAY = 0.25;

    // ======== FETCH ALL WEBSHARE/WEBSHARE_ROTATING SUBSCRIPTIONS ========
    // Get active ones expiring tomorrow (D-1) and today (D0)
    // Get expired/active ones past end_date (D+1 to D+5)
    const { data: allSubs, error: subsErr } = await admin
      .from("subscriptions")
      .select("id, user_id, name, type, status, end_date, raw_data, product_id, grace_notifications, auto_renew")
      .in("type", ["webshare", "webshare_rotating"])
      .in("status", ["active", "expired", "expiring"])
      .not("end_date", "is", null);

    if (subsErr) throw new Error("Erro ao buscar assinaturas: " + subsErr.message);
    if (!allSubs?.length) return ok({ success: true, message: "Nenhuma assinatura para processar", processed: 0 });

    // Collect user IDs for profile lookups
    const userIds = [...new Set(allSubs.map(s => s.user_id))];
    const { data: profiles } = await admin.from("profiles").select("user_id, full_name, phone").in("user_id", userIds);
    const profileMap: Record<string, any> = {};
    for (const p of profiles || []) profileMap[p.user_id] = p;

    // Product lookup
    const productIds = [...new Set(allSubs.filter(s => s.product_id).map(s => s.product_id))];
    const productMap: Record<string, any> = {};
    if (productIds.length) {
      const { data: products } = await admin.from("products").select("id, name, price").in("id", productIds);
      for (const p of products || []) productMap[p.id] = p;
    }

    const results: any[] = [];

    // Process each subscription
    for (const sub of allSubs) {
      if (!sub.end_date) continue;
      const diff = daysDiff(sub.end_date); // positive = days past expiration
      const grace = (sub.grace_notifications || {}) as Record<string, any>;
      const profile = profileMap[sub.user_id];
      const phone = profile?.phone;
      const nome = profile?.full_name || "Cliente";
      const product = sub.product_id ? productMap[sub.product_id] : null;
      const productName = product?.name || (sub.type === "webshare_rotating" ? "Proxy Rotativo" : "Proxy Residencial");
      const subCode = sub.name || sub.id.slice(0, 8);
      const renewLink = `${SITE_URL}/subscriptions/${subCode}`;
      const raw = (sub.raw_data || {}) as Record<string, any>;
      const proxyIp = raw.proxy_address || raw.proxy_host || "—";

      // Helper to send WhatsApp message
      async function sendWA(message: string, eventKey: string) {
        if (!phone || dryRun) return;
        try {
          await admin.functions.invoke("wapi-send", {
            body: {
              action: "send-text",
              phone,
              message,
              user_id: sub.user_id,
              event_key: eventKey,
              metadata: { subscription_id: sub.id, subscription_name: subCode, stage: eventKey },
            },
          });
        } catch (e: any) {
          console.error(`[proxy-lifecycle] WA send failed for ${subCode}: ${e.message}`);
        }
      }

      // Helper to update grace_notifications
      async function markStage(stage: string) {
        if (dryRun) return;
        const updated = { ...grace, [stage]: new Date().toISOString() };
        await admin.from("subscriptions").update({ grace_notifications: updated }).eq("id", sub.id);
      }

      // ======== D-1: 1 day BEFORE expiration ========
      if (diff === -1 && !grace["d_minus_1"]) {
        const msg = `Olá ${nome} 👋\n\n⏰ *Aviso de vencimento!*\n\nSeu proxy *${subCode}* (${productName}) vence *amanhã*.\n\n🌐 IP: ${proxyIp}\n\nRenove para continuar usando sem interrupção:\n${renewLink}\n\n_Não deixe seu proxy expirar!_ 🔒`;
        await sendWA(msg, "proxy_expiring_d-1");
        await markStage("d_minus_1");
        results.push({ sub: subCode, stage: "D-1", action: "notified" });
      }

      // ======== D0: Day of expiration ========
      else if (diff === 0 && !grace["d0"]) {
        const msg = `Olá ${nome} ⚠️\n\n🔴 *Seu proxy vence HOJE!*\n\nProxy: *${subCode}* (${productName})\n🌐 IP: ${proxyIp}\n\nA partir de amanhã, será cobrada uma taxa de reserva de R$ 0,25/dia para manter seu IP reservado (máximo 2 dias).\n\nRenove agora e evite taxas extras:\n${renewLink}\n\n_Após 4 dias sem renovação, o proxy será cancelado definitivamente._ 🚫`;
        await sendWA(msg, "proxy_expiring_d0");
        await markStage("d0");
        // Mark status as expired if still active
        if (sub.status === "active" && !dryRun) {
          await admin.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
        }
        results.push({ sub: subCode, stage: "D0", action: "notified+expired" });
      }

      // ======== D+1 and D+2: Grace period (no message, just track fee) ========
      else if ((diff === 1 || diff === 2) && !grace[`d_plus_${diff}`]) {
        const fee = GRACE_FEE_PER_DAY * diff;
        await markStage(`d_plus_${diff}`);
        if (!dryRun) {
          // Store accumulated fee in raw_data
          const updatedRaw = { ...raw, grace_fee: fee };
          await admin.from("subscriptions").update({ raw_data: updatedRaw }).eq("id", sub.id);
          if (sub.status !== "expired") {
            await admin.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
          }
        }
        results.push({ sub: subCode, stage: `D+${diff}`, action: `grace_fee=${fee}` });
      }

      // ======== D+3: Reminder via WhatsApp ========
      else if (diff === 3 && !grace["d_plus_3"]) {
        const fee = GRACE_FEE_PER_DAY * 2; // max 2 days of grace fee
        const msg = `Olá ${nome} 🚨\n\n*Seu proxy está expirado há 3 dias!*\n\nProxy: *${subCode}* (${productName})\n🌐 IP: ${proxyIp}\n\n💰 Taxa de reserva acumulada: *R$ ${fee.toFixed(2)}*\n\nVocê tem até *amanhã* para renovar e manter seu IP.\n\nRenove agora:\n${renewLink}\n\n⚠️ _Após amanhã sem renovação, seu proxy será cancelado e o IP será perdido definitivamente._`;
        await sendWA(msg, "proxy_grace_d3");
        await markStage("d_plus_3");
        results.push({ sub: subCode, stage: "D+3", action: "notified" });
      }

      // ======== D+4: LAST CHANCE ========
      else if (diff === 4 && !grace["d_plus_4"]) {
        const fee = GRACE_FEE_PER_DAY * 2;
        const msg = `⛔ *ÚLTIMA CHANCE — ${nome}*\n\nSeu proxy *${subCode}* (${productName}) será *cancelado amanhã*!\n\n🌐 IP: ${proxyIp}\n💰 Taxa de reserva: *R$ ${fee.toFixed(2)}*\n\nEsta é a sua última oportunidade de manter este IP.\n\nRenove agora:\n${renewLink}\n\n_Amanhã o proxy será removido e você perderá o acesso ao IP ${proxyIp} definitivamente._ 🔴`;
        await sendWA(msg, "proxy_lastchance_d4");
        await markStage("d_plus_4");
        results.push({ sub: subCode, stage: "D+4", action: "last_chance_notified" });
      }

      // ======== D+5: DELETE PROXY & CANCEL ========
      else if (diff >= 5 && !grace["d_plus_5_cancelled"]) {
        // Delete the proxy from Webshare
        const webshareProxyId = raw.webshare_proxy_id;
        let deleteResult = "no_proxy_id";

        if (!dryRun) {
          if (webshareProxyId && sub.type === "webshare") {
            try {
              const deleteResp = await admin.functions.invoke("webshare-api", {
                body: { action: "internal-delete-webshare-proxy", webshare_proxy_id: webshareProxyId },
              });
              deleteResult = deleteResp.data?.success ? "deleted" : (deleteResp.data?.error || "failed");
              console.log(`[proxy-lifecycle] Delete proxy ${webshareProxyId}: ${deleteResult}`);
            } catch (e: any) {
              deleteResult = `error: ${e.message}`;
              console.error(`[proxy-lifecycle] Delete proxy error: ${e.message}`);
            }
          }

          // Update subscription to cancelled
          await admin.from("subscriptions").update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
          }).eq("id", sub.id);
        } else {
          deleteResult = "dry_run_skipped";
        }
        await markStage("d_plus_5_cancelled");

        // Send cancellation notification
        const msg = `❌ *Proxy cancelado — ${nome}*\n\nSeu proxy *${subCode}* (${productName}) foi cancelado por falta de renovação.\n\n🌐 IP que foi perdido: ${proxyIp}\n\nCaso queira adquirir um novo proxy, acesse:\n${SITE_URL}/loja\n\n_Obrigado por ter sido nosso cliente! Estamos à disposição._ 🙏`;
        await sendWA(msg, "proxy_cancelled_d5");

        results.push({ sub: subCode, stage: "D+5", action: "cancelled", deleteResult });
      }
    }

    console.log(`[proxy-lifecycle] Processed ${results.length} subscriptions`);
    return ok({ success: true, processed: results.length, details: results, dry_run: dryRun });
  } catch (error: any) {
    console.error("[proxy-lifecycle] Error:", error.message);
    return err(error.message, 500);
  }
});
