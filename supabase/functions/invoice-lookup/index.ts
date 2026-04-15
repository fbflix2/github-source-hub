import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const action = url.searchParams.get("action") || "lookup";

    if (!code || code.length > 20) {
      return new Response(JSON.stringify({ error: "Código inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "status") {
      const { data } = await supabaseAdmin
        .from("invoice_links")
        .select("status, paid_at")
        .eq("code", code)
        .single();

      return new Response(JSON.stringify(data || { status: "not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: lookup full invoice (without sensitive fields)
    const { data, error } = await supabaseAdmin
      .from("invoice_links")
      .select("id, code, client_name, product_name, amount, description, reference_date, status, qr_code, qr_code_base64, expires_at, paid_at, mp_payment_id, payment_id")
      .eq("code", code)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Fatura não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
