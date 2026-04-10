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

  try {
    const body = await req.json();
    const { action } = body;

    // ========= ACTION: send-text =========
    if (action === "send-text") {
      const { phone, message, user_id, event_key, template_id, metadata } = body;
      if (!phone || !message) return err("phone and message are required");

      // Normalize phone – ensure 55 prefix and @c.us suffix
      let normalizedPhone = phone.replace(/\D/g, "");
      if (!normalizedPhone.startsWith("55")) normalizedPhone = "55" + normalizedPhone;

      // Call W-API
      const wapiUrl = `https://api.w-api.app/v1/${WAPI_INSTANCE_ID}/message/send-text`;
      const wapiRes = await fetch(wapiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WAPI_TOKEN}`,
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          message,
        }),
      });
      const wapiData = await wapiRes.json();

      // Log to database
      await admin.from("whatsapp_logs").insert({
        template_id: template_id || null,
        user_id: user_id || null,
        phone: normalizedPhone,
        message_sent: message,
        status: wapiRes.ok ? "sent" : "failed",
        wapi_message_id: wapiData?.id || wapiData?.messageId || null,
        error_message: wapiRes.ok ? null : JSON.stringify(wapiData),
        event_key: event_key || "custom",
        metadata: metadata || {},
      });

      if (!wapiRes.ok) {
        return err(`W-API error [${wapiRes.status}]: ${JSON.stringify(wapiData)}`, 502);
      }

      return ok({ success: true, messageId: wapiData?.id || wapiData?.messageId, wapiData });
    }

    // ========= ACTION: send-template =========
    if (action === "send-template") {
      const { template_id, phone, user_id, variables } = body;
      if (!template_id || !phone) return err("template_id and phone are required");

      // Fetch template
      const { data: tpl, error: tplErr } = await admin
        .from("whatsapp_templates")
        .select("*")
        .eq("id", template_id)
        .single();
      if (tplErr || !tpl) return err("Template not found");
      if (!tpl.active) return err("Template is disabled");

      // Replace placeholders
      let msg = tpl.message_body;
      const vars = variables || {};
      for (const [key, value] of Object.entries(vars)) {
        msg = msg.replaceAll(`{{${key}}}`, String(value));
      }

      // Normalize phone
      let normalizedPhone = phone.replace(/\D/g, "");
      if (!normalizedPhone.startsWith("55")) normalizedPhone = "55" + normalizedPhone;

      // Send via W-API
      const wapiUrl = `https://api.w-api.app/v1/${WAPI_INSTANCE_ID}/message/send-text`;
      const wapiRes = await fetch(wapiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WAPI_TOKEN}`,
        },
        body: JSON.stringify({ phone: normalizedPhone, message: msg }),
      });
      const wapiData = await wapiRes.json();

      // Log
      await admin.from("whatsapp_logs").insert({
        template_id,
        user_id: user_id || null,
        phone: normalizedPhone,
        message_sent: msg,
        status: wapiRes.ok ? "sent" : "failed",
        wapi_message_id: wapiData?.id || wapiData?.messageId || null,
        error_message: wapiRes.ok ? null : JSON.stringify(wapiData),
        event_key: tpl.event_key,
        metadata: { variables: vars },
      });

      if (!wapiRes.ok) {
        return err(`W-API error [${wapiRes.status}]: ${JSON.stringify(wapiData)}`, 502);
      }

      return ok({ success: true, messageId: wapiData?.id || wapiData?.messageId });
    }

    // ========= ACTION: send-bulk =========
    if (action === "send-bulk") {
      const { template_id, recipients } = body;
      // recipients: Array<{ phone, user_id?, variables? }>
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
          const wapiUrl = `https://api.w-api.app/v1/${WAPI_INSTANCE_ID}/message/send-text`;
          const wapiRes = await fetch(wapiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${WAPI_TOKEN}`,
            },
            body: JSON.stringify({ phone: normalizedPhone, message: msg }),
          });
          const wapiData = await wapiRes.json();

          await admin.from("whatsapp_logs").insert({
            template_id,
            user_id: r.user_id || null,
            phone: normalizedPhone,
            message_sent: msg,
            status: wapiRes.ok ? "sent" : "failed",
            wapi_message_id: wapiData?.id || wapiData?.messageId || null,
            error_message: wapiRes.ok ? null : JSON.stringify(wapiData),
            event_key: tpl.event_key,
            metadata: { variables: vars, bulk: true },
          });

          results.push({ phone: normalizedPhone, success: wapiRes.ok, messageId: wapiData?.id || wapiData?.messageId });

          // Small delay between messages to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } catch (e) {
          results.push({ phone: normalizedPhone, success: false, error: String(e) });
        }
      }

      return ok({ success: true, results, total: recipients.length, sent: results.filter((r: any) => r.success).length });
    }

    // ========= ACTION: check-status =========
    if (action === "check-status") {
      const wapiUrl = `https://api.w-api.app/v1/${WAPI_INSTANCE_ID}/status`;
      const wapiRes = await fetch(wapiUrl, {
        headers: { Authorization: `Bearer ${WAPI_TOKEN}` },
      });
      const wapiData = await wapiRes.json();
      return ok({ status: wapiData });
    }

    return err("Unknown action: " + action);
  } catch (e) {
    console.error("wapi-send error:", e);
    return err(String(e), 500);
  }
});
