import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const slug = pathParts[pathParts.length - 1];

  console.log(`Fetching metadata for product slug: ${slug}`);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch product data
  const { data: product, error } = await supabase
    .from("products")
    .select("name, description, image_url")
    .eq("slug", slug)
    .single();

  if (error || !product) {
    console.error("Product not found or error:", error);
    // Fallback to default metadata if product not found
    return new Response(
      `<html><head>
        <title>FBFLIX - Líder em Contigência</title>
        <meta property="og:title" content="FBFLIX - Líder em Contigência">
        <meta property="og:description" content="Plataforma líder em ativos para anunciantes.">
        <meta property="og:image" content="https://fbflix.com.br/favicon.png">
      </head></html>`,
      { headers: { ...corsHeaders, "Content-Type": "text/html" } }
    );
  }

  const title = `${product.name} - FBFLIX`;
  const description = product.description || "Confira este produto na FBFLIX!";
  const image = product.image_url || "https://fbflix.com.br/favicon.png";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <meta name="description" content="${description}">
    
    <!-- Facebook / Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${url.href}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image}">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${url.href}">
    <meta property="twitter:title" content="${title}">
    <meta property="twitter:description" content="${description}">
    <meta property="twitter:image" content="${image}">

    <!-- Redirect to actual product page after a short delay or immediately -->
    <meta http-equiv="refresh" content="0;url=https://fbflix.com.br/produto/${slug}">
</head>
<body>
    Redirecionando para o produto...
</body>
</html>`;

  return new Response(html, {
    headers: { ...corsHeaders, "Content-Type": "text/html" },
  });
});
