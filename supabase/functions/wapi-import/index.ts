import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = (d: unknown) => new Response(JSON.stringify(d), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
const err = (m: string, s = 400) => new Response(JSON.stringify({ error: m }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: s });

function digits(s: string): string {
  return (s || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const WAPI_TOKEN = Deno.env.get("WAPI_TOKEN");
  const WAPI_INSTANCE_ID = Deno.env.get("WAPI_INSTANCE_ID");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!WAPI_TOKEN || !WAPI_INSTANCE_ID) return err("W-API credentials not configured", 500);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body allowed */ }
  const debug: boolean = !!body.debug;
  const maxChats: number = Math.min(Math.max(Number(body.maxChats) || 50, 1), 200);
  const messagesPerChat: number = Math.min(Math.max(Number(body.messagesPerChat) || 30, 1), 200);
  const onlyUnread: boolean = !!body.onlyUnread;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const WAPI_BASE = "https://api.w-api.app/v1";

  async function wapiGet(path: string, params: Record<string, string | number | boolean> = {}) {
    const qs = new URLSearchParams({ instanceId: WAPI_INSTANCE_ID!, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    const res = await fetch(`${WAPI_BASE}${path}?${qs.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${WAPI_TOKEN}`, "Content-Type": "application/json" },
    });
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
    return { ok: res.ok, status: res.status, data };
  }

  if (debug) {
    const chatsRes = await wapiGet("/chats/fetch-chats", { page: 1, perPage: 3 });
    const arr: any[] = Array.isArray(chatsRes.data?.chats) ? chatsRes.data.chats
      : Array.isArray(chatsRes.data?.data) ? chatsRes.data.data
      : Array.isArray(chatsRes.data) ? chatsRes.data : [];
    const sample = arr[0] || null;
    const sampleKeys = sample ? Object.keys(sample) : [];
    const rawId = sample?.id || sample?.chatId || "";
    const phone = digits(rawId);
    const tries: Record<string, any> = {};
    const candidates: Array<[string, Record<string,string>]> = [
      ["/message/messages-by-phone-number", { phoneNumber: phone }],
      ["/message/messages-by-phone", { phoneNumber: phone }],
      ["/message/fetch", { phoneNumber: phone }],
      ["/messages/by-phone", { phoneNumber: phone }],
      ["/chats/messages-by-chat", { chatId: rawId }],
      ["/chats/messages", { chatId: rawId }],
      ["/chats/fetch-messages", { chatId: rawId }],
      ["/messages/fetch", { chatId: rawId }],
    ];
    for (const [p, params] of candidates) {
      const r = await wapiGet(p, params);
      tries[p] = { status: r.status, snippet: JSON.stringify(r.data).slice(0, 200) };
    }
    return ok({ debug: true, chats_status: chatsRes.status, chats_count: arr.length, sampleKeys, samplePhone: phone, sample, tries });
  }

  try {
    // 1) Fetch chats
    const chatsRes = await wapiGet("/chats/fetch-chats", { page: 1, perPage: maxChats });
    if (!chatsRes.ok) return err(`W-API /chats falhou (${chatsRes.status}): ${JSON.stringify(chatsRes.data).slice(0, 200)}`, 502);

    const rawChats: any[] = Array.isArray(chatsRes.data?.chats)
      ? chatsRes.data.chats
      : Array.isArray(chatsRes.data?.data)
        ? chatsRes.data.data
        : Array.isArray(chatsRes.data)
          ? chatsRes.data
          : [];

    let chatsProcessed = 0;
    let messagesInserted = 0;
    const errors: string[] = [];

    for (const chat of rawChats.slice(0, maxChats)) {
      const phone = digits(chat.phone || chat.id || chat.chatId || chat.number || "");
      if (!phone || phone.length < 8) continue;
      // Skip groups (W-API marks groups with @g.us or isGroup)
      if (chat.isGroup || String(chat.id || "").includes("@g.us")) continue;
      if (onlyUnread && !(Number(chat.unreadCount) > 0)) continue;

      try {
        const msgRes = await wapiGet("/message/fetch-messages", { phone, perPage: messagesPerChat });
        if (!msgRes.ok) { errors.push(`${phone}: ${msgRes.status}`); continue; }

        const rawMsgs: any[] = Array.isArray(msgRes.data?.messages)
          ? msgRes.data.messages
          : Array.isArray(msgRes.data?.data)
            ? msgRes.data.data
            : Array.isArray(msgRes.data)
              ? msgRes.data
              : [];

        const rows = rawMsgs.map((m: any) => {
          const fromMe = !!(m.fromMe ?? m.from_me ?? m.isMine);
          const ts = m.moment || m.timestamp || m.t || m.messageTimestamp;
          const createdAt = ts
            ? new Date(typeof ts === "number" ? (ts < 1e12 ? ts * 1000 : ts) : ts).toISOString()
            : new Date().toISOString();
          const wapiId: string | null = m.messageId || m.id || m.key?.id || null;
          const text =
            m.text?.message ??
            m.message?.conversation ??
            m.body ??
            m.text ??
            (typeof m.content === "string" ? m.content : null);
          let msgType = "text";
          let mediaUrl: string | null = null;
          if (m.image || m.imageMessage || m.message?.imageMessage) { msgType = "image"; mediaUrl = m.image?.url || m.imageMessage?.url || null; }
          else if (m.audio || m.audioMessage || m.message?.audioMessage) { msgType = "audio"; mediaUrl = m.audio?.url || m.audioMessage?.url || null; }
          else if (m.video || m.videoMessage) { msgType = "video"; mediaUrl = m.video?.url || m.videoMessage?.url || null; }
          else if (m.document || m.documentMessage) { msgType = "document"; mediaUrl = m.document?.url || m.documentMessage?.url || null; }
          return {
            phone,
            wapi_message_id: wapiId,
            direction: fromMe ? "out" : "in",
            from_me: fromMe,
            body: typeof text === "string" ? text : null,
            message_type: msgType,
            media_url: mediaUrl,
            contact_name: chat.name || chat.contactName || null,
            status: fromMe ? "sent" : "received",
            raw: m,
            created_at: createdAt,
          };
        }).filter(r => r.wapi_message_id);

        if (rows.length > 0) {
          // upsert by wapi_message_id to avoid duplicates
          const { error: upErr, count } = await admin
            .from("whatsapp_messages")
            .upsert(rows, { onConflict: "wapi_message_id", ignoreDuplicates: true, count: "exact" });
          if (upErr) { errors.push(`${phone}: ${upErr.message}`); }
          else { messagesInserted += count || 0; }
        }
        chatsProcessed++;
      } catch (e: any) {
        errors.push(`${phone}: ${e.message || e}`);
      }
    }

    return ok({
      success: true,
      chats_found: rawChats.length,
      chats_processed: chatsProcessed,
      messages_inserted: messagesInserted,
      errors: errors.slice(0, 20),
    });
  } catch (e: any) {
    return err(e.message || String(e), 500);
  }
});