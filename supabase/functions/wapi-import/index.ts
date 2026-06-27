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
  const targetPhone: string | null = body.phone ? digits(String(body.phone)) : null;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const WAPI_BASE = "https://api.w-api.app/v1";

  try {
    await admin.storage.createBucket("whatsapp-media", { public: true });
  } catch (_) { /* already exists */ }

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

  async function wapiTry(method: "GET" | "POST", path: string, params: Record<string,string>, body?: any) {
    const qs = new URLSearchParams({ instanceId: WAPI_INSTANCE_ID! });
    if (method === "GET") for (const [k,v] of Object.entries(params)) qs.append(k, v);
    const url = `${WAPI_BASE}${path}?${qs}`;
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${WAPI_TOKEN}`, "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify(body ?? params) : undefined,
    });
    const t = await res.text();
    return { status: res.status, snippet: t.slice(0, 180) };
  }

  async function wapiDownloadMedia(payload: Record<string, any>): Promise<string | null> {
    try {
      const qs = new URLSearchParams({ instanceId: WAPI_INSTANCE_ID! });
      const res = await fetch(`${WAPI_BASE}/message/download-media?${qs.toString()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${WAPI_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch { return null; }
      const link = data?.fileLink || data?.url || data?.mediaUrl || data?.data?.fileLink || data?.data?.url;
      if (link && typeof link === "string") return link;
      const b64 = data?.base64 || data?.data?.base64;
      const mime = data?.mimetype || data?.data?.mimetype || payload.mimetype || "application/octet-stream";
      if (b64) return `data:${mime};base64,${b64}`;
      return null;
    } catch (e) {
      console.error("import download-media error:", e);
      return null;
    }
  }

  async function rehostToStorage(srcUrl: string, ext: string): Promise<string | null> {
    try {
      let bytes: Uint8Array;
      let contentType = "application/octet-stream";
      if (srcUrl.startsWith("data:")) {
        const m = srcUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) return null;
        contentType = m[1];
        const bin = atob(m[2]);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } else {
        const r = await fetch(srcUrl);
        if (!r.ok) return null;
        contentType = r.headers.get("content-type") || contentType;
        bytes = new Uint8Array(await r.arrayBuffer());
      }
      const path = `${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${ext}`;
      const { error } = await admin.storage.from("whatsapp-media").upload(path, bytes, { contentType, upsert: false });
      if (error) return null;
      const { data } = admin.storage.from("whatsapp-media").getPublicUrl(path);
      return data.publicUrl;
    } catch (e) {
      console.error("import rehost error:", e);
      return null;
    }
  }

  const pick = (...values: any[]) => values.find((v) => v !== undefined && v !== null && v !== "");

  function normalizeTimestamp(ts: any): string {
    if (!ts) return new Date().toISOString();
    const n = Number(ts);
    if (!Number.isNaN(n) && Number.isFinite(n)) return new Date(n < 1e12 ? n * 1000 : n).toISOString();
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  function getContent(m: any) {
    return pick(m?.msgContent, m?.message?.msgContent, m?.data?.msgContent, m?.message?.message, m?.data?.message?.message, m?.message, m?.data?.message, m) || {};
  }

  function getMediaNode(content: any, m: any, kind: "image" | "audio" | "video" | "document" | "sticker") {
    const key = `${kind}Message`;
    return pick(
      content?.[key], m?.[key], m?.message?.[key], m?.data?.message?.[key],
      m?.message?.message?.[key], m?.data?.message?.message?.[key],
      m?.[kind], m?.message?.[kind], m?.data?.message?.[kind],
    ) || null;
  }

  function rawMessages(data: any): any[] {
    return Array.isArray(data?.messages) ? data.messages
      : Array.isArray(data?.data?.messages) ? data.data.messages
      : Array.isArray(data?.data) ? data.data
      : Array.isArray(data) ? data
      : [];
  }

  async function buildMessageRow(m: any, phone: string, chat: any = {}) {
    const content = getContent(m);
    const fromMe = !!pick(m.fromMe, m.from_me, m.isMine, m.key?.fromMe, m.message?.key?.fromMe, m.data?.key?.fromMe, false);
    const ts = pick(m.moment, m.timestamp, m.t, m.messageTimestamp, m.createdAt, m.created_at);
    const wapiId: string | null = pick(m.messageId, m.id, m.key?.id, m.message?.key?.id, m.data?.key?.id, null);
    const imageNode = getMediaNode(content, m, "image");
    const audioNode = getMediaNode(content, m, "audio");
    const videoNode = getMediaNode(content, m, "video");
    const documentNode = getMediaNode(content, m, "document");
    const stickerNode = getMediaNode(content, m, "sticker");
    const text = pick(
      content?.conversation,
      content?.extendedTextMessage?.text,
      content?.text,
      content?.body,
      imageNode?.caption,
      videoNode?.caption,
      documentNode?.caption,
      m.text?.message,
      m.body,
      typeof m.content === "string" ? m.content : null,
    );
    let msgType = "text";
    let mediaNode: any = null;
    if (imageNode) { msgType = "image"; mediaNode = imageNode; }
    else if (audioNode) { msgType = "audio"; mediaNode = audioNode; }
    else if (videoNode) { msgType = "video"; mediaNode = videoNode; }
    else if (documentNode) { msgType = "document"; mediaNode = documentNode; }
    else if (stickerNode) { msgType = "sticker"; mediaNode = stickerNode; }
    const directUrl = pick(mediaNode?.url, m.imageUrl, m.audioUrl, m.videoUrl, m.documentUrl, m.mediaUrl);
    let mediaUrl: string | null = directUrl || null;
    if (mediaNode && ["image", "audio", "video", "document", "sticker"].includes(msgType)) {
      const ext = msgType === "image" ? "jpg"
        : msgType === "audio" ? "ogg"
        : msgType === "video" ? "mp4"
        : msgType === "sticker" ? "webp"
        : (mediaNode.fileName?.split(".").pop() || "bin");
      const decrypted = await wapiDownloadMedia({
        messageId: wapiId,
        phone,
        chatId: pick(chat.id, chat.chatId, m.chatId, m.key?.remoteJid),
        type: msgType,
        mediaKey: pick(mediaNode.mediaKey, mediaNode.media_key, mediaNode.mediaKeyTimestamp),
        directPath: pick(mediaNode.directPath, mediaNode.direct_path),
        url: directUrl,
        mimetype: mediaNode.mimetype || (msgType === "audio" ? "audio/ogg; codecs=opus" : undefined),
      });
      const publicUrl = decrypted ? await rehostToStorage(decrypted, ext) : null;
      if (publicUrl) mediaUrl = publicUrl;
      if (!mediaUrl && msgType === "image" && (mediaNode.jpegThumbnail || mediaNode.JPEGThumbnail)) {
        mediaUrl = await rehostToStorage(`data:image/jpeg;base64,${mediaNode.jpegThumbnail || mediaNode.JPEGThumbnail}`, "jpg");
      }
    }
    return {
      phone,
      chat_id: pick(chat.id, chat.chatId, m.chatId, m.key?.remoteJid, m.message?.key?.remoteJid, null),
      wapi_message_id: wapiId,
      direction: fromMe ? "out" : "in",
      from_me: fromMe,
      body: typeof text === "string" ? text : null,
      message_type: msgType,
      media_url: mediaUrl,
      contact_name: pick(chat.name, chat.contactName, chat.pushName, m.sender?.pushName, null),
      status: fromMe ? "sent" : "received",
      raw: m,
      created_at: normalizeTimestamp(ts),
    };
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
    // Also try variants
    const more: Array<[string, "GET"|"POST", Record<string,string>]> = [
      ["/chats/fetch-messages-by-chat", "GET", { chatId: rawId }],
      ["/chats/fetch-messages-by-chat", "GET", { phoneNumber: phone }],
      ["/chats/get-messages", "GET", { chatId: rawId }],
      ["/chats/messages-from-chat", "GET", { chatId: rawId }],
      ["/chats/list-messages", "GET", { chatId: rawId }],
      ["/messages/list", "GET", { chatId: rawId }],
      ["/messages/chat", "GET", { chatId: rawId }],
      ["/message/get-messages", "GET", { phoneNumber: phone }],
      ["/chats/messages", "POST", { chatId: rawId }],
      ["/chats/fetch-messages", "POST", { chatId: rawId }],
      ["/message/messages-by-phone", "POST", { phoneNumber: phone }],
    ];
    for (const [p, m, params] of more) {
      const r = await wapiTry(m, p, params);
      if (r.status !== 404) tries[`${m} ${p}`] = r;
    }
    return ok({ debug: true, chats_status: chatsRes.status, chats_count: arr.length, sampleKeys, samplePhone: phone, sample, tries });
  }

  try {
    if (targetPhone) {
      const msgRes = await wapiGet("/message/fetch-messages", { phone: targetPhone, perPage: messagesPerChat });
      if (!msgRes.ok) return err(`W-API /message/fetch-messages falhou (${msgRes.status}): ${JSON.stringify(msgRes.data).slice(0, 200)}`, 502);
      const rows = (await Promise.all(rawMessages(msgRes.data).map((m: any) => buildMessageRow(m, targetPhone))))
        .filter((r: any) => r.wapi_message_id);
      let messagesUpserted = 0;
      if (rows.length > 0) {
        const { error: upErr, count } = await admin
          .from("whatsapp_messages")
          .upsert(rows, { onConflict: "wapi_message_id", count: "exact" });
        if (upErr) return err(`Supabase upsert falhou: ${upErr.message}`, 500);
        messagesUpserted = count || rows.length;
      }
      return ok({ success: true, phone: targetPhone, messages_upserted: messagesUpserted });
    }

    // 1) Fetch chats
    const rawChats: any[] = [];
    let page = 1;
    const maxPages = Math.min(30, Math.max(3, Math.ceil(maxChats / 20) + 6));
    while (rawChats.length < maxChats && page <= maxPages) {
      const chatsRes = await wapiGet("/chats/fetch-chats", { page, perPage: 50 });
      if (!chatsRes.ok) {
        if (page === 1) return err(`W-API /chats falhou (${chatsRes.status}): ${JSON.stringify(chatsRes.data).slice(0, 200)}`, 502);
        break;
      }
      const pageChats: any[] = Array.isArray(chatsRes.data?.chats)
        ? chatsRes.data.chats
        : Array.isArray(chatsRes.data?.data)
          ? chatsRes.data.data
          : Array.isArray(chatsRes.data)
            ? chatsRes.data
            : [];
      if (!pageChats.length) break;
      for (const chat of pageChats) {
        const id = String(chat.id || chat.chatId || "");
        if (chat.isGroup || id.includes("@g.us") || id.includes("@broadcast") || id.startsWith("status@")) continue;
        const phone = digits(chat.phone || chat.id || chat.chatId || chat.number || "");
        if (!phone || phone.length < 8) continue;
        if (onlyUnread && !(Number(chat.unreadCount) > 0)) continue;
        rawChats.push(chat);
        if (rawChats.length >= maxChats) break;
      }
      page++;
    }

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

        const rows = (await Promise.all(rawMessages(msgRes.data).map((m: any) => buildMessageRow(m, phone, chat))))
          .filter((r: any) => r.wapi_message_id);

        if (rows.length > 0) {
          // upsert by wapi_message_id to avoid duplicates
          const { error: upErr, count } = await admin
            .from("whatsapp_messages")
            .upsert(rows, { onConflict: "wapi_message_id", count: "exact" });
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