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

    // 1) Raspagem da página com UA de crawler — pega og:image (foto REAL) e og:title (nome)
    let name: string | null = null;
    let photoUrl: string | null = null;
    let friendsCount: number | null = null;
    try {
      const pageResp = await fetch(profileUrl, {
        headers: { "user-agent": "facebookexternalhit/1.1" },
        redirect: "follow",
      });
      if (pageResp.ok) {
        const html = await pageResp.text();
        const decode = (s: string) =>
          s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'");
        const og = html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i)
          || html.match(/og:title["']\s+content=["']([^"']+)["']/i);
        const title = og?.[1] || html.match(/<title>([^<]+)<\/title>/i)?.[1] || null;
        if (title && !/^error$/i.test(title.trim())) {
          name = decode(title.replace(/\s*\|\s*Facebook\s*$/i, "").trim());
        }
        const ogImg = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)
          || html.match(/og:image["']\s+content=["']([^"']+)["']/i);
        if (ogImg?.[1]) photoUrl = decode(ogImg[1]);

        // Tenta extrair contagem de amigos do og:description ou do HTML
        const ogDesc = html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] || "";
        const haystack = decode(ogDesc + " " + html);
        const parseNum = (s: string) => {
          const n = parseFloat(s.replace(/[\.,](?=\d{3}\b)/g, "").replace(",", "."));
          if (isNaN(n)) return null;
          return Math.round(n);
        };
        const patterns = [
          /([\d.,]+)\s*(?:mil|k)?\s*amigos/i,
          /([\d.,]+)\s*(?:mil|k)?\s*friends/i,
          /"friend_count"\s*:\s*(\d+)/i,
          /"friendsCount"\s*:\s*(\d+)/i,
        ];
        for (const re of patterns) {
          const m = haystack.match(re);
          if (m?.[1]) {
            let n = parseNum(m[1]);
            if (n !== null) {
              if (/mil|k/i.test(m[0]) && n < 10000) n = Math.round(n * 1000);
              friendsCount = n;
              break;
            }
          }
        }
      }
    } catch (e) {
      console.warn("page scrape failed:", e);
    }

    // 2) Fallback: Graph API /picture (geralmente retorna só placeholder para esses perfis)
    if (!photoUrl) {
      try {
        const graphUrl = `https://graph.facebook.com/${encodeURIComponent(handleOrId)}/picture?type=large&redirect=false`;
        const r = await fetch(graphUrl);
        if (r.ok) {
          const data = await r.json();
          photoUrl = data?.data?.url ?? null;
        }
      } catch (e) {
        console.warn("graph fallback failed:", e);
      }
    }

    if (!photoUrl) {
      return new Response(
        JSON.stringify({ ok: false, error: "Foto não encontrada (perfil pode estar bloqueado/privado).", name }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, photoUrl, name, friendsCount }),
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
