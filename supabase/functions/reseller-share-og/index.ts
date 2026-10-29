import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const httpsImage = (v: unknown): string | null => {
  try { const u = new URL(String(v)); return u.protocol === "https:" ? u.href : null; } catch { return null; }
};
Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const slug = new URL(req.url).searchParams.get("slug")?.trim().toLowerCase();
  if (!slug || !/^[a-z0-9_-]{1,80}$/.test(slug)) return new Response("Invalid reseller", { status: 400 });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: reseller, error } = await db.from("resellers")
      .select("slug, status, brand_name, company_name, logo_url, favicon_url, hero_subtitle, about_text, custom_domain")
      .eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!reseller || reseller.status !== "active") return new Response("Loja indisponível", { status: 404 });
    const brand = String(reseller.brand_name || reseller.company_name || "Loja de Proxies");
    const desc = String(reseller.hero_subtitle || reseller.about_text || ("Conheça os produtos e serviços da " + brand + ".")).slice(0, 240);
    const image = httpsImage(reseller.logo_url) || httpsImage(reseller.favicon_url);
    const rawDomain = String(reseller.custom_domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const domain = /^(?=.{1,253}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(rawDomain) ? rawDomain : null;
    const destination = domain ? "https://" + domain + "/" : "https://fbflix.com.br/r/" + encodeURIComponent(slug);
    const shareUrl = new URL(req.url).origin + new URL(req.url).pathname + "?slug=" + encodeURIComponent(slug);
    const meta = [
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="' + esc(brand) + '">',
      '<meta property="og:title" content="' + esc(brand) + '">',
      '<meta property="og:description" content="' + esc(desc) + '">',
      '<meta property="og:url" content="' + esc(shareUrl) + '">',
      '<meta name="description" content="' + esc(desc) + '">',
      '<meta name="twitter:card" content="' + (image ? "summary_large_image" : "summary") + '">',
      '<meta name="twitter:title" content="' + esc(brand) + '">',
      '<meta name="twitter:description" content="' + esc(desc) + '">',
      ...(image ? ['<meta property="og:image" content="' + esc(image) + '">', '<meta name="twitter:image" content="' + esc(image) + '">'] : []),
    ].join("\n");
    const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(brand) + '</title>' + meta + '<meta http-equiv="refresh" content="0;url=' + esc(destination) + '"></head><body><p>Redirecionando para ' + esc(brand) + '...</p><a href="' + esc(destination) + '">Acessar loja</a><script>location.replace(' + JSON.stringify(destination).replace(/</g, "\\u003c") + ')</script></body></html>';
    return new Response(req.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=120", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("reseller-share-og error:", error);
    return new Response("Não foi possível carregar a loja", { status: 500 });
  }
});
