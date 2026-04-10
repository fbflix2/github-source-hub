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
    console.log("Webhook received:", JSON.stringify(body).slice(0, 500));

    // W-API sends different webhook formats. Common fields:
    // messageId, status, chatId, timestamp, type
    const messageId = body.messageId || body.id || body.data?.messageId || body.data?.id;
    const status = body.status || body.data?.status || body.type;
    const replyMessage = body.message?.text || body.data?.message?.text || body.text || null;
    const chatId = body.chatId || body.data?.chatId || body.phone;

    if (!messageId && !chatId) {
      console.log("Webhook: no messageId or chatId, ignoring");
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to find the log entry by wapi_message_id
    let logEntry = null;
    if (messageId) {
      const { data } = await admin
        .from("whatsapp_logs")
        .select("id, status")
        .eq("wapi_message_id", messageId)
        .limit(1)
        .single();
      logEntry = data;
    }

    // If not found by messageId, try by phone (for incoming replies)
    if (!logEntry && chatId) {
      const phone = chatId.replace(/@.*/, "").replace(/\D/g, "");
      if (phone) {
        const { data } = await admin
          .from("whatsapp_logs")
          .select("id, status")
          .eq("phone", phone)
          .is("replied_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        logEntry = data;
      }
    }

    if (!logEntry) {
      console.log("Webhook: log entry not found for", messageId || chatId);
      return new Response(JSON.stringify({ ok: true, not_found: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const updates: Record<string, any> = {};

    // Map W-API status to our tracking
    const normalizedStatus = (status || "").toLowerCase();

    if (normalizedStatus === "delivered" || normalizedStatus === "received" || normalizedStatus === "server") {
      updates.delivered_at = now;
      updates.status = "delivered";
    }

    if (normalizedStatus === "read" || normalizedStatus === "viewed") {
      updates.delivered_at = now; // ensure delivered is set
      updates.read_at = now;
      updates.status = "read";
    }

    // Incoming message = reply
    if (body.type === "ReceivedCallback" || body.event === "messages.upsert" || normalizedStatus === "replied" || replyMessage) {
      updates.replied_at = now;
      if (replyMessage) updates.reply_message = replyMessage.slice(0, 1000);
      updates.status = "replied";
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
      else console.log(`Webhook: updated log ${logEntry.id} with`, updates);
    }

    return new Response(JSON.stringify({ ok: true, updated: logEntry.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response(JSON.stringify({ ok: true, error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Always return 200 to webhooks
    });
  }
});
