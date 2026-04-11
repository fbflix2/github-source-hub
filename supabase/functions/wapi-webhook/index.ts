import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).slice(0, 800));

    // W-API webhook fields
    const messageId = body.messageId || body.id || body.data?.messageId || body.data?.id;
    const status = body.status || body.data?.status || body.type;
    const replyMessage = body.message?.text || body.data?.message?.text || body.text || body.body || null;
    const chatId = body.chatId || body.chat?.id || body.data?.chatId || body.phone;
    const fromMe = body.fromMe ?? body.data?.fromMe ?? null;
    const isGroup = body.isGroup ?? body.data?.isGroup ?? false;

    // Ignore group messages
    if (isGroup) {
      console.log("Webhook: ignoring group message");
      return new Response(JSON.stringify({ ok: true, ignored: "group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!messageId && !chatId) {
      console.log("Webhook: no messageId or chatId, ignoring");
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract phone number from chatId
    const phone = chatId ? chatId.replace(/@.*/, "").replace(/\D/g, "") : null;

    // Try to find the log entry
    let logEntry = null;

    // 1. Try by wapi_message_id (exact match)
    if (messageId) {
      const { data } = await admin
        .from("whatsapp_logs")
        .select("id, status, phone")
        .eq("wapi_message_id", messageId)
        .limit(1)
        .single();
      logEntry = data;
    }

    // 2. If not found, try by phone + most recent (for status updates and replies)
    if (!logEntry && phone) {
      const { data } = await admin
        .from("whatsapp_logs")
        .select("id, status, phone")
        .eq("phone", phone)
        .in("status", ["sent", "delivered", "read"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      logEntry = data;
    }

    if (!logEntry) {
      console.log("Webhook: log entry not found for", messageId || chatId, "phone:", phone);
      return new Response(JSON.stringify({ ok: true, not_found: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const updates: Record<string, any> = {};

    // Map W-API status to our tracking
    const normalizedStatus = (status || "").toString().toLowerCase();
    const event = (body.event || "").toString().toLowerCase();

    // Status progression: sent -> delivered -> read
    const currentStatus = logEntry.status;

    if (normalizedStatus === "delivered" || normalizedStatus === "received" || normalizedStatus === "server" || event.includes("delivery")) {
      if (currentStatus === "sent" || currentStatus === "delivered") {
        updates.delivered_at = now;
        updates.status = "delivered";
      }
    }

    if (normalizedStatus === "read" || normalizedStatus === "viewed" || event.includes("read")) {
      updates.delivered_at = updates.delivered_at || now;
      updates.read_at = now;
      updates.status = "read";
    }

    // Incoming message = reply (not from us)
    if (fromMe === false || body.type === "ReceivedCallback" || body.event === "messages.upsert" || event === "webhookreceived") {
      if (fromMe === false && !isGroup) {
        updates.replied_at = now;
        if (replyMessage) updates.reply_message = replyMessage.slice(0, 1000);
        updates.status = "replied";
      }
    }

    if (normalizedStatus === "failed" || normalizedStatus === "error") {
      updates.status = "failed";
      updates.error_message = JSON.stringify(body.data || body.error || "webhook reported failure");
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await admin
        .from("whatsapp_logs")
        .update(updates)
        .eq("id", logEntry.id);

      if (error) console.error("Webhook update error:", error);
      else console.log(`Webhook: updated log ${logEntry.id} =>`, JSON.stringify(updates));
    } else {
      console.log("Webhook: no status update needed, event:", event, "status:", normalizedStatus, "fromMe:", fromMe);
    }

    return new Response(JSON.stringify({ ok: true, updated: logEntry.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response(JSON.stringify({ ok: true, error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});