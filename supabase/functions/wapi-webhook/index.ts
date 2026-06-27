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
    const messageId =
      body.messageId || body.id || body.data?.messageId || body.data?.id ||
      body.key?.id || body.message?.key?.id || body.data?.key?.id || body.data?.message?.key?.id ||
      body.message?.id || body.data?.message?.id || body.msg?.key?.id || body.data?.msg?.key?.id;
    const status = body.status || body.data?.status || body.type;
    const mc =
      body.msgContent || body.data?.msgContent || body.message?.msgContent || body.data?.message?.msgContent ||
      body.message?.message || body.data?.message?.message || body.message || body.data?.message || {};
    const reactionEmoji = mc.reactionMessage?.text || null;
    const replyMessage =
      mc.conversation ||
      mc.text ||
      mc.body ||
      mc.extendedTextMessage?.text ||
      mc.imageMessage?.caption ||
      mc.videoMessage?.caption ||
      mc.documentMessage?.caption ||
      mc.templateButtonReplyMessage?.selectedDisplayText ||
      mc.buttonsResponseMessage?.selectedDisplayText ||
      mc.listResponseMessage?.title ||
      body.message?.conversation || body.data?.message?.conversation ||
      body.message?.extendedTextMessage?.text || body.data?.message?.extendedTextMessage?.text ||
      (reactionEmoji ? `Reagiu com ${reactionEmoji}` : null) ||
      body.message?.text || body.data?.message?.text || body.text || body.body || body.data?.text || body.data?.body || null;
    const chatId =
      body.chatId || body.chat?.id || body.data?.chatId || body.data?.chat?.id ||
      body.key?.remoteJid || body.message?.key?.remoteJid || body.data?.key?.remoteJid || body.data?.message?.key?.remoteJid ||
      body.remoteJid || body.data?.remoteJid || body.to || body.data?.to ||
      body.recipient?.id || body.data?.recipient?.id || body.phone || body.data?.phone;
    const senderId =
      body.sender?.id || body.data?.sender?.id || body.participant || body.data?.participant ||
      body.key?.participant || body.message?.key?.participant || body.data?.key?.participant || body.data?.message?.key?.participant || null;
    const fromMe = body.fromMe ?? body.data?.fromMe ?? body.key?.fromMe ?? body.message?.key?.fromMe ?? body.data?.key?.fromMe ?? body.data?.message?.key?.fromMe ?? null;
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

    // Extract the real customer phone. New WhatsApp/W-API payloads may send the chat id
    // as an anonymized @lid; for incoming replies, the real number is in sender.id.
    const rawChat = chatId || body.chat?.id || senderId;
    const rawChatStr = String(rawChat || "");
    const rawSenderStr = String(senderId || "");
    const isSenderLid = rawSenderStr.includes("@lid") || rawSenderStr.includes("@broadcast") || rawSenderStr.includes("status@");
    const isChatLid = rawChatStr.includes("@lid");
    const onlyDigits = (v: any) => String(v || "").replace(/@.*/, "").replace(/\D/g, "");
    const phoneDigits = (v: any) => {
      const s = String(v || "");
      if (s.includes("@lid") || s.includes("@broadcast") || s.includes("status@")) return "";
      return onlyDigits(s);
    };
    const senderPhone = rawSenderStr && !isSenderLid ? onlyDigits(rawSenderStr) : null;
    const chatPhone = rawChatStr && !isChatLid ? onlyDigits(rawChatStr) : null;
    const explicitPhone =
      phoneDigits(body.phone || body.data?.phone || body.phoneNumber || body.data?.phoneNumber ||
        body.recipient?.phone || body.data?.recipient?.phone || body.toPhone || body.data?.toPhone);
    let phone = fromMe === false && senderPhone
      ? senderPhone
      : (explicitPhone || chatPhone || senderPhone || null);

    // When messages are sent from the cellphone/WhatsApp Web, W-API can send the
    // conversation as @lid instead of the real phone. Reuse an already-known CRM
    // mapping for that LID so the outgoing message appears in the same customer thread.
    if ((!phone || phone.length < 8) && isChatLid && rawChatStr) {
      const { data: mapped } = await admin
        .from("whatsapp_messages")
        .select("phone")
        .eq("chat_id", rawChatStr)
        .not("phone", "like", "%@%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mapped?.phone) phone = mapped.phone;
    }
    const event = body.event || body.data?.event || body.type;

    // ========= CRM: persist message to whatsapp_messages =========
    // Ignore WhatsApp LID (linked-id) pseudo-numbers — these are not real contacts,
    // they are anonymized identifiers used for our own status callbacks/broadcasts.
    const isLid = (rawChatStr.includes("@lid") && !phone && !replyMessage) || rawChatStr.includes("@broadcast") || rawChatStr.includes("status@");
    const eventLower = String(event || "").toLowerCase();
    // Only treat as a real CRM message when it is a true incoming message or a real outgoing send,
    // NOT when it is just a delivery/read status webhook for one of OUR messages.
    const isStatusEvent = eventLower.includes("status") || eventLower === "messagestatus" || eventLower === "webhookstatus";
    // Skip protocol/edit/encrypted meta-messages that have no real visible content.
    // These produce empty bubbles in the CRM (WhatsApp message edits, deletes, key rotations, etc.).
    const mcKeys = Object.keys(mc || {}).filter((k) => k !== "messageContextInfo");
    const isProtocolOnly =
      (mcKeys.length === 0 && !replyMessage) ||
      mcKeys.every((k) => k === "protocolMessage" || k === "senderKeyDistributionMessage" || k === "secretEncryptedMessage");
    if (phone && !isGroup && !isLid && !isStatusEvent && !isProtocolOnly) {
      const hasVisibleContent = !!replyMessage || !!mc?.conversation || !!mc?.extendedTextMessage || !!mc?.imageMessage || !!mc?.audioMessage || !!mc?.videoMessage || !!mc?.documentMessage || !!mc?.reactionMessage || !!mc?.stickerMessage || !!body.message?.imageUrl || !!body.message?.audioUrl || !!body.message?.videoUrl || !!body.data?.message?.imageUrl;
      const isIn = fromMe === false && (body.type === "ReceivedCallback" || eventLower === "webhookreceived" || eventLower === "messages.upsert" || hasVisibleContent);
      // Delivery webhook is fired for messages sent outside the CRM (phone/WhatsApp Web).
      // If it contains real content, persist it as an outgoing CRM message too.
      const isOut = fromMe === true || (eventLower === "webhookdelivery" && hasVisibleContent);
      if ((isIn || isOut) && hasVisibleContent) {
        const contactName =
          body.sender?.pushName || body.sender?.verifiedBizName ||
          body.data?.sender?.pushName || body.data?.sender?.verifiedBizName ||
          body.senderName || body.notifyName || body.chat?.name || body.data?.senderName || body.data?.chat?.name || null;
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
          const row = {
            phone,
            chat_id: chatId || null,
            wapi_message_id: messageId || null,
            direction: isIn ? "in" : "out",
            from_me: !!isOut,
            body: replyMessage || null,
            message_type: msgType,
            media_url: mediaUrl,
            contact_name: contactName,
            status: isIn ? "received" : "sent",
            raw: body,
          };
          if (messageId) {
            await admin.from("whatsapp_messages").upsert(row, {
              onConflict: "wapi_message_id",
              ignoreDuplicates: true,
            });
          } else {
            await admin.from("whatsapp_messages").insert(row);
          }
        } catch (e) {
          console.error("CRM insert error:", e);
        }
      }
    }

    // Try to find the log entry
    let logEntry = null;

    // ========= CRM: update outgoing message status (sent/delivered/read) =========
    // W-API sends status callbacks (messageStatus / webhookStatus) that reference
    // one of OUR outgoing messages by messageId. Reflect those on whatsapp_messages
    // so the CRM ticks update live (single check → double check → green double check).
    try {
      const normalized = (status || "").toString().toLowerCase();
      const evt = String(event || "").toLowerCase();
      let newStatus: string | null = null;
      if (normalized === "read" || normalized === "viewed" || normalized === "played" || evt.includes("read")) {
        newStatus = "read";
      } else if (
        normalized === "delivered" || normalized === "received" ||
        normalized === "server" || normalized === "device" ||
        evt.includes("delivery") || evt.includes("delivered")
      ) {
        newStatus = "delivered";
      } else if (normalized === "sent" || normalized === "pending") {
        newStatus = "sent";
      }
      const rank: Record<string, number> = { sent: 1, delivered: 2, read: 3 };
      if (newStatus && messageId) {
        const { data: existing } = await admin
          .from("whatsapp_messages")
          .select("id,status")
          .eq("wapi_message_id", messageId)
          .limit(1)
          .maybeSingle();
        if (existing) {
          const currRank = rank[existing.status as string] || 0;
          const nextRank = rank[newStatus] || 0;
          if (nextRank > currRank) {
            await admin
              .from("whatsapp_messages")
              .update({ status: newStatus })
              .eq("id", existing.id);
          }
        }
      }
    } catch (e) {
      console.error("CRM status update error:", e);
    }

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