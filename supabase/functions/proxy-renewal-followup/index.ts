import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RENEWAL_EVENT_KEYS = [
  "proxy_expiring_d-1",
  "proxy_expiring_d0",
  "proxy_grace_d3",
  "proxy_lastchance_d4",
];

const FOLLOWUP_MESSAGE = "Podemos prosseguir com a renovação? 🙂";
const FOLLOWUP_WAIT_MINUTES = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const cutoffIso = new Date(Date.now() - FOLLOWUP_WAIT_MINUTES * 60 * 1000).toISOString();
    // Only look back 24h to avoid old backlog
    const lowerBoundIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: logs, error } = await admin
      .from("whatsapp_logs")
      .select("id, user_id, phone, event_key, metadata, created_at, replied_at")
      .in("event_key", RENEWAL_EVENT_KEYS)
      .is("replied_at", null)
      .lte("created_at", cutoffIso)
      .gte("created_at", lowerBoundIso)
      .limit(100);

    if (error) throw error;

    const results: any[] = [];

    for (const log of logs || []) {
      const meta = (log.metadata || {}) as Record<string, any>;
      if (meta.followup_sent === true) continue;
      if (!log.phone) continue;

      try {
        await admin.functions.invoke("wapi-send", {
          body: {
            action: "send-text",
            phone: log.phone,
            message: FOLLOWUP_MESSAGE,
            user_id: log.user_id,
            event_key: `${log.event_key}_followup`,
            metadata: { parent_log_id: log.id, followup: true },
          },
        });

        await admin
          .from("whatsapp_logs")
          .update({ metadata: { ...meta, followup_sent: true, followup_sent_at: new Date().toISOString() } })
          .eq("id", log.id);

        results.push({ id: log.id, phone: log.phone, status: "sent" });
      } catch (e: any) {
        console.error(`[proxy-renewal-followup] Failed for log ${log.id}: ${e.message}`);
        results.push({ id: log.id, phone: log.phone, status: "error", error: e.message });
      }
    }

    console.log(`[proxy-renewal-followup] Processed ${results.length} follow-ups`);
    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("[proxy-renewal-followup] Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});