import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check – staff only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: isStaff } = await adminClient.rpc("is_staff", { _user_id: userId });
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch MP balance
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) {
      return new Response(
        JSON.stringify({ error: "MERCADOPAGO_ACCESS_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try multiple endpoints
    const endpoints = [
      "https://api.mercadopago.com/v1/account/balance",
      "https://api.mercadopago.com/users/me/mercadopago_account/balance",
      "https://api.mercadopago.com/users/me",
    ];

    let mpData: any = null;
    let lastError = "";

    for (const url of endpoints) {
      const mpRes = await fetch(url, {
        headers: { Authorization: `Bearer ${mpToken}` },
      });

      if (mpRes.ok) {
        mpData = await mpRes.json();
        console.log(`Success from ${url}:`, JSON.stringify(mpData).substring(0, 500));
        break;
      } else {
        lastError = await mpRes.text();
        console.log(`Failed ${url}: ${mpRes.status} ${lastError}`);
      }
    }

    if (!mpData) {
      return new Response(
        JSON.stringify({ error: `All MP endpoints failed. Last: ${lastError}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize: /users/me returns balance inside mercadopago_account
    const result = mpData.available_balance !== undefined
      ? mpData
      : mpData.balance !== undefined
        ? { available_balance: mpData.balance, total_amount: mpData.total_amount ?? mpData.balance, unavailable_balance: mpData.unavailable_balance ?? 0 }
        : mpData.mercadopago_account
          ? { available_balance: mpData.mercadopago_account.balance ?? 0, total_amount: mpData.mercadopago_account.amount ?? 0, unavailable_balance: 0 }
          : mpData;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
