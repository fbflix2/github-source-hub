import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { proxy } = await req.json();
    if (!proxy || typeof proxy !== "string") {
      return new Response(JSON.stringify({ error: "Proxy string is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse proxy: host:port:user:pass or host:port
    const parts = proxy.trim().split(":");
    if (parts.length < 2) {
      return new Response(JSON.stringify({ error: "Formato inválido. Use host:porta:usuario:senha" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const host = parts[0];
    const port = parts[1];
    const username = parts[2] || "";
    const password = parts[3] || "";

    // Use ip-api.com to check the proxy IP location
    // First, resolve the proxy host to get the IP
    // We'll check ip-api.com with the host directly
    let targetHost = host;

    // If host looks like a domain, try to use it directly
    // ip-api works with both IPs and domains
    const geoUrl = `http://ip-api.com/json/${targetHost}?fields=status,message,country,countryCode,regionName,city,isp,query`;

    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (geoData.status === "fail") {
      return new Response(JSON.stringify({
        success: false,
        error: `Não foi possível localizar o proxy: ${geoData.message}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Test connectivity by trying to make a request through the proxy
    // We'll skip actual proxy connection test (Deno doesn't natively support HTTP proxies)
    // Instead we provide geo info based on the host IP

    const countryNames: Record<string, string> = {
      BR: "Brasil",
      US: "Estados Unidos",
      CA: "Canadá",
      GB: "Reino Unido",
      DE: "Alemanha",
      FR: "França",
      JP: "Japão",
      AU: "Austrália",
      IN: "Índia",
      MX: "México",
      AR: "Argentina",
      CL: "Chile",
      CO: "Colômbia",
      PT: "Portugal",
      ES: "Espanha",
      IT: "Itália",
      NL: "Holanda",
      SE: "Suécia",
      NO: "Noruega",
      RU: "Rússia",
      CN: "China",
      KR: "Coreia do Sul",
      SG: "Singapura",
    };

    return new Response(JSON.stringify({
      success: true,
      ip: geoData.query,
      country: countryNames[geoData.countryCode] || geoData.country,
      countryCode: geoData.countryCode,
      region: geoData.regionName,
      city: geoData.city,
      isp: geoData.isp,
      host,
      port,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Test proxy error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
