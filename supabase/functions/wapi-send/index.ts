import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

async function safeJson(res: Response): Promise<{ ok: boolean; status: number; data: any; raw?: string }> {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, data: null, raw: text.slice(0, 500) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const WAPI_TOKEN = Deno.env.get("WAPI_TOKEN");
  const WAPI_INSTANCE_ID = Deno.env.get("WAPI_INSTANCE_ID");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!WAPI_TOKEN || !WAPI_INSTANCE_ID) {
    return err("W-API credentials not configured", 500);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const WAPI_BASE = `https://api.w-api.app/v1`;

  async function wapiRequest(endpoint: string, payload: any) {
    const url = `${WAPI_BASE}${endpoint}?instanceId=${WAPI_INSTANCE_ID}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WAPI_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await safeJson(res);
    console.log(`W-API [${result.status}]: ${JSON.stringify(result.data || result.raw?.slice(0, 200))}`);
    return { ...result, url };
  }

  async function wapiSendText(phone: string, message: string) {
    return wapiRequest("/message/send-text", { phone, message });
  }

  async function wapiSendImage(phone: string, imageUrl: string, caption?: string) {
    return wapiRequest("/message/send-image", { phone, image: imageUrl, caption: caption || "" });
  }

  async function wapiSendButton(phone: string, message: string, buttons: Array<{ id: string; text: string }>, title?: string, footer?: string) {
    return wapiRequest("/message/send-button", { phone, title: title || "", message, footer: footer || "", buttons });
  }

  async function wapiCheckStatus() {
    const url = `${WAPI_BASE}/instance/status-instance?instanceId=${WAPI_INSTANCE_ID}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${WAPI_TOKEN}`, "Content-Type": "application/json" },
    });
    return { ...(await safeJson(res)), url };
  }

  function getMessageId(result: any) {
    // W-API returns different structures depending on the endpoint
    // Try WhatsApp native key first (used in webhook status callbacks)
    const d = result.data;
    const waId = d?.key?.id || d?.message?.key?.id || d?.messageId || d?.id || null;
    if (d) console.log("W-API response keys:", JSON.stringify({ keys: Object.keys(d), keyId: d?.key?.id, id: d?.id, messageId: d?.messageId }).slice(0, 300));
    return waId;
  }

  // Background sender with humanized delays
  async function sendMessagesInBackground(messages: Array<{ phone: string; message: string; logData: any; imageUrl?: string; buttons?: any[] }>) {
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      try {
        let result;
        if (m.imageUrl) {
          result = await wapiSendImage(m.phone, m.imageUrl, m.message);
        } else if (m.buttons?.length) {
          result = await wapiSendButton(m.phone, m.message, m.buttons);
        } else {
          result = await wapiSendText(m.phone, m.message);
        }

        await admin.from("whatsapp_logs").insert({
          ...m.logData,
          phone: m.phone,
          message_sent: m.message,
          status: result.ok ? "sent" : "failed",
          wapi_message_id: getMessageId(result),
          error_message: result.ok ? null : JSON.stringify(result.data || result.raw),
          message_type: m.imageUrl ? "image" : m.buttons?.length ? "button" : "text",
          image_url: m.imageUrl || null,
        });
      } catch (e) {
        console.error(`BG send failed ${m.phone}: ${e}`);
        await admin.from("whatsapp_logs").insert({
          ...m.logData,
          phone: m.phone,
          message_sent: m.message,
          status: "failed",
          error_message: String(e),
        });
      }
      if (i < messages.length - 1) {
        const delay = Math.floor(Math.random() * (280000 - 3000 + 1)) + 3000;
        console.log(`BG delay: ${(delay / 1000).toFixed(1)}s (${i + 1}/${messages.length})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    console.log(`BG sender done: ${messages.length} messages processed`);
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ========= ACTION: send-text =========
    if (action === "send-text") {
      const { phone, message, user_id, event_key, template_id, metadata } = body;
      if (!phone || !message) return err("phone and message are required");

      let normalizedPhone = phone.replace(/\D/g, "");
      if (!normalizedPhone.startsWith("55")) normalizedPhone = "55" + normalizedPhone;

      const result = await wapiSendText(normalizedPhone, message);

      await admin.from("whatsapp_logs").insert({
        template_id: template_id || null,
        user_id: user_id || null,
        phone: normalizedPhone,
        message_sent: message,
        status: result.ok ? "sent" : "failed",
        wapi_message_id: getMessageId(result),
        error_message: result.ok ? null : JSON.stringify(result.data || result.raw || "Unknown error"),
        event_key: event_key || "custom",
        metadata: metadata || {},
        message_type: "text",
      });

      if (!result.ok) return err(`W-API error [${result.status}]: ${JSON.stringify(result.data || result.raw)}`, 502);
      return ok({ success: true, messageId: getMessageId(result) });
    }

    // ========= ACTION: send-image =========
    if (action === "send-image") {
      const { phone, image_url, caption, user_id, event_key, template_id, metadata } = body;
      if (!phone || !image_url) return err("phone and image_url are required");

      let normalizedPhone = phone.replace(/\D/g, "");
      if (!normalizedPhone.startsWith("55")) normalizedPhone = "55" + normalizedPhone;

      const result = await wapiSendImage(normalizedPhone, image_url, caption);

      await admin.from("whatsapp_logs").insert({
        template_id: template_id || null,
        user_id: user_id || null,
        phone: normalizedPhone,
        message_sent: caption || "[Imagem]",
        status: result.ok ? "sent" : "failed",
        wapi_message_id: getMessageId(result),
        error_message: result.ok ? null : JSON.stringify(result.data || result.raw),
        event_key: event_key || "custom",
        metadata: metadata || {},
        message_type: "image",
        image_url,
      });

      if (!result.ok) return err(`W-API error [${result.status}]: ${JSON.stringify(result.data || result.raw)}`, 502);
      return ok({ success: true, messageId: getMessageId(result) });
    }

    // ========= ACTION: send-button =========
    if (action === "send-button") {
      const { phone, message, buttons, title, footer, user_id, event_key, template_id, metadata } = body;
      if (!phone || !message || !buttons?.length) return err("phone, message and buttons are required");

      let normalizedPhone = phone.replace(/\D/g, "");
      if (!normalizedPhone.startsWith("55")) normalizedPhone = "55" + normalizedPhone;

      const result = await wapiSendButton(normalizedPhone, message, buttons, title, footer);

      await admin.from("whatsapp_logs").insert({
        template_id: template_id || null,
        user_id: user_id || null,
        phone: normalizedPhone,
        message_sent: message,
        status: result.ok ? "sent" : "failed",
        wapi_message_id: getMessageId(result),
        error_message: result.ok ? null : JSON.stringify(result.data || result.raw),
        event_key: event_key || "custom",
        metadata: { ...(metadata || {}), buttons, title, footer },
        message_type: "button",
      });

      if (!result.ok) return err(`W-API error [${result.status}]: ${JSON.stringify(result.data || result.raw)}`, 502);
      return ok({ success: true, messageId: getMessageId(result) });
    }

    // ========= ACTION: send-template =========
    if (action === "send-template") {
      const { template_id, phone, user_id, variables } = body;
      if (!template_id || !phone) return err("template_id and phone are required");

      const { data: tpl, error: tplErr } = await admin
        .from("whatsapp_templates").select("*").eq("id", template_id).single();
      if (tplErr || !tpl) return err("Template not found");
      if (!tpl.active) return err("Template is disabled");

      let msg = tpl.message_body;
      const vars = variables || {};
      for (const [key, value] of Object.entries(vars)) {
        msg = msg.replaceAll(`{{${key}}}`, String(value));
      }

      let normalizedPhone = phone.replace(/\D/g, "");
      if (!normalizedPhone.startsWith("55")) normalizedPhone = "55" + normalizedPhone;

      const result = await wapiSendText(normalizedPhone, msg);

      await admin.from("whatsapp_logs").insert({
        template_id, user_id: user_id || null, phone: normalizedPhone,
        message_sent: msg, status: result.ok ? "sent" : "failed",
        wapi_message_id: getMessageId(result),
        error_message: result.ok ? null : JSON.stringify(result.data || result.raw),
        event_key: tpl.event_key, metadata: { variables: vars },
        message_type: "text",
      });

      if (!result.ok) return err(`W-API error [${result.status}]: ${JSON.stringify(result.data || result.raw)}`, 502);
      return ok({ success: true, messageId: getMessageId(result) });
    }

    // ========= ACTION: send-bulk =========
    if (action === "send-bulk") {
      const { template_id, recipients } = body;
      if (!template_id || !recipients?.length) return err("template_id and recipients are required");

      const { data: tpl } = await admin.from("whatsapp_templates").select("*").eq("id", template_id).single();
      if (!tpl) return err("Template not found");

      const queue: Array<{ phone: string; message: string; logData: any }> = [];
      const skipped: any[] = [];

      for (const r of recipients) {
        let msg = tpl.message_body;
        const vars = r.variables || {};
        for (const [key, value] of Object.entries(vars)) {
          msg = msg.replaceAll(`{{${key}}}`, String(value));
        }
        let normalizedPhone = (r.phone || "").replace(/\D/g, "");
        if (!normalizedPhone.startsWith("55")) normalizedPhone = "55" + normalizedPhone;
        if (normalizedPhone.length < 12) {
          skipped.push({ phone: r.phone, error: "Invalid phone" });
          continue;
        }
        queue.push({
          phone: normalizedPhone, message: msg,
          logData: { template_id, user_id: r.user_id || null, event_key: tpl.event_key, metadata: { variables: vars, bulk: true } },
        });
      }

      EdgeRuntime.waitUntil(sendMessagesInBackground(queue));

      return ok({
        success: true, queued: queue.length, skipped: skipped.length, total: recipients.length,
        message: `${queue.length} mensagens enfileiradas para envio em background`,
      });
    }

    // ========= ACTION: send-expiring-alerts =========
    if (action === "send-expiring-alerts") {
      const { days_ahead = 0, dry_run = false } = body;

      const { data: tpl } = await admin
        .from("whatsapp_templates").select("*")
        .eq("event_key", "proxy_expiring").eq("active", true).limit(1).single();
      if (!tpl) return err("Nenhum template ativo com evento 'proxy_expiring' encontrado");

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days_ahead);
      const dateStr = targetDate.toISOString().slice(0, 10);

      const { data: subs, error: subsErr } = await admin
        .from("subscriptions")
        .select("id, user_id, name, type, end_date, product_id")
        .eq("status", "active")
        .gte("end_date", dateStr + "T00:00:00Z")
        .lt("end_date", dateStr + "T23:59:59Z");

      if (subsErr) return err("Erro ao buscar assinaturas: " + subsErr.message);
      if (!subs?.length) return ok({ success: true, message: `Nenhuma assinatura vencendo em ${dateStr}`, sent: 0 });

      const userIds = [...new Set(subs.map((s: any) => s.user_id))];
      const { data: profiles } = await admin.from("profiles").select("user_id, full_name, phone").in("user_id", userIds);
      const profileMap: Record<string, any> = {};
      for (const p of profiles || []) profileMap[p.user_id] = p;

      const productIds = [...new Set(subs.filter((s: any) => s.product_id).map((s: any) => s.product_id))];
      const productMap: Record<string, any> = {};
      if (productIds.length) {
        const { data: products } = await admin.from("products").select("id, name, price").in("id", productIds);
        for (const p of products || []) productMap[p.id] = p;
      }

      const userSubs: Record<string, any[]> = {};
      for (const s of subs) {
        if (!userSubs[s.user_id]) userSubs[s.user_id] = [];
        userSubs[s.user_id].push(s);
      }

      const queue: Array<{ phone: string; message: string; logData: any }> = [];
      const dryResults: any[] = [];
      const noPhone: any[] = [];

      for (const [userId, userSubList] of Object.entries(userSubs)) {
        const profile = profileMap[userId];
        if (!profile?.phone) {
          noPhone.push({ user_id: userId, name: profile?.full_name || "?" });
          continue;
        }

        // Build dynamic product section based on proxy count
        let totalValue = 0;
        const proxyLines: string[] = [];
        for (const sub of userSubList) {
          const product = sub.product_id ? productMap[sub.product_id] : null;
          const pName = product?.name || sub.type?.toUpperCase() || "Proxy";
          const pPrice = product?.price ? Number(product.price) : 0;
          const subId = sub.name || sub.id.slice(0, 8);
          totalValue += pPrice;
          proxyLines.push(`• ${subId} — ${pName} (R$ ${pPrice.toFixed(2)})`);
        }

        const isMultiple = userSubList.length > 1;
        const totalStr = `R$ ${totalValue.toFixed(2)}`;
        const firstEndDate = new Date(userSubList[0].end_date).toLocaleDateString("pt-BR");

        // Dynamic closing hooks - rotated per user for natural feel
        const closingHooks = [
          "Renove e mantenha seus perfis e contas protegidos! 🔒",
          "Não deixe seus perfis desprotegidos — renove e continue seguro! 🛡️",
          "Sem proxy ativo, suas contas ficam expostas. Garanta sua proteção! 🔐",
          "Mantenha a segurança das suas contas — renove antes que expire! ⚡",
          "Proxy ativo = perfis seguros. Não arrisque perder sua proteção! 💪",
          "Renove agora e evite qualquer risco para suas contas! ✅",
          "Seus perfis dependem do proxy pra operar com segurança. Renove já! 🚀",
          "Continue operando com tranquilidade — renove sua proteção! 🔑",
        ];
        const hookIndex = Math.floor(Math.random() * closingHooks.length);
        const closingHook = closingHooks[hookIndex];

        let msg: string;
        if (isMultiple) {
          const nome = profile.full_name || "Cliente";
          msg = `Olá ${nome} 👋\n\nPassando pra te lembrar que suas *${userSubList.length} assinaturas* de proxy vencem em *${firstEndDate}*:\n\n${proxyLines.join("\n")}\n\n💰 *Valor total: ${totalStr}*\n\n${closingHook}\nhttps://fbflix1.lovable.app/subscriptions`;
        } else {
          msg = tpl.message_body;
          msg = msg.replaceAll("{{nome}}", profile.full_name || "Cliente");
          msg = msg.replaceAll("{{produto}}", proxyLines[0].replace("• ", ""));
          msg = msg.replaceAll("{{valor}}", totalStr);
          msg = msg.replaceAll("{{data}}", firstEndDate);
          msg = msg.replaceAll("{{email}}", "");
          msg = msg.replaceAll("{{link}}", "");
          // Append dynamic hook after template content
          msg += `\n\n${closingHook}\nhttps://fbflix1.lovable.app/subscriptions`;
        }

        if (dry_run) {
          dryResults.push({ user_id: userId, name: profile.full_name, phone: profile.phone, message_preview: msg, subs_count: userSubList.length, total_value: totalStr });
          continue;
        }

        let normalizedPhone = profile.phone.replace(/\D/g, "");
        if (!normalizedPhone.startsWith("55")) normalizedPhone = "55" + normalizedPhone;

        queue.push({
          phone: normalizedPhone, message: msg,
          logData: {
            template_id: tpl.id, user_id: userId, event_key: "proxy_expiring",
            metadata: { sub_ids: userSubList.map((s: any) => s.id), days_ahead },
          },
        });
      }

      if (dry_run) {
        return ok({ success: true, dry_run: true, date: dateStr, total_subs: subs.length, results: dryResults, no_phone: noPhone });
      }

      EdgeRuntime.waitUntil(sendMessagesInBackground(queue));

      return ok({
        success: true, date: dateStr, queued: queue.length, no_phone: noPhone.length,
        total_subs: subs.length, total_users: Object.keys(userSubs).length,
        message: `${queue.length} alertas enfileirados para envio em background`,
      });
    }

    // ========= ACTION: send-replacement-alert =========
    if (action === "send-replacement-alert") {
      const { user_id, client_name, product_name, reason, type, new_product_name } = body;
      // type: "replacement" | "exchange"
      if (!user_id) return err("user_id is required");

      const { data: profile } = await admin
        .from("profiles")
        .select("phone, full_name")
        .eq("user_id", user_id)
        .maybeSingle();

      if (!profile?.phone) return ok({ success: false, skipped: true, reason: "Cliente sem telefone cadastrado" });

      const nome = client_name || profile.full_name || "Cliente";
      const isExchange = type === "exchange";

      const replacementHooks = [
        "Qualquer dúvida, estamos aqui pra te ajudar! 💬",
        "Conte com a gente sempre que precisar! 🤝",
        "Satisfação do cliente é nossa prioridade! ⭐",
        "Estamos à disposição pra qualquer necessidade! 🚀",
        "Seu sucesso é o nosso sucesso! 💪",
      ];
      const hook = replacementHooks[Math.floor(Math.random() * replacementHooks.length)];

      let msg: string;
      if (isExchange) {
        msg = `Olá ${nome} 👋\n\n`;
        msg += `Informamos que a *troca* do seu produto foi realizada com sucesso! ✅\n\n`;
        msg += `🔄 *De:* ${product_name || "Produto anterior"}\n`;
        msg += `✨ *Para:* ${new_product_name || "Novo produto"}\n`;
        if (reason) msg += `📋 *Motivo:* ${reason}\n`;
        msg += `\nSeu novo item já está disponível na sua área de pedidos.\n\n`;
        msg += `${hook}\nhttps://fbflix1.lovable.app/orders`;
      } else {
        msg = `Olá ${nome} 👋\n\n`;
        msg += `Sua *reposição* foi realizada com sucesso! ✅\n\n`;
        msg += `📦 *Produto:* ${product_name || "Item reposto"}\n`;
        if (reason) msg += `📋 *Motivo:* ${reason}\n`;
        msg += `\nO novo item já está disponível na sua área de pedidos.\n\n`;
        msg += `${hook}\nhttps://fbflix1.lovable.app/orders`;
      }

      let normalizedPhone = profile.phone.replace(/\D/g, "");
      if (!normalizedPhone.startsWith("55")) normalizedPhone = "55" + normalizedPhone;

      const result = await wapiSendText(normalizedPhone, msg);

      await admin.from("whatsapp_logs").insert({
        user_id,
        phone: normalizedPhone,
        message_sent: msg,
        status: result.ok ? "sent" : "failed",
        wapi_message_id: getMessageId(result),
        error_message: result.ok ? null : JSON.stringify(result.data || result.raw),
        event_key: isExchange ? "product_exchange" : "replacement",
        metadata: { product_name, new_product_name, reason, type },
        message_type: "text",
      });

      return ok({ success: result.ok, messageId: getMessageId(result) });
    }

    // ========= ACTION: campaign-stats =========
    if (action === "campaign-stats") {
      const { template_id, event_key, date_from, date_to } = body;

      let q = admin.from("whatsapp_logs").select("status, delivered_at, read_at, replied_at, created_at, event_key, template_id", { count: "exact" });

      if (template_id) q = q.eq("template_id", template_id);
      if (event_key) q = q.eq("event_key", event_key);
      if (date_from) q = q.gte("created_at", date_from);
      if (date_to) q = q.lte("created_at", date_to);

      const { data: logs, count, error: logsErr } = await q.limit(5000);
      if (logsErr) return err("Erro: " + logsErr.message);

      const total = logs?.length || 0;
      const sent = logs?.filter((l: any) => l.status !== "failed").length || 0;
      const delivered = logs?.filter((l: any) => l.delivered_at).length || 0;
      const read = logs?.filter((l: any) => l.read_at).length || 0;
      const replied = logs?.filter((l: any) => l.replied_at).length || 0;
      const failed = logs?.filter((l: any) => l.status === "failed").length || 0;

      return ok({
        total,
        sent,
        delivered,
        read,
        replied,
        failed,
        rates: {
          delivery: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
          read: delivered > 0 ? Math.round((read / delivered) * 100) : 0,
          reply: delivered > 0 ? Math.round((replied / delivered) * 100) : 0,
          failure: total > 0 ? Math.round((failed / total) * 100) : 0,
        },
      });
    }

    // ========= ACTION: check-status =========
    if (action === "check-status") {
      const result = await wapiCheckStatus();
      return ok({
        connected: result.ok, status: result.data, url_used: result.url,
        instance_id: WAPI_INSTANCE_ID, token_preview: WAPI_TOKEN?.slice(0, 8) + "...",
      });
    }

    return err("Unknown action: " + action);
  } catch (e) {
    console.error("wapi-send error:", e);
    return err(String(e), 500);
  }
});
