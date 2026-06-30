import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK = `Olá {{nome}}, tudo bem?\n\nComo não recebemos retorno sobre a proteção do seu BM *{{bm}}*, vamos seguir e *remover nosso perfil matriz de backup* dele nas próximas horas. 🔓\n\nApós a remoção, caso seu perfil caia ou seja desabilitado, *não será mais possível* recuperar o acesso desse BM por aqui.\n\nSe ainda quiser ativar o *Safe BM (Cofre Digital)* e manter a proteção, acesse:\n👉 fbflix.com.br/safe-bm`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: offers, error } = await admin
      .from("whatsapp_logs")
      .select("id, phone, user_id, metadata, created_at")
      .eq("event_key", "safe_bm_offer")
      .eq("status", "sent")
      .lte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const { data: tpl } = await admin
      .from("whatsapp_templates")
      .select("message_body")
      .eq("event_key", "safe_bm_offer_followup")
      .eq("active", true)
      .maybeSingle();
    const template = tpl?.message_body || FALLBACK;

    const seenPhones = new Set<string>();
    const results: any[] = [];

    for (const o of offers || []) {
      if (seenPhones.has(o.phone)) continue; // only process most recent offer per phone
      seenPhones.add(o.phone);

      // Skip if a followup was already sent for this stock_item
      const stockId = (o.metadata as any)?.stock_item_id;
      if (stockId) {
        const { data: prev } = await admin
          .from("whatsapp_logs")
          .select("id")
          .eq("event_key", "safe_bm_offer_followup")
          .contains("metadata", { stock_item_id: stockId })
          .limit(1);
        if (prev && prev.length > 0) continue;
      }

      // Skip if client replied after the offer
      const { data: replies } = await admin
        .from("whatsapp_messages")
        .select("id")
        .eq("phone", o.phone)
        .eq("direction", "in")
        .gte("created_at", o.created_at)
        .limit(1);
      if (replies && replies.length > 0) continue;

      const meta = (o.metadata || {}) as any;
      const nome = meta.nome || "Cliente";
      const bm = meta.bm || "";
      const message = template.split("{{nome}}").join(nome).split("{{bm}}").join(bm);

      const inv = await admin.functions.invoke("wapi-send", {
        body: {
          action: "send-text",
          phone: o.phone,
          message,
          user_id: o.user_id,
          event_key: "safe_bm_offer_followup",
          metadata: { stock_item_id: stockId, original_log_id: o.id },
        },
      });
      results.push({ phone: o.phone, ok: !inv.error });
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});