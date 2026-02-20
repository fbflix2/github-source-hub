import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractFacebookHandleOrId(inputUrl: string): string | null {
  const url = inputUrl.trim();

  // profile.php?id=...
  const idMatch = url.match(/[?&]id=(\d+)/i);
  if (idMatch?.[1]) return idMatch[1];

  // facebook.com/<handle>
  const handleMatch = url.match(/facebook\.com\/([^/?#]+)/i);
  const handle = handleMatch?.[1];
  if (!handle) return null;

  const blocked = new Set([
    "profile.php",
    "people",
    "pages",
    "watch",
    "reel",
    "marketplace",
    "groups",
    "login",
    "settings",
    "help",
    "photo",
    "photo.php",
    "photos",
  ]);

  if (blocked.has(handle.toLowerCase())) return null;
  return handle;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const profileUrl = searchParams.get("url") || "";

    if (!profileUrl) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const handleOrId = extractFacebookHandleOrId(profileUrl);
    if (!handleOrId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Não consegui identificar o perfil/ID a partir desse link." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const graphUrl = `https://graph.facebook.com/${encodeURIComponent(handleOrId)}/picture?type=large&redirect=false`;

    const r = await fetch(graphUrl, { method: "GET" });

    if (!r.ok) {
      const body = await r.text();
      console.error("Graph API error:", r.status, body);
      return new Response(
        JSON.stringify({ ok: false, error: "Facebook Graph não retornou OK." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await r.json();
    const photoUrl = data?.data?.url ?? null;

    if (!photoUrl) {
      return new Response(
        JSON.stringify({ ok: false, error: "Não encontrei URL da foto (pode estar bloqueado/privado)." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, photoUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in fb-photo:", e);
    return new Response(
      JSON.stringify({ ok: false, error: "Falha ao buscar foto no Facebook." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
