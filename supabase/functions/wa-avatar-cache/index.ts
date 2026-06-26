import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "whatsapp-media";

function publicUrl(supaUrl: string, path: string) {
  return `${supaUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function fetchWapiProfilePic(phone: string, token: string, instanceId: string): Promise<string | null> {
  try {
    const url = `https://api.w-api.app/v1/contacts/profile-image?phoneNumber=${encodeURIComponent(phone)}&instanceId=${encodeURIComponent(instanceId)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null);
    return j?.profilePicUrl || j?.profilePicture || j?.imgUrl || j?.url || null;
  } catch { return null; }
}

async function downloadAndCache(
  admin: any,
  phone: string,
  imageUrl: string,
  supaUrl: string,
): Promise<string | null> {
  try {
    const r = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://web.whatsapp.com/" },
    });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "image/jpeg";
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.byteLength < 200) return null;
    const path = `avatars/${phone}.jpg`;
    const { error } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType: ct, upsert: true, cacheControl: "86400",
    });
    if (error) { console.error("upload error", error); return null; }
    return `${publicUrl(supaUrl, path)}?v=${Date.now()}`;
  } catch (e) {
    console.error("downloadAndCache failed", e);
    return null;
  }
}

function isCached(url: string | null, supaUrl: string): boolean {
  if (!url) return false;
  return url.includes(`/storage/v1/object/public/${BUCKET}/avatars/`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const WAPI_TOKEN = Deno.env.get("WAPI_TOKEN")!;
  const WAPI_INSTANCE_ID = Deno.env.get("WAPI_INSTANCE_ID")!;
  const admin = createClient(SUPABASE_URL, SERVICE);

  try {
    const body = await req.json().catch(() => ({}));
    const phones: string[] = Array.isArray(body?.phones) ? body.phones.slice(0, 50) : [];
    const force: boolean = !!body?.force;
    if (!phones.length) {
      return new Response(JSON.stringify({ updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: convos } = await admin
      .from("whatsapp_conversations")
      .select("phone, avatar_url")
      .in("phone", phones);

    const map = new Map((convos || []).map((c: any) => [c.phone, c.avatar_url as string | null]));
    let updated = 0;
    const results: Record<string, string | null> = {};

    await Promise.all(phones.map(async (phone) => {
      const current = map.get(phone) ?? null;
      if (!force && isCached(current, SUPABASE_URL)) {
        results[phone] = current;
        return;
      }
      // 1) Try the URL already stored (refresh from WA CDN)
      let cached: string | null = null;
      if (current && !isCached(current, SUPABASE_URL)) {
        cached = await downloadAndCache(admin, phone, current, SUPABASE_URL);
      }
      // 2) Fallback: ask W-API for fresh URL
      if (!cached) {
        const fresh = await fetchWapiProfilePic(phone, WAPI_TOKEN, WAPI_INSTANCE_ID);
        if (fresh) cached = await downloadAndCache(admin, phone, fresh, SUPABASE_URL);
      }
      if (cached) {
        await admin.from("whatsapp_conversations")
          .update({ avatar_url: cached }).eq("phone", phone);
        updated++;
        results[phone] = cached;
      } else {
        results[phone] = current;
      }
    }));

    return new Response(JSON.stringify({ updated, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
// deploy trigger 1782516388
