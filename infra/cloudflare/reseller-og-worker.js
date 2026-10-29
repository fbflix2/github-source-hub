/**
 * Cloudflare Worker: server-render reseller Open Graph metadata for link previews.
 * Route: blackproxy.com.br/* and other reseller custom domains (NOT fbflix.com.br).
 * Configure SUPABASE_URL and SUPABASE_ANON_KEY as Worker environment variables.
 * Origin continues to be the existing Lovable-hosted SPA.
 */
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const safeImage = (value) => {
  try { const u = new URL(value); return u.protocol === "https:" ? u.href : null; } catch { return null; }
};
async function rpc(env, name, body) {
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + env.SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Reseller metadata RPC " + name + ": " + response.status);
  return response.json();
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const response = await fetch(request);
    if (request.method !== "GET" || !response.ok || !(response.headers.get("content-type") || "").includes("text/html") ||
        ["fbflix.com.br", "www.fbflix.com.br"].includes(host)) return response;
    try {
      const slugResult = await rpc(env, "get_reseller_slug_by_domain", { _domain: host });
      const slug = typeof slugResult === "string" ? slugResult : null;
      if (!slug) return response;
      const data = await rpc(env, "get_reseller_public_by_slug", { _slug: slug });
      const reseller = Array.isArray(data) ? data[0] : data;
      if (!reseller) return response;
      const brand = String(reseller.brand_name || reseller.company_name || "Loja de Proxies");
      const description = String(reseller.hero_subtitle || reseller.about_text || ("Conheça os produtos e serviços da " + brand + ".")).slice(0, 220);
      const image = safeImage(reseller.logo_url || reseller.favicon_url);
      const meta = [
        ["name", "description", description], ["property", "og:type", "website"],
        ["property", "og:site_name", brand], ["property", "og:url", url.origin + url.pathname],
        ["property", "og:title", brand], ["property", "og:description", description],
        ["name", "twitter:card", image ? "summary_large_image" : "summary"],
        ["name", "twitter:title", brand], ["name", "twitter:description", description],
        ...(image ? [["property", "og:image", image], ["name", "twitter:image", image]] : []),
      ].map(([type, name, content]) => '<meta ' + type + '="' + escapeHtml(name) + '" content="' + escapeHtml(content) + '">').join("\n");
      const html = await response.text();
      const clean = html
        .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
        .replace(/<meta\s+[^>]*(?:name|property)\s*=\s*["'](?:description|author|twitter:[^"']+|og:[^"']+)["'][^>]*>/gi, "")
        .replace(/<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*>/gi, "");
      const updated = clean.replace(/<head([^>]*)>/i, '<head$1>\n<title>' + escapeHtml(brand) + '</title>\n<link rel="canonical" href="' + escapeHtml(url.origin + url.pathname) + '">\n' + meta);
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.set("content-type", "text/html; charset=utf-8");
      headers.set("cache-control", "public, max-age=120");
      return new Response(updated, { status: response.status, headers });
    } catch (error) {
      console.error("Reseller Open Graph lookup failed", error);
      return response;
    }
  },
};
