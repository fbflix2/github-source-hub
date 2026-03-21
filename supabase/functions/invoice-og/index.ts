import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return new Response("Missing code", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: invoice } = await supabase
      .from("invoice_links")
      .select("code, client_name, product_name, amount, description, status, paid_at")
      .eq("code", code)
      .single();

    if (!invoice) {
      return new Response("Invoice not found", { status: 404 });
    }

    const isPaid = invoice.status === "paid";
    const clientName = invoice.client_name || "Cliente";
    const amount = Number(invoice.amount).toFixed(2);
    
    const title = isPaid 
      ? `✅ Pagamento Confirmado — FBFLIX`
      : `💰 Cobrança para ${clientName} — FBFLIX`;
    
    const description = isPaid
      ? `Pagamento de R$ ${amount} referente a ${invoice.product_name} foi confirmado.`
      : `Olá ${clientName}! Efetue o pagamento de R$ ${amount} referente a ${invoice.product_name}. Pagamento seguro via PIX.`;

    // OG image: use the site's social image
    const ogImage = "https://storage.googleapis.com/gpt-engineer-file-uploads/fJXleP588dPKmFEfAyv9cbBn4ni1/social-images/social-1772211026866-Site_de_Portf%C3%B3lio_e_Curr%C3%ADculo_de_Marketing_Simples_Preto_e_Verde_Escuro.webp";
    
    // Redirect URL to the actual SPA page
    const redirectUrl = `https://fbflix.com.br/pagar/${code}`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${redirectUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:site_name" content="FBFLIX">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImage}">
  
  <!-- Auto redirect for real users -->
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  <script>window.location.href = "${redirectUrl}";</script>
</head>
<body>
  <p>Redirecionando para o pagamento...</p>
  <p><a href="${redirectUrl}">Clique aqui se não for redirecionado</a></p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response("Internal error", { status: 500 });
  }
});
