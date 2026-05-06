import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractVimeoParts(url: string): { id: string; hash: string | null } | null {
  const match = url.match(/vimeo\.com\/(?:manage\/videos\/|video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/i);
  if (!match?.[1]) return null;
  const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
  return { id: match[1], hash: match[2] || parsed.searchParams.get("h") };
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 FBFlix/1.0" },
  });
  if (!res.ok) return null;
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { searchParams } = new URL(req.url);
    const videoUrl = body.url || searchParams.get("url") || "";

    if (!videoUrl) {
      return new Response(JSON.stringify({ ok: false, error: "Missing url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parts = extractVimeoParts(videoUrl);
    if (!parts) {
      return new Response(JSON.stringify({ ok: false, error: "URL do Vimeo inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const publicUrl = `https://vimeo.com/${parts.id}${parts.hash ? `/${parts.hash}` : ""}`;

    const oembed = await fetchJson(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(publicUrl)}`);
    if (oembed?.thumbnail_url) {
      return new Response(JSON.stringify({ ok: true, thumbnailUrl: oembed.thumbnail_url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const legacy = await fetchJson(`https://vimeo.com/api/v2/video/${parts.id}.json`);
    const legacyThumb = legacy?.[0]?.thumbnail_large || legacy?.[0]?.thumbnail_medium || legacy?.[0]?.thumbnail_small;
    if (legacyThumb) {
      return new Response(JSON.stringify({ ok: true, thumbnailUrl: legacyThumb }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: "O Vimeo não liberou a miniatura. Normalmente isso acontece quando o vídeo está privado ou com incorporação restrita.",
      }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("vimeo-thumbnail error", e);
    return new Response(JSON.stringify({ ok: false, error: "Falha ao buscar miniatura no Vimeo" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
