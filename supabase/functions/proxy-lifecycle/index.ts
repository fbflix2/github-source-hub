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

// BRT helper: get current date in BRT
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

// Random closing hooks for engagement
const CLOSING_HOOKS = [
  "Renove e mantenha seus perfis e contas protegidos! 🔒",
  "Não deixe seus perfis desprotegidos — renove e continue seguro! 🛡️",
  "Sem proxy ativo, suas contas ficam expostas. Garanta sua proteção! 🔐",
  "Mantenha a segurança das suas contas — renove antes que expire! ⚡",
  "Proxy ativo = perfis seguros. Não arrisque perder sua proteção! 💪",
  "Renove agora e evite qualquer risco para suas contas! ✅",
  "Seus perfis dependem do proxy pra operar com segurança. Renove já! 🚀",
  "Continue operando com tranquilidade — renove sua proteção! 🔑",
];

function randomHook(): string {
  return CLOSING_HOOKS[Math.floor(Math.random() * CLOSING_HOOKS.length)];
}

// Normalizes phone: strips non-digits, adds BR code if needed
function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return digits;
  if (!digits.startsWith("55") && digits.length <= 11) digits = "55" + digits;
  return digits;
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
        .in("type", ["webshare", "webshare_rotating", "proxybr"])
        .in("status", ["active", "expired", "expiring"]);
      console.log("[proxy-lifecycle] Reset grace_notifications for non-cancelled subs");
    }

    const SITE_URL = "https://fbflix.com.br";
    const GRACE_FEE_PER_DAY = 0.25;

    // ======== FETCH ALL PROXY SUBSCRIPTIONS (Webshare + ProxyBR) ========
    const { data: allSubs, error: subsErr } = await admin
      .from("subscriptions")
      .select("id, user_id, name, type, status, end_date, raw_data, product_id, grace_notifications, auto_renew")
      .in("type", ["webshare", "webshare_rotating", "proxybr"])
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

    // ======== GROUP SUBSCRIPTIONS BY USER AND STAGE ========
    // Each sub gets its stage, then we group by user+stage for consolidated messages
    type SubWithStage = typeof allSubs[0] & { diff: number; stage: string };
    const subsWithStage: SubWithStage[] = [];

    for (const sub of allSubs) {
      if (!sub.end_date) continue;
      const diff = daysDiff(sub.end_date);
      const grace = (sub.grace_notifications || {}) as Record<string, any>;

      let stage: string | null = null;
      if (diff === -1 && !grace["d_minus_1"]) stage = "d_minus_1";
      else if (diff === 0 && !grace["d0"]) stage = "d0";
      else if ((diff === 1 || diff === 2) && !grace[`d_plus_${diff}`]) stage = `d_plus_${diff}`;
      else if (diff === 3 && !grace["d_plus_3"]) stage = "d_plus_3";
      else if (diff === 4 && !grace["d_plus_4"]) stage = "d_plus_4";
      else if (diff >= 5 && !grace["d_plus_5_cancelled"]) stage = "d_plus_5_cancelled";

      if (stage) {
        subsWithStage.push({ ...sub, diff, stage });
      }
    }

    if (!subsWithStage.length) return ok({ success: true, message: "Nenhuma assinatura pendente de ação", processed: 0 });

    // Group by user_id + stage for consolidated WhatsApp messages
    const userStageGroups: Record<string, SubWithStage[]> = {};
    for (const sub of subsWithStage) {
      const key = `${sub.user_id}::${sub.stage}`;
      if (!userStageGroups[key]) userStageGroups[key] = [];
      userStageGroups[key].push(sub);
    }

    const results: any[] = [];
    // Queue for delayed sending
    const waQueue: Array<{ phone: string; message: string; user_id: string; event_key: string; metadata: any }> = [];

    // Helper to build proxy line for a sub
    function buildProxyLine(sub: SubWithStage): { line: string; price: number; ip: string; code: string } {
      const product = sub.product_id ? productMap[sub.product_id] : null;
      const productName = product?.name || (sub.type === "webshare_rotating" ? "Proxy Rotativo" : "Proxy Residencial");
      let price = product?.price ? Number(product.price) : 0;
      if (price === 0 && sub.raw_data) {
        const rd = typeof sub.raw_data === "string" ? JSON.parse(sub.raw_data) : sub.raw_data;
        price = Number(rd?.monthly_cost || rd?.price || 0);
      }
      const raw = (sub.raw_data || {}) as Record<string, any>;
      const ip = raw.proxy_address || raw.proxy_host || "—";
      const code = sub.name || sub.id.slice(0, 8);
      return {
        line: `• ${code} — ${productName} (R$ ${price.toFixed(2)}) — IP: ${ip}`,
        price,
        ip,
        code,
      };
    }

    // Helper to mark stage on a sub
    async function markStage(subId: string, stage: string, existingGrace: Record<string, any>) {
      if (dryRun) return;
      const updated = { ...existingGrace, [stage]: new Date().toISOString() };
      await admin.from("subscriptions").update({ grace_notifications: updated }).eq("id", subId);
    }

    // Process each user+stage group
    for (const [key, subs] of Object.entries(userStageGroups)) {
      const [userId, stage] = key.split("::");
      const profile = profileMap[userId];
      const phone = profile?.phone;
      const nome = profile?.full_name || "Cliente";
      const hook = randomHook();

      // Build proxy lines and total
      const proxyInfos = subs.map(s => buildProxyLine(s as SubWithStage));
      const proxyLines = proxyInfos.map(p => p.line).join("\n");
      const totalValue = proxyInfos.reduce((sum, p) => sum + p.price, 0);
      const totalStr = `R$ ${totalValue.toFixed(2)}`;
      const isMultiple = subs.length > 1;
      const subLinks = subs.map(s => `${SITE_URL}/subscriptions/${s.name || s.id}`).join("\n");
      const firstCode = proxyInfos[0].code;
      const firstIp = proxyInfos[0].ip;
      const renewLink = `${SITE_URL}/subscriptions/${firstCode}`;
      const countLabel = isMultiple ? `${subs.length} proxies` : `proxy *${firstCode}*`;

      let msg = "";
      let eventKey = "";

      // ======== D-1: 1 day BEFORE expiration ========
      if (stage === "d_minus_1") {
        eventKey = "proxy_expiring_d-1";
        if (isMultiple) {
          msg = `Olá ${nome} 👋\n\n⏰ *Aviso de vencimento!*\n\nSeus *${subs.length} proxies* vencem *amanhã*:\n\n${proxyLines}\n\n💰 *Valor total: ${totalStr}*\n\nRenove para continuar usando sem interrupção:\n${subLinks}\n\n_${hook}_`;
        } else {
          msg = `Olá ${nome} 👋\n\n⏰ *Aviso de vencimento!*\n\nSeu proxy *${firstCode}* vence *amanhã*.\n\n🌐 IP: ${firstIp}\n💰 Valor: ${totalStr}\n\nRenove para continuar usando sem interrupção:\n${renewLink}\n\n_${hook}_`;
        }
        for (const sub of subs) {
          await markStage(sub.id, "d_minus_1", (sub.grace_notifications || {}) as Record<string, any>);
          results.push({ sub: sub.name || sub.id.slice(0, 8), stage: "D-1", action: "notified" });
        }
      }

      // ======== D0: Day of expiration ========
      else if (stage === "d0") {
        eventKey = "proxy_expiring_d0";
        if (isMultiple) {
          msg = `Olá ${nome} ⚠️\n\n🔴 *Seus ${subs.length} proxies vencem HOJE!*\n\n${proxyLines}\n\n💰 *Valor total: ${totalStr}*\n\nA partir de amanhã, será cobrada uma taxa de reserva de R$ 0,25/dia para manter seus IPs reservados (máximo 2 dias).\n\nRenove agora e evite taxas extras:\n${subLinks}\n\n_Após 4 dias sem renovação, os proxies serão cancelados definitivamente._ 🚫\n\n_${hook}_`;
        } else {
          msg = `Olá ${nome} ⚠️\n\n🔴 *Seu proxy vence HOJE!*\n\nProxy: *${firstCode}*\n🌐 IP: ${firstIp}\n💰 Valor: ${totalStr}\n\nA partir de amanhã, será cobrada uma taxa de reserva de R$ 0,25/dia para manter seu IP reservado (máximo 2 dias).\n\nRenove agora e evite taxas extras:\n${renewLink}\n\n_Após 4 dias sem renovação, o proxy será cancelado definitivamente._ 🚫\n\n_${hook}_`;
        }
        for (const sub of subs) {
          await markStage(sub.id, "d0", (sub.grace_notifications || {}) as Record<string, any>);
          if (sub.status === "active" && !dryRun) {
            await admin.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
          }
          results.push({ sub: sub.name || sub.id.slice(0, 8), stage: "D0", action: "notified+expired" });
        }
      }

      // ======== D+1 and D+2: Grace period (track fee, no WA message — silent) ========
      else if (stage === "d_plus_1" || stage === "d_plus_2") {
        const diff = subs[0].diff;
        for (const sub of subs) {
          const fee = GRACE_FEE_PER_DAY * diff;
          await markStage(sub.id, `d_plus_${diff}`, (sub.grace_notifications || {}) as Record<string, any>);
          if (!dryRun) {
            const raw = (sub.raw_data || {}) as Record<string, any>;
            const updatedRaw = { ...raw, grace_fee: fee };
            await admin.from("subscriptions").update({ raw_data: updatedRaw }).eq("id", sub.id);
            if (sub.status !== "expired") {
              await admin.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
            }
          }
          results.push({ sub: sub.name || sub.id.slice(0, 8), stage: `D+${diff}`, action: `grace_fee=${GRACE_FEE_PER_DAY * diff}` });
        }
        continue; // No WhatsApp message for D+1/D+2
      }

      // ======== D+3: Reminder via WhatsApp ========
      else if (stage === "d_plus_3") {
        eventKey = "proxy_grace_d3";
        const fee = GRACE_FEE_PER_DAY * 2;
        if (isMultiple) {
          msg = `Olá ${nome} 🚨\n\n*Seus ${subs.length} proxies estão expirados há 3 dias!*\n\n${proxyLines}\n\n💰 Taxa de reserva acumulada: *R$ ${(fee * subs.length).toFixed(2)}* (R$ ${fee.toFixed(2)}/proxy)\n\nVocê tem até *amanhã* para renovar e manter seus IPs.\n\nRenove agora:\n${subLinks}\n\n⚠️ _Após amanhã sem renovação, seus proxies serão cancelados e os IPs perdidos definitivamente._\n\n_${hook}_`;
        } else {
          msg = `Olá ${nome} 🚨\n\n*Seu proxy está expirado há 3 dias!*\n\nProxy: *${firstCode}*\n🌐 IP: ${firstIp}\n\n💰 Taxa de reserva acumulada: *R$ ${fee.toFixed(2)}*\n\nVocê tem até *amanhã* para renovar e manter seu IP.\n\nRenove agora:\n${renewLink}\n\n⚠️ _Após amanhã sem renovação, seu proxy será cancelado e o IP será perdido definitivamente._\n\n_${hook}_`;
        }
        for (const sub of subs) {
          await markStage(sub.id, "d_plus_3", (sub.grace_notifications || {}) as Record<string, any>);
          results.push({ sub: sub.name || sub.id.slice(0, 8), stage: "D+3", action: "notified" });
        }
      }

      // ======== D+4: LAST CHANCE ========
      else if (stage === "d_plus_4") {
        eventKey = "proxy_lastchance_d4";
        const fee = GRACE_FEE_PER_DAY * 2;
        if (isMultiple) {
          msg = `⛔ *ÚLTIMA CHANCE — ${nome}*\n\nSeus *${subs.length} proxies* serão *cancelados amanhã*!\n\n${proxyLines}\n\n💰 Taxa de reserva: *R$ ${(fee * subs.length).toFixed(2)}*\n\nEsta é a sua última oportunidade de manter esses IPs.\n\nRenove agora:\n${subLinks}\n\n_Amanhã os proxies serão removidos e você perderá o acesso definitivamente._ 🔴\n\n_${hook}_`;
        } else {
          msg = `⛔ *ÚLTIMA CHANCE — ${nome}*\n\nSeu proxy *${firstCode}* será *cancelado amanhã*!\n\n🌐 IP: ${firstIp}\n💰 Taxa de reserva: *R$ ${fee.toFixed(2)}*\n\nEsta é a sua última oportunidade de manter este IP.\n\nRenove agora:\n${renewLink}\n\n_Amanhã o proxy será removido e você perderá o acesso ao IP ${firstIp} definitivamente._ 🔴\n\n_${hook}_`;
        }
        for (const sub of subs) {
          await markStage(sub.id, "d_plus_4", (sub.grace_notifications || {}) as Record<string, any>);
          results.push({ sub: sub.name || sub.id.slice(0, 8), stage: "D+4", action: "last_chance_notified" });
        }
      }

      // ======== D+5: DELETE PROXY & CANCEL ========
      else if (stage === "d_plus_5_cancelled") {
        eventKey = "proxy_cancelled_d5";
        const cancelledCodes: string[] = [];

        for (const sub of subs) {
          const raw = (sub.raw_data || {}) as Record<string, any>;
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

            await admin.from("subscriptions").update({
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
            }).eq("id", sub.id);
          } else {
            deleteResult = "dry_run_skipped";
          }

          await markStage(sub.id, "d_plus_5_cancelled", (sub.grace_notifications || {}) as Record<string, any>);
          cancelledCodes.push(sub.name || sub.id.slice(0, 8));
          results.push({ sub: sub.name || sub.id.slice(0, 8), stage: "D+5", action: "cancelled", deleteResult });
        }

        if (isMultiple) {
          const ipsLost = proxyInfos.map(p => `• ${p.code} — IP: ${p.ip}`).join("\n");
          msg = `❌ *Proxies cancelados — ${nome}*\n\nSeus *${subs.length} proxies* foram cancelados por falta de renovação.\n\nIPs perdidos:\n${ipsLost}\n\nCaso queira adquirir novos proxies, acesse:\n${SITE_URL}/loja\n\n_Obrigado por ter sido nosso cliente! Estamos à disposição._ 🙏`;
        } else {
          msg = `❌ *Proxy cancelado — ${nome}*\n\nSeu proxy *${firstCode}* foi cancelado por falta de renovação.\n\n🌐 IP que foi perdido: ${firstIp}\n\nCaso queira adquirir um novo proxy, acesse:\n${SITE_URL}/loja\n\n_Obrigado por ter sido nosso cliente! Estamos à disposição._ 🙏`;
        }
      }

      // Queue WhatsApp message (skip if no phone or dryRun)
      if (msg && phone && !dryRun) {
        waQueue.push({
          phone: normalizePhone(phone),
          message: msg,
          user_id: userId,
          event_key: eventKey,
          metadata: { subscription_ids: subs.map(s => s.id), stage, proxy_count: subs.length },
        });
      }
    }

    // ======== SEND ALL QUEUED MESSAGES WITH HUMANIZED DELAYS ========
    if (waQueue.length > 0 && !dryRun) {
      // Use EdgeRuntime.waitUntil for background processing with delays
      const sendInBackground = async () => {
        for (let i = 0; i < waQueue.length; i++) {
          const m = waQueue[i];
          try {
            await admin.functions.invoke("wapi-send", {
              body: {
                action: "send-text",
                phone: m.phone,
                message: m.message,
                user_id: m.user_id,
                event_key: m.event_key,
                metadata: m.metadata,
              },
            });
            console.log(`[proxy-lifecycle] WA sent ${i + 1}/${waQueue.length} to ${m.phone} (${m.event_key})`);
          } catch (e: any) {
            console.error(`[proxy-lifecycle] WA send failed for ${m.phone}: ${e.message}`);
          }
          // Humanized delay between messages (3s to 280s)
          if (i < waQueue.length - 1) {
            const delay = Math.floor(Math.random() * (280000 - 3000 + 1)) + 3000;
            console.log(`[proxy-lifecycle] Delay: ${(delay / 1000).toFixed(1)}s before next message`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
        console.log(`[proxy-lifecycle] BG sender done: ${waQueue.length} messages processed`);
      };

      EdgeRuntime.waitUntil(sendInBackground());
    }

    console.log(`[proxy-lifecycle] Processed ${results.length} subscriptions, queued ${waQueue.length} WA messages`);
    return ok({ success: true, processed: results.length, wa_queued: waQueue.length, details: results, dry_run: dryRun });
  } catch (error: any) {
    console.error("[proxy-lifecycle] Error:", error.message);
    return err(error.message, 500);
  }
});
