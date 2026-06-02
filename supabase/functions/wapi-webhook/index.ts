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
  const WAPI_TOKEN = Deno.env.get("WAPI_TOKEN");
  const WAPI_INSTANCE_ID = Deno.env.get("WAPI_INSTANCE_ID");
  const WAPI_BASE = "https://api.w-api.app/v1";

  // Ensure storage bucket exists (idempotent, cheap on hot starts)
  try {
    await admin.storage.createBucket("whatsapp-media", { public: true });
  } catch (_) { /* already exists */ }

  // Try W-API native download endpoint; returns { fileLink } or base64
  async function wapiDownloadMedia(payload: Record<string, any>): Promise<string | null> {
    if (!WAPI_TOKEN || !WAPI_INSTANCE_ID) return null;
    try {
      const url = `${WAPI_BASE}/message/download-media?instanceId=${WAPI_INSTANCE_ID}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${WAPI_TOKEN}` },
        body: JSON.stringify(payload),
      });
      const txt = await res.text();
      let data: any = null;
      try { data = JSON.parse(txt); } catch { return null; }
      // Common shapes: { fileLink }, { url }, { mediaUrl }, { base64, mimetype }
      const link = data?.fileLink || data?.url || data?.mediaUrl || data?.data?.fileLink || data?.data?.url;
      if (link && typeof link === "string") return link;
      const b64 = data?.base64 || data?.data?.base64;
      const mime = data?.mimetype || data?.data?.mimetype || "application/octet-stream";
      if (b64) return `data:${mime};base64,${b64}`;
      return null;
    } catch (e) {
      console.error("download-media error:", e);
      return null;
    }
  }

  // Upload a remote URL (http or data:) to whatsapp-media bucket and return public URL
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
      const { error } = await admin.storage.from("whatsapp-media").upload(path, bytes, {
        contentType, upsert: false,
      });
      if (error) { console.error("storage upload error:", error); return null; }
      const { data } = admin.storage.from("whatsapp-media").getPublicUrl(path);
      return data.publicUrl;
    } catch (e) {
      console.error("rehost error:", e);
      return null;
    }
  }

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).slice(0, 800));

    // W-API webhook fields
    const messageId = body.messageId || body.id || body.data?.messageId || body.data?.id;
    const status = body.status || body.data?.status || body.type;
    const mc = body.msgContent || body.data?.msgContent || {};
    const reactionEmoji = mc.reactionMessage?.text || null;
    const replyMessage =
      mc.conversation ||
      mc.extendedTextMessage?.text ||
      mc.imageMessage?.caption ||
      mc.videoMessage?.caption ||
      mc.documentMessage?.caption ||
      mc.buttonsResponseMessage?.selectedDisplayText ||
      mc.listResponseMessage?.title ||
      (reactionEmoji ? `Reagiu com ${reactionEmoji}` : null) ||
      body.message?.text || body.data?.message?.text || body.text || body.body || null;
    const chatId = body.chatId || body.chat?.id || body.data?.chatId || body.phone || body.chat?.id;
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

    // Extract phone number from chatId (or sender)
    const rawChat = chatId || body.chat?.id || body.sender?.id;
    const phone = rawChat ? String(rawChat).replace(/@.*/, "").replace(/\D/g, "") : null;
    const event = body.event || body.data?.event || body.type;

    // ========= CRM: persist message to whatsapp_messages =========
    // Ignore WhatsApp LID (linked-id) pseudo-numbers — these are not real contacts,
    // they are anonymized identifiers used for our own status callbacks/broadcasts.
    const rawChatStr = String(rawChat || "");
    const isLid = rawChatStr.includes("@lid") || rawChatStr.includes("@broadcast") || rawChatStr.includes("status@");
    const eventLower = String(event || "").toLowerCase();
    // Only treat as a real CRM message when it is a true incoming message or a real outgoing send,
    // NOT when it is just a delivery/read status webhook for one of OUR messages.
    const isStatusEvent = eventLower.includes("status") || eventLower === "messagestatus" || eventLower === "webhookstatus";
    // Skip protocol/edit/encrypted meta-messages that have no real visible content.
    // These produce empty bubbles in the CRM (WhatsApp message edits, deletes, key rotations, etc.).
    const mcKeys = Object.keys(mc || {}).filter((k) => k !== "messageContextInfo");
    const isProtocolOnly =
      mcKeys.length === 0 ||
      mcKeys.every((k) => k === "protocolMessage" || k === "senderKeyDistributionMessage" || k === "secretEncryptedMessage");
    if (phone && !isGroup && !isLid && !isStatusEvent && !isProtocolOnly) {
      const isIn = fromMe === false && (body.type === "ReceivedCallback" || eventLower === "webhookreceived" || eventLower === "messages.upsert" || !!mc?.conversation || !!mc?.extendedTextMessage || !!mc?.imageMessage || !!mc?.audioMessage || !!mc?.videoMessage || !!mc?.documentMessage || !!mc?.reactionMessage || !!mc?.stickerMessage);
      const isOut = fromMe === true;
      if (isIn || isOut) {
        const contactName =
          body.sender?.pushName || body.sender?.verifiedBizName ||
          body.senderName || body.notifyName || body.chat?.name || body.data?.senderName || null;
        let mediaUrl: string | null =
          mc.imageMessage?.url || mc.audioMessage?.url || mc.videoMessage?.url || mc.documentMessage?.url ||
          body.message?.imageUrl || body.message?.audioUrl || body.message?.videoUrl || body.data?.message?.imageUrl || null;
        const msgType =
          mc.reactionMessage ? "reaction" :
          mc.imageMessage ? "image" :
          mc.audioMessage ? "audio" :
          mc.videoMessage ? "video" :
          mc.documentMessage ? "document" :
          mc.stickerMessage ? "sticker" :
          body.message?.imageUrl ? "image" : body.message?.audioUrl ? "audio" : body.message?.videoUrl ? "video" : "text";

        // The raw mmg.whatsapp.net URLs are encrypted and not directly playable/viewable.
        // Rehost media to public Supabase Storage so the CRM can render it.
        if (["image","audio","video","document","sticker"].includes(msgType)) {
          const ext = msgType === "image" ? "jpg"
            : msgType === "audio" ? "ogg"
            : msgType === "video" ? "mp4"
            : msgType === "sticker" ? "webp"
            : (mc.documentMessage?.fileName?.split(".").pop() || "bin");

          // 1) Try W-API decrypted download endpoint (works for encrypted WhatsApp media)
          //    W-API requires: mediaKey, directPath, type, mimetype
          const mediaNode =
            mc.imageMessage || mc.audioMessage || mc.videoMessage ||
            mc.documentMessage || mc.stickerMessage || {};
          const dlPayload: Record<string, any> = {
            messageId, phone, chatId,
            type: msgType,
            mediaKey: mediaNode.mediaKey,
            directPath: mediaNode.directPath,
            url: mediaNode.url,
            mimetype: mediaNode.mimetype || (msgType === "audio" ? "audio/ogg; codecs=opus" : undefined),
          };
          let decrypted: string | null = null;
          if (dlPayload.mediaKey && dlPayload.directPath) {
            decrypted = await wapiDownloadMedia(dlPayload);
          }
          let publicUrl: string | null = null;
          if (decrypted) publicUrl = await rehostToStorage(decrypted, ext);

          // 2) Image fallback: use the inline jpegThumbnail (always present in payload)
          if (!publicUrl && msgType === "image" && mc.imageMessage?.jpegThumbnail) {
            publicUrl = await rehostToStorage(
              `data:image/jpeg;base64,${mc.imageMessage.jpegThumbnail}`, "jpg",
            );
          }

          if (publicUrl) mediaUrl = publicUrl;
        }
        try {
          await admin.from("whatsapp_messages").insert({
            phone,
            chat_id: chatId || null,
            wapi_message_id: messageId || null,
            direction: isIn ? "in" : "out",
            from_me: !!isOut,
            body: replyMessage || null,
            message_type: msgType,
            media_url: mediaUrl,
            contact_name: contactName,
            status: "received",
            raw: body,
          });
        } catch (e) {
          console.error("CRM insert error:", e);
        }
      }
    }

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
    // `event` is already declared above; reuse it lowercased here
    const eventStr = String(event || "").toLowerCase();

    // Status progression: sent -> delivered -> read
    const currentStatus = logEntry.status;

    if (normalizedStatus === "delivered" || normalizedStatus === "received" || normalizedStatus === "server" || eventStr.includes("delivery")) {
      if (currentStatus === "sent" || currentStatus === "delivered") {
        updates.delivered_at = now;
        updates.status = "delivered";
      }
    }

    if (normalizedStatus === "read" || normalizedStatus === "viewed" || eventStr.includes("read")) {
      updates.delivered_at = updates.delivered_at || now;
      updates.read_at = now;
      updates.status = "read";
    }

    // Incoming message = reply (not from us)
    if (fromMe === false || body.type === "ReceivedCallback" || body.event === "messages.upsert" || eventStr === "webhookreceived") {
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