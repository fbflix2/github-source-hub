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

  async function wapiSendText(phone: string, message: string) {
    const url = `${WAPI_BASE}/message/send-text?instanceId=${WAPI_INSTANCE_ID}`;
    console.log(`W-API send-text URL: ${url}`);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WAPI_TOKEN}`,
      },
      body: JSON.stringify({ phone, message }),
    });

    const result = await safeJson(res);
    console.log(`W-API response [${result.status}]: ${JSON.stringify(result.data || result.raw?.slice(0, 200))}`);
    return { ...result, url };
  }

  async function wapiCheckStatus() {
    const url = `${WAPI_BASE}/instance/status-instance?instanceId=${WAPI_INSTANCE_ID}`;
    console.log(`W-API status URL: ${url}`);
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${WAPI_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    const result = await safeJson(res);
    return { ...result, url };
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

      // Log to database
      await admin.from("whatsapp_logs").insert({
        template_id: template_id || null,
        user_id: user_id || null,
        phone: normalizedPhone,
        message_sent: message,
        status: result.ok ? "sent" : "failed",
        wapi_message_id: result.data?.id || result.data?.messageId || null,
        error_message: result.ok ? null : JSON.stringify(result.data || result.raw || "Unknown error"),
        event_key: event_key || "custom",
        metadata: metadata || {},
      });

      if (!result.ok) {
        return err(`W-API error [${result.status}] (${result.url}): ${JSON.stringify(result.data || result.raw)}`, 502);
      }

      return ok({ success: true, messageId: result.data?.id || result.data?.messageId, url_used: result.url });
    }

    // ========= ACTION: send-template =========
    if (action === "send-template") {
      const { template_id, phone, user_id, variables } = body;
      if (!template_id || !phone) return err("template_id and phone are required");

      const { data: tpl, error: tplErr } = await admin
        .from("whatsapp_templates")
        .select("*")
        .eq("id", template_id)
        .single();
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
        template_id,
        user_id: user_id || null,
        phone: normalizedPhone,
        message_sent: msg,
        status: result.ok ? "sent" : "failed",
        wapi_message_id: result.data?.id || result.data?.messageId || null,
        error_message: result.ok ? null : JSON.stringify(result.data || result.raw),
        event_key: tpl.event_key,
        metadata: { variables: vars },
      });

      if (!result.ok) {
        return err(`W-API error [${result.status}]: ${JSON.stringify(result.data || result.raw)}`, 502);
      }

      return ok({ success: true, messageId: result.data?.id || result.data?.messageId });
    }

    // ========= ACTION: send-bulk =========
    if (action === "send-bulk") {
      const { template_id, recipients } = body;
      if (!template_id || !recipients?.length) return err("template_id and recipients are required");

      const { data: tpl } = await admin.from("whatsapp_templates").select("*").eq("id", template_id).single();
      if (!tpl) return err("Template not found");

      const results: any[] = [];
      for (const r of recipients) {
        let msg = tpl.message_body;
        const vars = r.variables || {};
        for (const [key, value] of Object.entries(vars)) {
          msg = msg.replaceAll(`{{${key}}}`, String(value));
        }

        let normalizedPhone = (r.phone || "").replace(/\D/g, "");
        if (!normalizedPhone.startsWith("55")) normalizedPhone = "55" + normalizedPhone;
        if (normalizedPhone.length < 12) {
          results.push({ phone: r.phone, success: false, error: "Invalid phone" });
          continue;
        }

        try {
          const result = await wapiSendText(normalizedPhone, msg);

          await admin.from("whatsapp_logs").insert({
            template_id,
            user_id: r.user_id || null,
            phone: normalizedPhone,
            message_sent: msg,
            status: result.ok ? "sent" : "failed",
            wapi_message_id: result.data?.id || result.data?.messageId || null,
            error_message: result.ok ? null : JSON.stringify(result.data || result.raw),
            event_key: tpl.event_key,
            metadata: { variables: vars, bulk: true },
          });

          results.push({ phone: normalizedPhone, success: result.ok, messageId: result.data?.id || result.data?.messageId });
          const delay = Math.floor(Math.random() * (60000 - 3000 + 1)) + 3000;
          console.log(`Bulk delay: ${(delay / 1000).toFixed(1)}s`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } catch (e) {
          results.push({ phone: normalizedPhone, success: false, error: String(e) });
        }
      }

      return ok({ success: true, results, total: recipients.length, sent: results.filter((r: any) => r.success).length });
    }

    // ========= ACTION: send-expiring-alerts =========
    if (action === "send-expiring-alerts") {
      const { days_ahead = 0, dry_run = false } = body;

      // Get the active proxy_expiring template
      const { data: tpl } = await admin
        .from("whatsapp_templates")
        .select("*")
        .eq("event_key", "proxy_expiring")
        .eq("active", true)
        .limit(1)
        .single();
      if (!tpl) return err("Nenhum template ativo com evento 'proxy_expiring' encontrado");

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days_ahead);
      const dateStr = targetDate.toISOString().slice(0, 10);

      // Find subscriptions expiring on the target date
      const { data: subs, error: subsErr } = await admin
        .from("subscriptions")
        .select("id, user_id, name, type, end_date, product_id")
        .eq("status", "active")
        .gte("end_date", dateStr + "T00:00:00Z")
        .lt("end_date", dateStr + "T23:59:59Z");

      if (subsErr) return err("Erro ao buscar assinaturas: " + subsErr.message);
      if (!subs?.length) return ok({ success: true, message: `Nenhuma assinatura vencendo em ${dateStr}`, sent: 0, recipients: [] });

      // Get unique user IDs
      const userIds = [...new Set(subs.map((s: any) => s.user_id))];
      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", userIds);

      const profileMap: Record<string, any> = {};
      for (const p of profiles || []) {
        profileMap[p.user_id] = p;
      }

      // Get product names/prices
      const productIds = [...new Set(subs.filter((s: any) => s.product_id).map((s: any) => s.product_id))];
      const productMap: Record<string, any> = {};
      if (productIds.length) {
        const { data: products } = await admin
          .from("products")
          .select("id, name, price")
          .in("id", productIds);
        for (const p of products || []) {
          productMap[p.id] = p;
        }
      }

      // Group subs by user to avoid spamming same user
      const userSubs: Record<string, any[]> = {};
      for (const s of subs) {
        if (!userSubs[s.user_id]) userSubs[s.user_id] = [];
        userSubs[s.user_id].push(s);
      }

      const results: any[] = [];
      for (const [userId, userSubList] of Object.entries(userSubs)) {
        const profile = profileMap[userId];
        if (!profile?.phone) {
          results.push({ user_id: userId, name: profile?.full_name || "?", success: false, error: "Sem telefone cadastrado" });
          continue;
        }

        // Use first sub for the message (or summarize)
        const firstSub = userSubList[0];
        const product = firstSub.product_id ? productMap[firstSub.product_id] : null;
        const productName = product?.name || firstSub.type?.toUpperCase() || "Proxy";
        const productPrice = product?.price ? `R$ ${Number(product.price).toFixed(2)}` : "—";

        let msg = tpl.message_body;
        msg = msg.replaceAll("{{nome}}", profile.full_name || "Cliente");
        msg = msg.replaceAll("{{produto}}", productName);
        msg = msg.replaceAll("{{valor}}", productPrice);
        msg = msg.replaceAll("{{data}}", new Date(firstSub.end_date).toLocaleDateString("pt-BR"));
        msg = msg.replaceAll("{{email}}", "");
        msg = msg.replaceAll("{{link}}", "");

        if (dry_run) {
          results.push({ user_id: userId, name: profile.full_name, phone: profile.phone, message_preview: msg, subs_count: userSubList.length, success: true });
          continue;
        }

        let normalizedPhone = profile.phone.replace(/\D/g, "");
        if (!normalizedPhone.startsWith("55")) normalizedPhone = "55" + normalizedPhone;

        try {
          const result = await wapiSendText(normalizedPhone, msg);
          await admin.from("whatsapp_logs").insert({
            template_id: tpl.id,
            user_id: userId,
            phone: normalizedPhone,
            message_sent: msg,
            status: result.ok ? "sent" : "failed",
            wapi_message_id: result.data?.id || result.data?.messageId || null,
            error_message: result.ok ? null : JSON.stringify(result.data || result.raw),
            event_key: "proxy_expiring",
            metadata: { sub_ids: userSubList.map((s: any) => s.id), days_ahead },
          });
          results.push({ user_id: userId, name: profile.full_name, phone: normalizedPhone, success: result.ok });
          // Delay humanizado: 3-60s aleatório
          const delay = Math.floor(Math.random() * (60000 - 3000 + 1)) + 3000;
          console.log(`Expiring alert delay: ${(delay / 1000).toFixed(1)}s`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } catch (e) {
          results.push({ user_id: userId, name: profile.full_name, phone: profile.phone, success: false, error: String(e) });
        }
      }

      return ok({
        success: true,
        date: dateStr,
        dry_run,
        total_subs: subs.length,
        total_users: Object.keys(userSubs).length,
        sent: results.filter((r: any) => r.success).length,
        failed: results.filter((r: any) => !r.success).length,
        results,
      });
    }

    // ========= ACTION: check-status =========
    if (action === "check-status") {
      const result = await wapiCheckStatus();
      return ok({
        connected: result.ok,
        status: result.data,
        url_used: result.url,
        raw: result.raw || null,
        instance_id: WAPI_INSTANCE_ID,
        token_preview: WAPI_TOKEN?.slice(0, 8) + "...",
      });
    }

    return err("Unknown action: " + action);
  } catch (e) {
    console.error("wapi-send error:", e);
    return err(String(e), 500);
  }
});
