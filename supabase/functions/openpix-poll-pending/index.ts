import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback confirmation: some reseller OpenPix accounts do not have our webhook
// registered, so their charges stay "pending" forever. This job polls OpenPix
// with the correct app id (reseller or FBFlix) and replays the completion
// through the existing openpix-webhook logic (idempotent).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FBFLIX_APP_ID = Deno.env.get("OPENPIX_APP_ID") || "";
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: pending } = await admin
      .from("payments")
      .select("id, metadata, gateway_reference, created_at")
      .eq("gateway", "openpix")
      .eq("status", "pending")
      .gte("created_at", since)
      .limit(200);

    if (!pending?.length) return json({ checked: 0, completed: 0 });

    // Cache reseller app ids
    const resellerIds = [...new Set(pending.map((p: any) => p?.metadata?.reseller_id).filter(Boolean))];
    const appIdByReseller: Record<string, string> = {};
    if (resellerIds.length) {
      const { data: resellers } = await admin
        .from("resellers")
        .select("id, status, gateway_openpix_app_id")
        .in("id", resellerIds as string[]);
      for (const r of resellers || []) {
        const appId = String(r.gateway_openpix_app_id || "").trim();
        if (appId && ["active", "warning"].includes(String(r.status))) appIdByReseller[r.id] = appId;
      }
    }

    let completed = 0;
    let checked = 0;

    for (const p of pending) {
      const meta: any = (typeof p.metadata === "object" && p.metadata) || {};
      const chargeId = meta.openpix_charge_id || p.gateway_reference;
      if (!chargeId) continue;
      const appId = (meta.reseller_id && appIdByReseller[meta.reseller_id]) || FBFLIX_APP_ID;
      if (!appId) continue;

      checked++;
      try {
        const res = await fetch(`https://api.openpix.com.br/api/v1/charge/${chargeId}`, {
          headers: { Authorization: appId },
        });
        if (!res.ok) continue;
        const data = await res.json();
        const charge = data.charge || data;
        if (String(charge?.status).toUpperCase() !== "COMPLETED") continue;

        const replay = await fetch(`${SUPABASE_URL}/functions/v1/openpix-webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
          body: JSON.stringify({
            event: "OPENPIX:CHARGE_COMPLETED",
            charge: { ...charge, correlationID: charge?.correlationID || p.id, status: "COMPLETED" },
          }),
        });
        console.log(`[openpix-poll] payment ${p.id} completed -> webhook ${replay.status}`);
        completed++;
      } catch (e) {
        console.error(`[openpix-poll] error on ${p.id}:`, e instanceof Error ? e.message : e);
      }
    }

    return json({ checked, completed });
  } catch (error) {
    console.error("[openpix-poll] fatal:", error);
    return json({ error: error instanceof Error ? error.message : "unknown" }, 500);
  }
});
