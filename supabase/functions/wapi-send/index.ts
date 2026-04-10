import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

serve(async (req) => {
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
    const url = `${WAPI_BASE}/instance/status?instanceId=${WAPI_INSTANCE_ID}`;
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
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } catch (e) {
          results.push({ phone: normalizedPhone, success: false, error: String(e) });
        }
      }

      return ok({ success: true, results, total: recipients.length, sent: results.filter((r: any) => r.success).length });
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

    // ========= ACTION: discover-api =========
    if (action === "discover-api") {
      // Test multiple endpoints to discover the correct API format
      const testUrls = [
        `${WAPI_BASE}/v1/instance/status/${WAPI_INSTANCE_ID}`,
        `${WAPI_BASE}/v1/${WAPI_INSTANCE_ID}/status`,
        `${WAPI_BASE}/instance/status/${WAPI_INSTANCE_ID}`,
        `${WAPI_BASE}/v1/message/send-text/${WAPI_INSTANCE_ID}`,
        `${WAPI_BASE}/v1/${WAPI_INSTANCE_ID}/message/send-text`,
      ];

      const discoveries: any[] = [];
      for (const url of testUrls) {
        try {
          const res = await fetch(url, {
            method: url.includes("message") ? "POST" : "GET",
            headers: {
              Authorization: `Bearer ${WAPI_TOKEN}`,
              "Content-Type": "application/json",
            },
            ...(url.includes("message") ? { body: JSON.stringify({ phone: "5500000000000", message: "test" }) } : {}),
          });
          const result = await safeJson(res);
          discoveries.push({
            url,
            status: result.status,
            is_json: result.data !== null,
            data_preview: result.data ? JSON.stringify(result.data).slice(0, 200) : null,
            is_html: result.raw?.includes("<!DOCTYPE") || false,
          });
        } catch (e) {
          discoveries.push({ url, error: String(e) });
        }
      }

      return ok({ discoveries, instance_id: WAPI_INSTANCE_ID });
    }

    return err("Unknown action: " + action);
  } catch (e) {
    console.error("wapi-send error:", e);
    return err(String(e), 500);
  }
});
